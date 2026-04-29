import { IsString, IsNotEmpty, IsEnum, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Asset } from '../../transaction/transaction.entity';

export enum TransactionType {
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER = 'TRANSFER',
}

export class CreateWithdrawDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  walletId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  creatorId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount: string;

  @ApiProperty({ enum: Asset })
  @IsEnum(Asset)
  asset: Asset;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  destination: string;
}
