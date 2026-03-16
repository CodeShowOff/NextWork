import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MessagesModule } from '../messages/messages.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { MessagesGateway } from './messages.gateway';
import { RealtimeMetricsService } from '../../common/observability/realtime-metrics.service';

@Module({
	imports: [AuthModule, UsersModule, MessagesModule, NotificationsModule],
	providers: [MessagesGateway, RealtimeMetricsService],
	exports: [RealtimeMetricsService],
})
export class RealtimeModule {}
