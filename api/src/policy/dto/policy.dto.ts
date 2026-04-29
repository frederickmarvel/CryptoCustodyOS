import { Type } from 'class-transformer';
import { IsString, IsOptional, IsEnum, IsInt, IsBoolean, IsArray, ValidateNested, IsNumber, Min, IsObject } from 'class-validator';
import { RuleType } from '../policy-rule.entity';

export class CreatePolicyDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @IsArray()
  @IsOptional()
  rules?: Array<{ ruleType: RuleType; ruleConfig: Record<string, any> }>;
}

export class AddRuleDto {
  @IsEnum(RuleType)
  ruleType: RuleType;

  @IsObject()
  ruleConfig: Record<string, any>;
}

export class AddDestinationAllowlistDto {
  @IsString()
  chainSymbol: string;

  @IsString()
  network: string;

  @IsString()
  addressPattern: string;

  @IsString()
  @IsOptional()
  label?: string;
}

export class AddAddressCooldownDto {
  @IsString()
  chainSymbol: string;

  @IsString()
  network: string;

  @IsString()
  address: string;

  @IsInt()
  @Min(1)
  cooldownSeconds: number;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class ApproveTransactionDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

export class RejectTransactionDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

export class CancelTransactionDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

export class PolicyViolationDto {
  ruleType: string;
  message: string;
  ruleId: string;
}
