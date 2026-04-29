import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiKeyService } from './api-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@ApiTags('API Keys')
@Controller('v1/api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new API key for a tenant' })
  @ApiResponse({ status: 201, description: 'Returns the API key object and the raw key (shown only once)' })
  create(@Body() dto: CreateApiKeyDto) {
    return this.apiKeyService.create(dto);
  }
}
