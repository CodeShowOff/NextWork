import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsUUID } from 'class-validator';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { CreateGroupDto } from './dto/create-group.dto';
import { DeleteGroupDto } from './dto/delete-group.dto';
import { InitializeStarterGroupsDto } from './dto/initialize-starter-groups.dto';
import { StarterGroupsQueryDto } from './dto/starter-groups-query.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupsService } from './groups.service';

class ListGroupsQueryDto {
  @IsUUID('all')
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

  @Patch(':groupId')
  updateGroup(@CurrentUser() user: JwtPayload, @Param('groupId') groupId: string, @Body() payload: UpdateGroupDto) {
    return this.groupsService.updateGroup(user.sub, groupId, payload);
  }

  @Delete(':groupId')
  deleteGroup(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Body() payload?: DeleteGroupDto,
  ) {
    return this.groupsService.deleteGroup(user.sub, groupId, payload);
  }

  @Get('onboarding/defaults')
  starterGroupsConfig(@CurrentUser() user: JwtPayload, @Query() query: StarterGroupsQueryDto) {
    return this.groupsService.getStarterGroupsConfig(user.sub, query.organizationId);
  }

  @Post('onboarding/initialize')
  initializeStarterGroups(@CurrentUser() user: JwtPayload, @Body() payload: InitializeStarterGroupsDto) {
    return this.groupsService.initializeStarterGroups(user.sub, payload);
  }

  @Get(':groupId/members')
  listMembers(@CurrentUser() user: JwtPayload, @Param('groupId') groupId: string) {
    return this.groupsService.listMembers(user.sub, groupId);
  }
}

