import { Module } from '@nestjs/common';

import { GroupsController } from './groups.controller';
import { GroupsRepository } from './groups.repository';
import { GroupsService } from './groups.service';

@Module({
  controllers: [GroupsController],
  providers: [GroupsRepository, GroupsService],
  exports: [GroupsRepository, GroupsService],
})
export class GroupsModule {}
