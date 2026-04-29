import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PsbtBuilderService } from '../src/transaction-builder/psbt-builder.service';
import { UtxoInput } from '../src/transaction/transaction.entity';

describe('PsbtBuilderService', () => {
  let service: PsbtBuilderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PsbtBuilderService],
    }).compile();

    service = module.get<PsbtBuilderService>(PsbtBuilderService);
  });

  describe('buildBtcPsbt', () => {
    it('builds a PSBT base64 string from valid inputs', async () => {
      const inputs: UtxoInput[] = [
        { txid: 'abcd1234'.repeat(16), vout: 0, satoshis: 50000000, address: 'bc1qtestnet123456789abcdef' },
      ];

      const result = await service.buildBtcPsbt(
        inputs,
        'bc1qtestnet987654321fedcba',
        10000000,
        'bc1qtestnet1111111111111111',
        'bitcoin-testnet',
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      const decoded = Buffer.from(result, 'base64').toString('utf8');
      expect(decoded).toContain('globalMap');
    });

    it('throws BadRequestException when no inputs provided', async () => {
      await expect(
        service.buildBtcPsbt([], 'bc1qdest', 1000, 'bc1qchange', 'bitcoin-testnet'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('computePayloadHash', () => {
    it('produces a stable sha256 hash prefixed with sha256:', () => {
      const payload = { a: 1, b: 2 };
      const hash1 = service.computePayloadHash(payload);
      const hash2 = service.computePayloadHash(payload);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('produces different hash for different payloads', () => {
      const hash1 = service.computePayloadHash({ a: 1 });
      const hash2 = service.computePayloadHash({ a: 2 });

      expect(hash1).not.toBe(hash2);
    });

    it('is deterministic regardless of key order', () => {
      const hash1 = service.computePayloadHash({ b: 2, a: 1 });
      const hash2 = service.computePayloadHash({ a: 1, b: 2 });

      expect(hash1).toBe(hash2);
    });

    it('includes nested UTXO fields in the hash', () => {
      const hash1 = service.computePayloadHash({ utxoInputs: [{ txid: 'abc', vout: 0 }] });
      const hash2 = service.computePayloadHash({ utxoInputs: [{ txid: 'abc', vout: 1 }] });

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('validateDestination', () => {
    it('accepts valid bech32 testnet address', async () => {
      const result = await service.validateDestination(
        'tb1q9nzuyc2hsplr3ka0hygt3f0eksr22sv0ph9rp9',
        'bitcoin-testnet',
      );
      expect(result).toBe(true);
    });

    it('accepts valid testnet P2SH address', async () => {
      const result = await service.validateDestination(
        '2Mwm3K5CNZ3uqpnp9V4cmvVQCvG4gPXLbhj',
        'bitcoin-testnet',
      );
      expect(result).toBe(true);
    });

    it('rejects invalid address', async () => {
      const result = await service.validateDestination('not-an-address', 'bitcoin-testnet');
      expect(result).toBe(false);
    });
  });
});
