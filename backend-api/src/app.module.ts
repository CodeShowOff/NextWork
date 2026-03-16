import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { envValidationSchema } from './common/config/env.validation';
import { CacheModule } from './common/cache/cache.module';
import { DatabaseModule } from './common/database/database.module';
import { RequestMetricsInterceptor } from './common/observability/request-metrics.interceptor';
import { RequestMetricsService } from './common/observability/request-metrics.service';
import { RateLimitGuard } from './common/reliability/rate-limit.guard';
import { ReliabilityModule } from './common/reliability/reliability.module';
import { RedisModule } from './common/redis/redis.module';
import { HealthController } from './health.controller';
import { OpsController } from './ops.controller';
import { AuthModule } from './modules/auth/auth.module';
import { CommentsModule } from './modules/comments/comments.module';
import { FeedModule } from './modules/feed/feed.module';
import { FollowsModule } from './modules/follows/follows.module';
import { GroupsModule } from './modules/groups/groups.module';
import { InvitesModule } from './modules/invites/invites.module';
import { LikesModule } from './modules/likes/likes.module';
import { MediaModule } from './modules/media/media.module';
import { MessagesModule } from './modules/messages/messages.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { PostsModule } from './modules/posts/posts.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SearchModule } from './modules/search/search.module';
import { UsersModule } from './modules/users/users.module';

// Phase roadmap note (planning only, not runtime imports yet):
// StoriesModule, ReelsModule, HashtagsModule, MentionsModule,
// PollsModule, EventsModule, AnnouncementsModule,
// BookmarksModule, SharesModule.
// Source of truth: documentation/phase-1-feature-contract.md

@Module({
  controllers: [HealthController, OpsController],
  providers: [
    RequestMetricsService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestMetricsInterceptor,
    },
  ],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      cache: true,
    }),
    DatabaseModule,
    RedisModule,
    CacheModule,
    ReliabilityModule,
    AuthModule,
    UsersModule,
    ProfilesModule,
    PostsModule,
    FeedModule,
    CommentsModule,
    LikesModule,
    FollowsModule,
    OrganizationsModule,
    GroupsModule,
    InvitesModule,
    MessagesModule,
    NotificationsModule,
    RealtimeModule,
    SearchModule,
    MediaModule,
  ],
})
export class AppModule {}
