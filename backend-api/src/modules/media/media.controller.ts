import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { MediaService } from './media.service';
import type { UploadContractResponse } from './media.service';

@Controller('media')
@UseGuards(JwtAuthGuard)
@ApiTags('media')
@ApiBearerAuth('access-token')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('uploads/presign')
  @ApiOperation({ summary: 'Create upload contract', description: 'Returns presigned-style upload metadata.' })
  @ApiBody({ type: CreateUploadUrlDto })
  @ApiOkResponse({ description: 'Upload contract payload containing a scoped upload URL' })
  createUploadContract(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateUploadUrlDto,
  ): Promise<UploadContractResponse> {
    return this.mediaService.createUploadContract(user.sub, payload);
  }

  @Post('uploads/complete')
  @ApiOperation({ summary: 'Validate upload and enqueue malware scan' })
  completeUpload(@CurrentUser() user: JwtPayload, @Body() payload: CompleteUploadDto) {
    return this.mediaService.completeUpload(user.sub, payload.mediaId);
  }

  @Get(':mediaId/download')
  @ApiOperation({ summary: 'Create a scoped private media download URL' })
  createDownloadUrl(@CurrentUser() user: JwtPayload, @Param('mediaId') mediaId: string) {
    return this.mediaService.createDownloadUrl(user.sub, mediaId);
  }

  @Get(':mediaId')
  @ApiOperation({ summary: 'Get private media scan status' })
  getMediaStatus(@CurrentUser() user: JwtPayload, @Param('mediaId') mediaId: string) {
    return this.mediaService.getMediaStatus(user.sub, mediaId);
  }
}
