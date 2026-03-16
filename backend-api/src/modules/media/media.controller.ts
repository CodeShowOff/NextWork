import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
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
  @ApiOkResponse({ description: 'Upload contract payload containing upload and public URLs' })
  createUploadContract(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateUploadUrlDto,
  ): UploadContractResponse {
    return this.mediaService.createUploadContract(user.sub, payload);
  }
}
