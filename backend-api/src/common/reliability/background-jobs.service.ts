import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, JobsOptions, Queue, QueueEvents, Worker } from 'bullmq';
import { createHash } from 'node:crypto';

import { CacheService } from '../cache/cache.service';

interface CacheInvalidationJob {
  type: 'invalidate-cache-prefix';
  prefix: string;
}

interface DeadLetterJob {
  sourceQueue: string;
  sourceJobId: string;
  name: string;
  data: CacheInvalidationJob;
  failedReason: string;
  failedAt: string;
  attemptsMade: number;
  attemptsConfigured: number;
}

interface QueueCountSnapshot {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  paused: number;
}

export interface BackgroundJobsSnapshot {
  queueName: string;
  deadLetterQueueName: string;
  counters: {
    enqueued: number;
    processed: number;
    failed: number;
    retried: number;
    deadLettered: number;
  };
  queue: QueueCountSnapshot;
  deadLetterQueue: QueueCountSnapshot;
  sampledAt: string;
}

@Injectable()
export class BackgroundJobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackgroundJobsService.name);
  private readonly queueName = 'jobs-cache-invalidation';
  private readonly deadLetterQueueName = 'jobs-cache-invalidation-dlq';
  private readonly exportOnlyMode = process.env.OPENAPI_EXPORT_ONLY === 'true';
  private readonly retryPolicy: JobsOptions = {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 3600,
      count: 2000,
    },
    removeOnFail: {
      age: 24 * 3600,
      count: 5000,
    },
  };

  private queue?: Queue;
  private deadLetterQueue?: Queue;
  private worker?: Worker;
  private queueEvents?: QueueEvents;
  private redisConnection?: {
    url: string;
    maxRetriesPerRequest: null;
    enableReadyCheck: true;
  };

  private enqueuedCount = 0;
  private processedCount = 0;
  private failedCount = 0;
  private retriedCount = 0;
  private deadLetteredCount = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.exportOnlyMode) {
      return;
    }

    const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');
    this.redisConnection = {
      url: redisUrl,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    };

    this.queue = new Queue(this.queueName, {
      connection: this.redisConnection,
      defaultJobOptions: this.retryPolicy,
    });

    this.deadLetterQueue = new Queue(this.deadLetterQueueName, {
      connection: this.redisConnection,
      defaultJobOptions: {
        removeOnComplete: {
          age: 7 * 24 * 3600,
          count: 10000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600,
          count: 10000,
        },
      },
    });

    this.queueEvents = new QueueEvents(this.queueName, {
      connection: this.redisConnection,
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.logger.warn(`Background job ${jobId ?? 'unknown'} failed: ${failedReason}`);
    });

    this.queueEvents.on('error', (error) => {
      this.logger.error(`Background queue events error: ${error.message}`);
    });

    this.worker = new Worker(
      this.queueName,
      async (job) => this.processJob(job),
      {
        connection: this.redisConnection,
        concurrency: 4,
      },
    );

    this.worker.on('failed', (job, error) => {
      this.failedCount += 1;

      this.logger.warn(
        `Background worker failed job ${job?.id ?? 'unknown'} on attempt ${job?.attemptsMade ?? 0}: ${error.message}`,
      );

      const attemptsConfigured = job?.opts.attempts ?? 1;
      const attemptsMade = job?.attemptsMade ?? 0;

      if (attemptsMade >= attemptsConfigured) {
        void this.sendToDeadLetter(job, error, attemptsConfigured, attemptsMade);
      } else {
        this.retriedCount += 1;
      }
    });

    this.worker.on('completed', () => {
      this.processedCount += 1;
    });

    this.worker.on('error', (error) => {
      this.logger.error(`Background worker error: ${error.message}`);
    });

    await Promise.all([
      this.queue.waitUntilReady(),
      this.deadLetterQueue.waitUntilReady(),
      this.queueEvents.waitUntilReady(),
      this.worker.waitUntilReady(),
    ]);
    this.logger.log(`Background worker started for queue ${this.queueName}`);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.worker?.close(),
      this.queueEvents?.close(),
      this.queue?.close(),
      this.deadLetterQueue?.close(),
    ]);

    if (this.exportOnlyMode) {
      return;
    }

    this.logger.log(`Background worker stopped for queue ${this.queueName}`);
  }

  async enqueueCachePrefixInvalidation(prefix: string): Promise<void> {
    if (!this.queue) {
      throw new Error('Background queue not initialized.');
    }

    const payload: CacheInvalidationJob = {
      type: 'invalidate-cache-prefix',
      prefix,
    };

    await this.queue.add('invalidate-cache-prefix', payload, {
      ...this.retryPolicy,
      // Coalesce bursts of identical invalidations for a short period.
      jobId: `invalidate:${this.hashPrefix(prefix)}:${Math.floor(Date.now() / 5000)}`,
    });

    this.enqueuedCount += 1;
  }

  async getSnapshot(): Promise<BackgroundJobsSnapshot> {
    if (!this.queue || !this.deadLetterQueue) {
      const emptyCounts: QueueCountSnapshot = {
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
        paused: 0,
      };

      return {
        queueName: this.queueName,
        deadLetterQueueName: this.deadLetterQueueName,
        counters: {
          enqueued: this.enqueuedCount,
          processed: this.processedCount,
          failed: this.failedCount,
          retried: this.retriedCount,
          deadLettered: this.deadLetteredCount,
        },
        queue: emptyCounts,
        deadLetterQueue: emptyCounts,
        sampledAt: new Date().toISOString(),
      };
    }

    const [mainCounts, deadLetterCounts] = await Promise.all([
      this.queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed', 'paused'),
      this.deadLetterQueue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed', 'paused'),
    ]);

    return {
      queueName: this.queueName,
      deadLetterQueueName: this.deadLetterQueueName,
      counters: {
        enqueued: this.enqueuedCount,
        processed: this.processedCount,
        failed: this.failedCount,
        retried: this.retriedCount,
        deadLettered: this.deadLetteredCount,
      },
      queue: {
        waiting: mainCounts.waiting,
        active: mainCounts.active,
        delayed: mainCounts.delayed,
        completed: mainCounts.completed,
        failed: mainCounts.failed,
        paused: mainCounts.paused,
      },
      deadLetterQueue: {
        waiting: deadLetterCounts.waiting,
        active: deadLetterCounts.active,
        delayed: deadLetterCounts.delayed,
        completed: deadLetterCounts.completed,
        failed: deadLetterCounts.failed,
        paused: deadLetterCounts.paused,
      },
      sampledAt: new Date().toISOString(),
    };
  }

  private async processJob(job: Job): Promise<void> {
    const data = job.data as CacheInvalidationJob;

    if (data.type === 'invalidate-cache-prefix') {
      await this.cacheService.deleteByPrefix(data.prefix);
      return;
    }

    throw new Error(`Unsupported background job type: ${(data as { type?: string }).type ?? 'unknown'}`);
  }

  private hashPrefix(prefix: string): string {
    return createHash('sha256').update(prefix).digest('hex');
  }

  private async sendToDeadLetter(
    job: Job | undefined,
    error: Error,
    attemptsConfigured: number,
    attemptsMade: number,
  ): Promise<void> {
    if (!job || !this.deadLetterQueue) {
      return;
    }

    try {
      const deadLetterPayload: DeadLetterJob = {
        sourceQueue: this.queueName,
        sourceJobId: String(job.id ?? 'unknown'),
        name: job.name,
        data: job.data as CacheInvalidationJob,
        failedReason: error.message,
        failedAt: new Date().toISOString(),
        attemptsMade,
        attemptsConfigured,
      };

      await this.deadLetterQueue.add('dead-letter', deadLetterPayload, {
        removeOnComplete: {
          age: 7 * 24 * 3600,
          count: 10000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600,
          count: 10000,
        },
      });

      this.deadLetteredCount += 1;
      this.logger.error(
        `Background job ${deadLetterPayload.sourceJobId} moved to DLQ after ${attemptsMade} attempts: ${error.message}`,
      );
    } catch (deadLetterError) {
      this.logger.error(
        `Failed to move job ${String(job.id ?? 'unknown')} to DLQ: ${(deadLetterError as Error).message}`,
      );
    }
  }
}
