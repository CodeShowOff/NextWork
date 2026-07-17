import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { GroupRole } from '@prisma/client';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { CreateGroupDto } from './dto/create-group.dto';
import { CreateGroupInvitationDto } from './dto/create-group-invitation.dto';
import { DeleteGroupDto } from './dto/delete-group.dto';
import { InitializeStarterGroupsDto } from './dto/initialize-starter-groups.dto';
import { RequestGroupMembershipDto } from './dto/request-group-membership.dto';
import { ResolveGroupMembershipRequestDto } from './dto/resolve-group-membership-request.dto';
import { RespondGroupInvitationDto } from './dto/respond-group-invitation.dto';
import { StarterGroupsQueryDto } from './dto/starter-groups-query.dto';
import { UpdateGroupFavoriteDto } from './dto/update-group-favorite.dto';
import { UpdateGroupMemberRoleDto } from './dto/update-group-member-role.dto';
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

  @Post(':groupId/requests')
  requestMembership(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Body() payload: RequestGroupMembershipDto,
  ) {
    return this.groupsService.requestMembership(user.sub, groupId, payload.message);
  }

  @Get(':groupId/requests')
  listMembershipRequests(@CurrentUser() user: JwtPayload, @Param('groupId') groupId: string) {
    return this.groupsService.listMembershipRequests(user.sub, groupId);
  }

  @Post(':groupId/requests/:requestId/resolve')
  resolveMembershipRequest(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Param('requestId') requestId: string,
    @Body() payload: ResolveGroupMembershipRequestDto,
  ) {
    return this.groupsService.resolveMembershipRequest(user.sub, groupId, requestId, payload.action);
  }

  @Post(':groupId/invitations')
  createInvitation(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Body() payload: CreateGroupInvitationDto,
  ) {
    return this.groupsService.createInvitation(user.sub, groupId, payload.invitedUserId);
  }

  @Get('invitations/mine')
  listMyInvitations(@CurrentUser() user: JwtPayload) {
    return this.groupsService.listMyInvitations(user.sub);
  }

  @Post('invitations/:invitationId/respond')
  respondToInvitation(
    @CurrentUser() user: JwtPayload,
    @Param('invitationId') invitationId: string,
    @Body() payload: RespondGroupInvitationDto,
  ) {
    return this.groupsService.respondToInvitation(user.sub, invitationId, payload.accept);
  }

  @Patch(':groupId/members/:memberUserId/role')
  updateMemberRole(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Param('memberUserId') memberUserId: string,
    @Body() payload: UpdateGroupMemberRoleDto,
  ) {
    return this.groupsService.updateMemberRole(user.sub, groupId, memberUserId, payload.role as GroupRole);
  }

  @Patch(':groupId/favorite')
  setFavorite(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Body() payload: UpdateGroupFavoriteDto,
  ) {
    return this.groupsService.setFavorite(user.sub, groupId, payload.isFavorite);
  }

  @Post(':groupId/visit')
  recordVisit(@CurrentUser() user: JwtPayload, @Param('groupId') groupId: string) {
    return this.groupsService.recordVisit(user.sub, groupId);
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

  @Get(':groupId')
  getGroup(@CurrentUser() user: JwtPayload, @Param('groupId') groupId: string) {
    return this.groupsService.getGroup(user.sub, groupId);
  }
}

