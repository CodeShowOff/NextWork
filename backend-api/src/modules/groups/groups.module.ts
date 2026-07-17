import { Module } from '@nestjs/common';

import { MediaModule } from '../media/media.module';
import { GroupCollaborationController } from './group-collaboration.controller';
import { GroupCollaborationService } from './group-collaboration.service';
import { GroupsController } from './groups.controller';
import { GroupsRepository } from './groups.repository';
import { GroupsService } from './groups.service';

@Module({
  imports: [MediaModule],
  controllers: [GroupsController, GroupCollaborationController],
  providers: [GroupsRepository, GroupsService, GroupCollaborationService],
  exports: [GroupsRepository, GroupsService],
})
export class GroupsModule {}
