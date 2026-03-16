import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ id: string; email: string; status: string; activeOrganizationId: string | null }> {
    const currentUser = await this.usersService.findById(user.sub);
    if (!currentUser) {
      throw new NotFoundException('User not found');
    }

    return {
      id: currentUser.id,
      email: currentUser.email,
      status: currentUser.status,
      activeOrganizationId: currentUser.activeOrganizationId,
    };
  }
}
