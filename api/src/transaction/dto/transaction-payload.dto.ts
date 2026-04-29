import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeePolicy } from '../../transaction/transaction.entity';

export class GeneratePayloadDto {
  @ApiProperty({ enum: FeePolicy, default: FeePolicy.MEDIUM })
  @IsEnum(FeePolicy)
  @IsOptional()
  feePolicy?: FeePolicy;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  customFeeSatPerVb?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  changeAddress?: string;
}

export class UnsignedPayloadResponseDto {
  @ApiProperty()
  txRequestId: string;

  @ApiProperty()
  payload: object;

  @ApiProperty()
  payloadHash: string;

  @ApiProperty()
  btcPsbtBase64: string | null;

  @ApiProperty()
  createdAt: string;
}

export class TransactionSummaryDto {
  @ApiProperty()
  txRequestId: string;

  @ApiProperty()
  state: string;

  @ApiProperty()
  asset: string;

  @ApiProperty()
  amount: string;

  @ApiProperty()
  destination: string;

  @ApiProperty()
  networkFee: string;

  @ApiProperty()
  feePolicy: string;

  @ApiProperty()
  walletId: string;

  @ApiProperty()
  walletName: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty()
  utxoCount: number;

  @ApiProperty()
  payloadHash: string | null;

  @ApiProperty()
  createdAt: string;
}