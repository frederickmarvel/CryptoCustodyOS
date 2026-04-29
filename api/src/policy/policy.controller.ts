import { Controller, Post, Get, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PolicyService } from './policy.service';
import { ApprovalWorkflowService } from '../approval/approval-workflow.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { CurrentApiKey } from '../common/decorators/current-api-key.decorator';
import { CreatePolicyDto, AddRuleDto, AddDestinationAllowlistDto, AddAddressCooldownDto } from './dto/policy.dto';

@ApiTags('policies')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
@Controller('v1/policies')
export class PolicyController {
  constructor(
    private policyService: PolicyService,
    private approvalWorkflowService: ApprovalWorkflowService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new policy' })
  async create(@CurrentApiKey() apiKey: any, @Body() dto: CreatePolicyDto) {
    return this.policyService.create(apiKey.tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all policies for tenant' })
  async findAll(@CurrentApiKey() apiKey: any) {
    return this.policyService.findAllByTenant(apiKey.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a policy by ID' })
  async findOne(@Param('id') id: string, @CurrentApiKey() apiKey: any) {
    return this.policyService.findById(id, apiKey.tenantId);
  }

  @Post(':id/rules')
  @ApiOperation({ summary: 'Add a rule to a policy' })
  async addRule(@Param('id') id: string, @CurrentApiKey() apiKey: any, @Body() dto: AddRuleDto) {
    return this.policyService.addRule(id, apiKey.tenantId, dto);
  }

  @Post(':id/destination-allowlist')
  @ApiOperation({ summary: 'Add a destination allowlist entry' })
  async addDestAllowlist(@Param('id') id: string, @CurrentApiKey() apiKey: any, @Body() dto: AddDestinationAllowlistDto) {
    return this.policyService.addDestinationAllowlist(id, apiKey.tenantId, dto);
  }

  @Post('address-cooldown')
  @ApiOperation({ summary: 'Add an address cooldown' })
  async addAddressCooldown(@CurrentApiKey() apiKey: any, @Body() dto: AddAddressCooldownDto) {
    return this.policyService.addAddressCooldown(apiKey.tenantId, dto);
  }
}
