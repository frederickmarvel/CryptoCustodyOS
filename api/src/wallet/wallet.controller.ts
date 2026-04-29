import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { Wallet } from './wallet.entity';

@ApiTags('Wallets')
@Controller('v1/wallets')
@ApiSecurity('X-API-Key')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new wallet' })
  create(@Body() dto: CreateWalletDto): Promise<Wallet> {
    return this.walletService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List wallets for a tenant' })
  findAll(@Query('tenant_id') tenantId: string): Promise<Wallet[]> {
    return this.walletService.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get wallet by ID' })
  findOne(@Param('id') id: string, @Query('tenant_id') tenantId: string): Promise<Wallet | null> {
    return this.walletService.findOne(id, tenantId);
  }
}
