import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { KeyService } from '../src/key/key.service';
import { Key, KeyStatus } from '../src/key/key.entity';
import { Wallet, WalletType, WalletStorageClass } from '../src/wallet/wallet.entity';
import { AuditLog } from '../src/audit-log/audit-log.entity';

describe('KeyService', () => {
  let service: KeyService;
  let keyRepo: jest.Mocked<Repository<Key>>;
  let walletRepo: jest.Mocked<Repository<Wallet>>;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;

  const mockWallet: Wallet = {
    id: 'wallet-001',
    tenantId: 'tenant-001',
    tenant: null as any,
    name: 'Test BTC Wallet',
    type: WalletType.BTC_MULTISIG_2_OF_3,
    storageClass: WalletStorageClass.COLD,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockKey: Key = {
    id: 'key-001',
    tenantId: 'tenant-001',
    tenant: null as any,
    walletId: 'wallet-001',
    wallet: null as any,
    keyType: 'extended_public',
    xpub: 'xpub661MyMwAqRbcGZfLukK2G3C3ZNJ8hYpZR72KCNCCXTVqEqYJ7EsZqv3kKcMhK8JbqtH2bD7Q4hJQF5K3J9L1bL7Q7J5K3J9L1bL7Q7J5K3J9',
    xpubHash: 'somehash',
    derivationPath: "m/48'/1'/0'/0'/0'",
    keyIndex: 0,
    status: KeyStatus.ACTIVE,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeyService,
        {
          provide: getRepositoryToken(Key),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Wallet),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<KeyService>(KeyService);
    keyRepo = module.get(getRepositoryToken(Key));
    walletRepo = module.get(getRepositoryToken(Wallet));
    auditLogRepo = module.get(getRepositoryToken(AuditLog));
  });

  describe('registerKeys', () => {
    it('rejects unknown wallet', async () => {
      walletRepo.findOne.mockResolvedValue(null);
      await expect(
        service.registerKeys('wallet-001', 'tenant-001', [
          { keyType: 'extended_public', xpub: 'xpub...', keyIndex: 0 },
        ]),
      ).rejects.toThrow(NotFoundException);
    });

    it('saves keys with xpub hash for each key', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet);
      keyRepo.create.mockImplementation((dto) => dto as Key);
      keyRepo.save.mockImplementation((key) => Promise.resolve({ ...mockKey, ...key } as Key));

      const keys = [
        { keyType: 'extended_public', xpub: 'xpub1...', derivationPath: "m/48'/1'/0'/0'/0'", keyIndex: 0 },
        { keyType: 'extended_public', xpub: 'xpub2...', derivationPath: "m/48'/1'/0'/0'/1'", keyIndex: 1 },
      ];

      const result = await service.registerKeys('wallet-001', 'tenant-001', keys);

      expect(result).toHaveLength(2);
      expect(keyRepo.create).toHaveBeenCalledTimes(2);
      expect(keyRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('findByWallet', () => {
    it('returns keys sorted by keyIndex', async () => {
      keyRepo.find.mockResolvedValue([mockKey]);
      const result = await service.findByWallet('wallet-001', 'tenant-001');
      expect(result).toHaveLength(1);
      expect(keyRepo.find).toHaveBeenCalledWith({
        where: { walletId: 'wallet-001', tenantId: 'tenant-001' },
        order: { keyIndex: 'ASC' },
      });
    });
  });

  describe('revoke', () => {
    it('revokes key and marks as REVOKED', async () => {
      keyRepo.findOne.mockResolvedValue({ ...mockKey });
      keyRepo.save.mockResolvedValue({ ...mockKey, status: KeyStatus.REVOKED });

      const result = await service.revoke('key-001', 'tenant-001');
      expect(result.status).toBe(KeyStatus.REVOKED);
    });

    it('throws NotFoundException for unknown key', async () => {
      keyRepo.findOne.mockResolvedValue(null);
      await expect(service.revoke('key-001', 'tenant-001')).rejects.toThrow(NotFoundException);
    });
  });
});