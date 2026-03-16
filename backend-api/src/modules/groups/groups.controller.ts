import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsUUID } from 'class-validator';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupsService } from './groups.service';

class ListGroupsQueryDto {
  @IsUUID('4')
  organizationId!: string;
}

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  listGroups(@CurrentUser() user: JwtPayload, @Query() query: ListGroupsQueryDto) {
    return this.groupsService.listGroups(user.sub, query.organizationId);
  }

  @Post()
  createGroup(@CurrentUser() user: JwtPayload, @Body() payload: CreateGroupDto) {
    return this.groupsService.createGroup(user.sub, payload);
  }

  @Post(':groupId/join')
  joinGroup(@CurrentUser() user: JwtPayload, @Param('groupId') groupId: string) {
    return this.groupsService.joinGroup(user.sub, groupId);
  }

  @Get(':groupId/members')
  listMembers(@CurrentUser() user: JwtPayload, @Param('groupId') groupId: string) {
    return this.groupsService.listMembers(user.sub, groupId);
  }
}
