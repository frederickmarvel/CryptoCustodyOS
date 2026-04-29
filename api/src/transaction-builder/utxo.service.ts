import { Injectable } from '@nestjs/common';
import { UtxoInput } from '../transaction/transaction.entity';

export interface UtxoEntry {
  txid: string;
  vout: number;
  satoshis: number;
  address: string;
  derivationPath?: string;
  confirmations: number;
}

@Injectable()
export class UtxoService {
  async fetchUtxos(walletId: string, address: string, network: string): Promise<UtxoEntry[]> {
    throw new Error('UTXO fetching not implemented — wire up a blockchain indexer (Esplora, Blockstream, etc.)');
  }

  async selectUtxos(
    availableUtxos: UtxoEntry[],
    targetSatoshis: number,
  ): Promise<{ selected: UtxoEntry[]; change: number }> {
    const sorted = [...availableUtxos].sort((a, b) => b.satoshis - a.satoshis);
    let accumulated = 0;
    const selected: UtxoEntry[] = [];

    for (const utxo of sorted) {
      selected.push(utxo);
      accumulated += utxo.satoshis;
      if (accumulated >= targetSatoshis) {
        break;
      }
    }

    if (accumulated < targetSatoshis) {
      throw new Error('Insufficient UTXOs to cover target amount');
    }

    return { selected, change: accumulated - targetSatoshis };
  }
}