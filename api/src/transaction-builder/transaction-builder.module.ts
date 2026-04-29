import { Module } from '@nestjs/common';
import { UtxoService } from './utxo.service';
import { FeeService } from './fee.service';
import { PsbtBuilderService } from './psbt-builder.service';

@Module({
  providers: [UtxoService, FeeService, PsbtBuilderService],
  exports: [UtxoService, FeeService, PsbtBuilderService],
})
export class TransactionBuilderModule {}