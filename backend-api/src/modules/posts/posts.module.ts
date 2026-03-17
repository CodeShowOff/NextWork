import { Module } from '@nestjs/common';

import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PostsController } from './posts.controller';
import { PostsRepository } from './posts.repository';
import { PostsService } from './posts.service';

@Module({
	imports: [MediaModule, NotificationsModule],
	providers: [PostsRepository, PostsService],
	controllers: [PostsController],
	exports: [PostsService],
})
export class PostsModule {}
