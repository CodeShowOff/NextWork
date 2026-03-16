import { Module } from '@nestjs/common';

import { PostsModule } from '../posts/posts.module';
import { FeedController } from './feed.controller';
import { FeedRepository } from './feed.repository';
import { FeedService } from './feed.service';

@Module({
	imports: [PostsModule],
	providers: [FeedRepository, FeedService],
	controllers: [FeedController],
})
export class FeedModule {}
