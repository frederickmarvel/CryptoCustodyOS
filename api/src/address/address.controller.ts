import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiBearerAuth } from '@nestjs/swagger';
import { AddressService } from './address.service';
import { CreateAddressDto, VerifyAddressDto } from './dto/address.dto';
import { Address } from './address.entity';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { CurrentApiKey } from '../common/decorators/current-api-key.decorator';
import { ApiKey } from '../api-key/api-key.entity';

@ApiTags('Addresses')
@Controller('v1/wallets/:walletId/addresses')
@ApiSecurity('X-API-Key')
@UseGuards(ApiKeyGuard)
@ApiBearerAuth('X-API-Key')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post()
  @ApiOperation({ summary: 'Generate a new address for a wallet' })
  async create(
    @Param('walletId') walletId: string,
    @Body() dto: CreateAddressDto,
    @CurrentApiKey() apiKey: ApiKey,
  ): Promise<Address> {
    return this.addressService.create(walletId, apiKey.tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all addresses for a wallet' })
  async findAll(
    @Param('walletId') walletId: string,
    @CurrentApiKey() apiKey: ApiKey,
  ): Promise<Address[]> {
    return this.addressService.findAllByWallet(walletId, apiKey.tenantId);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify an address belongs to a wallet' })
  async verify(
    @Param('walletId') walletId: string,
    @Body() dto: VerifyAddressDto,
    @CurrentApiKey() apiKey: ApiKey,
  ): Promise<{ valid: boolean; reason?: string }> {
    return this.addressService.verify(walletId, apiKey.tenantId, dto);
  }
}