import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  IsEnum,
} from 'class-validator';
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

export class SignedPayloadSignatureDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  keyId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fingerprint: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  publicKey: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  derivationPath: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  payloadSignature: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  psbtDigest: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  signedAt: string;
}

export class ImportSignedPayloadDto {
  @ApiProperty({ example: '1.0' })
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  payloadHash: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  keyId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  signerFingerprint: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  signedPsbtBase64: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  signatureCount: number;

  @ApiProperty({ type: [SignedPayloadSignatureDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SignedPayloadSignatureDto)
  signatures: SignedPayloadSignatureDto[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  signedAt: string;
}
