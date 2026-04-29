import { Injectable, BadRequestException } from '@nestjs/common';
import { UtxoInput } from '../transaction/transaction.entity';
import { WalletType } from '../wallet/wallet.entity';
import * as crypto from 'crypto';

@Injectable()
export class PsbtBuilderService {
  async buildBtcPsbt(
    inputs: UtxoInput[],
    destination: string,
    amountSats: number,
    changeAddress: string,
    network: 'bitcoin-testnet' | 'bitcoin-mainnet',
  ): Promise<string> {
    if (inputs.length === 0) {
      throw new BadRequestException('PSBT requires at least one input');
    }

    const psbt = this.createPsbtSkeleton(network);
    for (const utxo of inputs) {
      this.addInput(psbt, utxo, network);
    }
    this.addOutput(psbt, destination, amountSats);
    this.addOutput(psbt, changeAddress, 0);

    return this.serializePsbt(psbt);
  }

  private createPsbtSkeleton(network: string): any {
    return {
      globalMap: {
        xpubs: [],
        unknown: {},
      },
      inputs: [],
      outputs: [],
      network,
    };
  }

  private addInput(psbt: any, utxo: UtxoInput, network: string): void {
    psbt.inputs.push({
      nonWitnessUtxo: this.buildMockTx(utxo, network),
      sighashType: 1,
      derivationPath: utxo.derivationPath,
    });
  }

  private addOutput(psbt: any, address: string, amountSats: number): void {
    psbt.outputs.push({
      address,
      amountSats,
      derivationPath: null,
    });
  }

  private buildMockTx(utxo: UtxoInput, network: string): Buffer {
    const version = Buffer.alloc(4);
    version.writeUInt32LE(2, 0);

    const inputsCount = Buffer.from([1]);
    const prevoutHash = Buffer.from(utxo.txid, 'hex').reverse();
    const prevoutIndex = Buffer.alloc(4);
    prevoutIndex.writeUInt32LE(utxo.vout, 0);
    const sequence = Buffer.from('ffffffff', 'hex');
    const outputsCount = Buffer.from([1]);
    const amountBuf = Buffer.alloc(8);
    amountBuf.writeBigUInt64LE(BigInt(utxo.satoshis), 0);
    const scriptPubKey = this.addressToScriptPubKey('bc1qtestnet', network);
    const locktime = Buffer.alloc(4);

    const txBuffer = Buffer.concat([
      version,
      inputsCount,
      prevoutHash,
      prevoutIndex,
      sequence,
      outputsCount,
      amountBuf,
      scriptPubKey,
      locktime,
    ]);

    const hash = crypto.createHash('sha256').update(crypto.createHash('sha256').update(txBuffer).digest()).digest();
    const txid = hash.reverse().toString('hex');

    return Buffer.from(txid + '00000000', 'hex');
  }

  private addressToScriptPubKey(address: string, network: string): Buffer {
    if (address.startsWith('bc1')) {
      return Buffer.from('0014' + '00'.repeat(20), 'hex');
    }
    return Buffer.from('a9' + '14' + '00'.repeat(20), 'hex');
  }

  private serializePsbt(psbt: any): string {
    const psbtBase = JSON.stringify(psbt);
    return Buffer.from(psbtBase).toString('base64');
  }

  computePayloadHash(payload: object): string {
    const canonical = JSON.stringify(payload, Object.keys(payload).sort());
    return 'sha256:' + crypto.createHash('sha256').update(canonical).digest('hex');
  }

  async validateDestination(address: string, network: string): Promise<boolean> {
    const testnetBech32 = /^tb1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{11,71}$/;
    const mainnetBech32 = /^bc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{11,71}$/;
    const testnetP2PKH = /^m[a-km-zA-HJ-NP-Z1-9]{33}$/;
    const testnetP2SH = /^2[a-km-zA-HJ-NP-Z1-9]{32,34}$/;
    const mainnetP2PKH = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
    const mainnetP2SH = /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/;

    if (network === 'bitcoin-testnet') {
      return testnetBech32.test(address) || testnetP2PKH.test(address) || testnetP2SH.test(address);
    }
    return mainnetBech32.test(address) || mainnetP2PKH.test(address) || mainnetP2SH.test(address);
  }
}