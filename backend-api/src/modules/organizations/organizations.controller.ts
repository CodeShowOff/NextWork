import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
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

  @Patch(':organizationId')
  updateOrganization(
    @CurrentUser() user: JwtPayload,
    @Param('organizationId') organizationId: string,
    @Body() payload: UpdateOrganizationDto,
  ) {
    return this.organizationsService.updateOrganization(user.sub, organizationId, payload);
  }

  @Post(':organizationId/deactivate')
  deactivateOrganization(@CurrentUser() user: JwtPayload, @Param('organizationId') organizationId: string) {
    return this.organizationsService.deactivateOrganization(user.sub, organizationId);
  }

  @Delete(':organizationId')
  deleteOrganization(@CurrentUser() user: JwtPayload, @Param('organizationId') organizationId: string) {
    return this.organizationsService.deleteOrganization(user.sub, organizationId);
  }
}
