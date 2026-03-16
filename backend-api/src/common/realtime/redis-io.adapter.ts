import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { ServerOptions } from 'socket.io';

import { RedisService } from '../redis/redis.service';

export class RedisIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly redisService: RedisService,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);

    const pubClient = this.redisService.getClient().duplicate();
    const subClient = this.redisService.getClient().duplicate();
    server.adapter(createAdapter(pubClient, subClient));

    return server;
  }
}
