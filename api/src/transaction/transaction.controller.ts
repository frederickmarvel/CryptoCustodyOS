import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import { ApprovalWorkflowService } from '../approval/approval-workflow.service';
import { CreateWithdrawDto } from './dto/create-withdraw.dto';
import { GeneratePayloadDto, ImportSignedPayloadDto } from './dto/transaction-payload.dto';
import { ApproveTransactionDto, RejectTransactionDto, CancelTransactionDto } from '../policy/dto/policy.dto';
import { TransactionRequest, SigningPayloadEnvelope, TransactionSummary } from './transaction.entity';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { CurrentApiKey } from '../common/decorators/current-api-key.decorator';
import { ApiKey } from '../api-key/api-key.entity';

@ApiTags('Transactions')
@Controller('v1/transactions')
@ApiSecurity('X-API-Key')
@UseGuards(ApiKeyGuard)
@ApiBearerAuth('X-API-Key')
export class TransactionController {
  constructor(
    private readonly txService: TransactionService,
    private readonly approvalWorkflowService: ApprovalWorkflowService,
  ) {}

  @Post('withdraw')
  @ApiOperation({ summary: 'Create a withdrawal transaction request' })
  createWithdraw(@Body() dto: CreateWithdrawDto): Promise<TransactionRequest> {
    return this.txService.createWithdraw(dto);
  }

  @Post(':id/unsigned-payload')
  @ApiOperation({ summary: 'Generate unsigned transaction payload (PSBT for BTC)' })
  generateUnsignedPayload(
    @Param('id') id: string,
    @Body() dto: GeneratePayloadDto,
    @CurrentApiKey() apiKey: ApiKey,
  ): Promise<TransactionRequest> {
    return this.txService.generateUnsignedPayload(
      id,
      apiKey.tenantId,
      dto.feePolicy,
      dto.customFeeSatPerVb ? parseInt(dto.customFeeSatPerVb) : undefined,
      dto.changeAddress,
    );
  }

  @Get(':id/unsigned-payload')
  @ApiOperation({ summary: 'Retrieve the unsigned transaction payload' })
  getUnsignedPayload(
    @Param('id') id: string,
    @CurrentApiKey() apiKey: ApiKey,
  ): Promise<SigningPayloadEnvelope | null> {
    return this.txService.getUnsignedPayload(id, apiKey.tenantId);
  }

  @Post(':id/signed-payload')
  @ApiOperation({ summary: 'Import a signed or partially signed payload from the offline signer' })
  importSignedPayload(
    @Param('id') id: string,
    @Body() dto: ImportSignedPayloadDto,
    @CurrentApiKey() apiKey: ApiKey,
  ): Promise<TransactionRequest> {
    return this.txService.importSignedPayload(id, apiKey.tenantId, dto);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: 'Get human-readable transaction summary' })
  getSummary(
    @Param('id') id: string,
    @CurrentApiKey() apiKey: ApiKey,
  ): Promise<TransactionSummary> {
    return this.txService.getSummary(id, apiKey.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentApiKey() apiKey: ApiKey,
  ): Promise<TransactionRequest | null> {
    return this.txService.findOne(id, apiKey.tenantId);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a transaction request' })
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveTransactionDto,
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    return this.approvalWorkflowService.approve(
      id,
      apiKey.tenantId,
      'API_KEY',
      apiKey.tenantId,
      dto.reason,
    );
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a transaction request' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectTransactionDto,
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    return this.approvalWorkflowService.reject(
      id,
      apiKey.tenantId,
      'API_KEY',
      apiKey.tenantId,
      dto.reason,
    );
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a transaction request' })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelTransactionDto,
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    return this.approvalWorkflowService.cancel(id, apiKey.tenantId, apiKey.tenantId, dto.reason);
  }
}
