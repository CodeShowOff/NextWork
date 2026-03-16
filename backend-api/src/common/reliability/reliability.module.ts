import { Global, Module } from '@nestjs/common';

import { BackgroundJobsService } from './background-jobs.service';
import { IdempotencyService } from './idempotency.service';

@Global()
@Module({
  providers: [IdempotencyService, BackgroundJobsService],
  exports: [IdempotencyService, BackgroundJobsService],
})
export class ReliabilityModule {}
