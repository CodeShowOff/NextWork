import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { MessagesController } from './messages.controller';
import { MessagesRepository } from './messages.repository';
import { MessagesService } from './messages.service';

@Module({
	imports: [NotificationsModule],
	providers: [MessagesRepository, MessagesService],
	controllers: [MessagesController],
	exports: [MessagesService],
})
export class MessagesModule {}
