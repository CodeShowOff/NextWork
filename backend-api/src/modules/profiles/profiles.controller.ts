import { Body, Controller, Get, Param, Patch, Put, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ReplaceProfileSkillsDto } from './dto/replace-profile-skills.dto';
import { SearchProfileSkillsQueryDto } from './dto/search-profile-skills-query.dto';
import { ProfilesService } from './profiles.service';

@Controller('profiles')
@ApiTags('profiles')
@ApiBearerAuth('access-token')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('skills/search')
  @UseGuards(JwtAuthGuard)
  searchSkills(@Query() query: SearchProfileSkillsQueryDto) {
    return this.profilesService.searchSkills(query.q);
  }

  @Put('me/skills')
  @UseGuards(JwtAuthGuard)
  replaceMySkills(@CurrentUser() user: JwtPayload, @Body() payload: ReplaceProfileSkillsDto) {
    return this.profilesService.replaceMySkills(user.sub, payload);
  }

  @Get(':userId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get profile by user id' })
  @ApiParam({ name: 'userId', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Profile payload' })
  getByUserId(@CurrentUser() user: JwtPayload, @Param('userId') userId: string) {
    return this.profilesService.findByUserId(userId, user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update current user profile metadata' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiOkResponse({ description: 'Updated profile payload' })
  updateMe(@CurrentUser() user: JwtPayload, @Body() payload: UpdateProfileDto) {
    return this.profilesService.updateMyProfile(user.sub, payload);
  }
}
