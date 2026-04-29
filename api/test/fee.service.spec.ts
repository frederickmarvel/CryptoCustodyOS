import { Test, TestingModule } from '@nestjs/testing';
import { FeeService } from '../src/transaction-builder/fee.service';
import { FeePolicy } from '../src/transaction/transaction.entity';

describe('FeeService', () => {
  let service: FeeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeeService],
    }).compile();

    service = module.get<FeeService>(FeeService);
  });

  describe('estimateFee', () => {
    it('returns HIGH fee policy with higher sat/vbyte', async () => {
      const result = await service.estimateFee(2, 2, FeePolicy.HIGH);
      expect(result.feePolicy).toBe(FeePolicy.HIGH);
      expect(result.satPerVb).toBe(30);
      expect(result.totalFee).toBeDefined();
    });

    it('returns LOW fee policy with lower sat/vbyte', async () => {
      const result = await service.estimateFee(2, 2, FeePolicy.LOW);
      expect(result.satPerVb).toBe(5);
      expect(parseInt(result.totalFee)).toBeLessThan(parseInt((await service.estimateFee(2, 2, FeePolicy.HIGH)).totalFee));
    });

    it('uses custom satPerVb when provided', async () => {
      const result = await service.estimateFee(1, 1, FeePolicy.CUSTOM, 50);
      expect(result.satPerVb).toBe(50);
      expect(result.feePolicy).toBe(FeePolicy.CUSTOM);
    });

    it('calculates fee based on estimated vbytes', async () => {
      const result = await service.estimateFee(2, 2, FeePolicy.MEDIUM);
      expect(result.estimatedBytes).toBeGreaterThan(0);
      const expected = Math.ceil(result.estimatedBytes * 15);
      expect(parseInt(result.totalFee)).toBe(expected);
    });
  });

  describe('estimateVBytes', () => {
    it('returns reasonable byte estimate for single input, two outputs', () => {
      const vbytes = service.estimateVBytes(1, 2);
      expect(vbytes).toBeGreaterThan(0);
      expect(vbytes).toBeLessThan(1000);
    });

    it('scales linearly with input count', () => {
      const one = service.estimateVBytes(1, 2);
      const three = service.estimateVBytes(3, 2);
      expect(three).toBeGreaterThan(one);
    });

    it('scales linearly with output count', () => {
      const oneOut = service.estimateVBytes(1, 1);
      const threeOut = service.estimateVBytes(1, 3);
      expect(threeOut).toBeGreaterThan(oneOut);
    });
  });
});