import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResponse, SearchService } from './search.service';

@Controller('search')
@UseGuards(JwtAuthGuard)
@ApiTags('search')
@ApiBearerAuth('access-token')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search users, groups, and posts' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Aggregated search result payload' })
  search(@CurrentUser() user: JwtPayload, @Query() query: SearchQueryDto): Promise<SearchResponse> {
    return this.searchService.search(user.sub, query);
  }
}
