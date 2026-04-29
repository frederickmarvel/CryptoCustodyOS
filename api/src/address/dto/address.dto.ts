import { IsString, IsNotEmpty, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAddressDto {
  @ApiProperty({ example: 'bc1qtestnet123456789abcdef' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiPropertyOptional({ example: "m/48'/1'/0'/0'/0'" })
  @IsString()
  @IsOptional()
  derivationPath?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  derivationIndex?: number;

  @ApiProperty({ example: 'BTC' })
  @IsString()
  @IsNotEmpty()
  chainSymbol: string;

  @ApiProperty({ example: 'bitcoin-testnet' })
  @IsString()
  @IsNotEmpty()
  network: string;
}

export class VerifyAddressDto {
  @ApiProperty({ example: 'bc1qtestnet123456789abcdef' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  expectedDerivationPath?: string;
}

export class AddressResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty()
  walletId: string;

  @ApiProperty()
  address: string;

  @ApiPropertyOptional()
  derivationPath: string | null;

  @ApiProperty()
  derivationIndex: number;

  @ApiProperty()
  chainSymbol: string;

  @ApiProperty()
  network: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;
}