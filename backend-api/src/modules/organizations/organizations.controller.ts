import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post('onboard')
  onboard(@CurrentUser() user: JwtPayload, @Body() payload: CreateOrganizationDto) {
    return this.organizationsService.onboardUser(user.sub, payload);
  }

  @Get('me')
  listMine(@CurrentUser() user: JwtPayload) {
    return this.organizationsService.getMyOrganizations(user.sub);
  }

  @Post(':organizationId/switch')
  switchOrganization(@CurrentUser() user: JwtPayload, @Param('organizationId') organizationId: string) {
    return this.organizationsService.switchActiveOrganization(user.sub, organizationId);
  }
}
