import { Test, TestingModule } from '@nestjs/testing';
import { UtxoService } from '../src/transaction-builder/utxo.service';

describe('UtxoService', () => {
  let service: UtxoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UtxoService],
    }).compile();

    service = module.get<UtxoService>(UtxoService);
  });

  describe('selectUtxos', () => {
    it('selects UTXOs that meet the target amount', async () => {
      const utxos = [
        { txid: 'a', vout: 0, satoshis: 30000, address: 'addr1', confirmations: 6 },
        { txid: 'b', vout: 0, satoshis: 50000, address: 'addr2', confirmations: 6 },
        { txid: 'c', vout: 0, satoshis: 20000, address: 'addr3', confirmations: 6 },
      ];

      const result = await service.selectUtxos(utxos, 60000);

      expect(result.selected.length).toBeGreaterThan(0);
      const total = result.selected.reduce((sum, u) => sum + u.satoshis, 0);
      expect(total).toBeGreaterThanOrEqual(60000);
    });

    it('sorts by largest satoshis first', async () => {
      const utxos = [
        { txid: 'small', vout: 0, satoshis: 10000, address: 'addr1', confirmations: 6 },
        { txid: 'large', vout: 0, satoshis: 500000, address: 'addr2', confirmations: 6 },
      ];

      const result = await service.selectUtxos(utxos, 20000);
      expect(result.selected[0].txid).toBe('large');
    });

    it('throws when insufficient UTXOs', async () => {
      const utxos = [
        { txid: 'a', vout: 0, satoshis: 1000, address: 'addr1', confirmations: 6 },
      ];

      await expect(service.selectUtxos(utxos, 100000)).rejects.toThrow('Insufficient UTXOs');
    });

    it('returns correct change amount', async () => {
      const utxos = [
        { txid: 'a', vout: 0, satoshis: 100000, address: 'addr1', confirmations: 6 },
      ];

      const result = await service.selectUtxos(utxos, 30000);
      expect(result.change).toBe(70000);
    });
  });
});