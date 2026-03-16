import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { CreateInviteLinkDto } from './dto/create-invite-link.dto';
import { InvitesService } from './invites.service';

@Controller('invites')
@UseGuards(JwtAuthGuard)
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() payload: CreateInviteLinkDto) {
    return this.invitesService.createInviteLink(user.sub, payload);
  }

  @Get(':token')
  getByToken(@Param('token') token: string) {
    return this.invitesService.getInviteByToken(token);
  }

  @Post(':token/accept')
  accept(@CurrentUser() user: JwtPayload, @Param('token') token: string) {
    return this.invitesService.acceptInvite(user.sub, token);
  }
}
