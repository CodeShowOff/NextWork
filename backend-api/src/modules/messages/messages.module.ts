import { Module } from '@nestjs/common';

import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MessagesController } from './messages.controller';
import { MessagesRepository } from './messages.repository';
import { MessagesService } from './messages.service';

@Module({
	imports: [NotificationsModule, MediaModule],
	providers: [MessagesRepository, MessagesService],
	controllers: [MessagesController],
	exports: [MessagesService],
})
export class MessagesModule {}
