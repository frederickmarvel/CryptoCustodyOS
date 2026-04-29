import { IsString, IsNotEmpty, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WalletType, WalletStorageClass } from '../../wallet/wallet.entity';

export class CreateWalletDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty({ example: 'Main Treasury' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ enum: WalletType })
  @IsEnum(WalletType)
  type: WalletType;

  @ApiProperty({ enum: WalletStorageClass })
  @IsEnum(WalletStorageClass)
  storageClass: WalletStorageClass;
}
