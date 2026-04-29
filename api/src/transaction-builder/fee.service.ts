import { Injectable } from '@nestjs/common';
import { FeePolicy } from '../transaction/transaction.entity';

export interface FeeEstimate {
  feePolicy: FeePolicy;
  satPerVb: number;
  totalFee: string;
  estimatedBytes: number;
}

@Injectable()
export class FeeService {
  private readonly feeRates: Record<FeePolicy, number> = {
    [FeePolicy.LOW]: 5,
    [FeePolicy.MEDIUM]: 15,
    [FeePolicy.HIGH]: 30,
    [FeePolicy.CUSTOM]: 15,
  };

  async estimateFee(
    utxoCount: number,
    outputCount: number,
    feePolicy: FeePolicy,
    customSatPerVb?: number,
  ): Promise<FeeEstimate> {
    const estimatedBytes = this.estimateVBytes(utxoCount, outputCount);
    const satPerVb = customSatPerVb ?? this.feeRates[feePolicy];
    const totalFee = Math.ceil(estimatedBytes * satPerVb).toString();

    return {
      feePolicy,
      satPerVb,
      totalFee,
      estimatedBytes,
    };
  }

  estimateVBytes(utxoCount: number, outputCount: number): number {
    const inputWeight = utxoCount * 165;
    const outputWeight = outputCount * 43;
    const base = 10;
    const totalWeight = base + inputWeight + outputWeight;
    return Math.ceil(totalWeight / 4);
  }
}