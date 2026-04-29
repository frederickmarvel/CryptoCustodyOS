import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AddressService } from '../src/address/address.service';
import { Address, AddressStatus } from '../src/address/address.entity';
import { Key } from '../src/key/key.entity';
import { Wallet, WalletType, WalletStorageClass } from '../src/wallet/wallet.entity';
import { AuditLog } from '../src/audit-log/audit-log.entity';

describe('AddressService', () => {
  let service: AddressService;
  let addressRepo: jest.Mocked<Repository<Address>>;
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressService,
        {
          provide: getRepositoryToken(Address),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Key),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
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

    service = module.get<AddressService>(AddressService);
    addressRepo = module.get(getRepositoryToken(Address));
    walletRepo = module.get(getRepositoryToken(Wallet));
    auditLogRepo = module.get(getRepositoryToken(AuditLog));
  });

  describe('BTC address validation', () => {
    it('accepts valid bech32 testnet address', async () => {
      const result = await (service as any).validateBtcTestnetAddress(
        'tb1q9nzuyc2hsplr3ka0hygt3f0eksr22sv0ph9rp9',
      );
      expect(result).toBeUndefined();
    });

    it('accepts valid testnet P2PKH address', async () => {
      const result = await (service as any).validateBtcTestnetAddress(
        'mrbV7NjcKkiy2JNPVgCLN2qT7GqYbLm6qK',
      );
      expect(result).toBeUndefined();
    });

    it('accepts valid testnet P2SH address', async () => {
      const result = await (service as any).validateBtcTestnetAddress(
        '2Mwm3K5CNZ3uqpnp9V4cmvVQCvG4gPXLbhj',
      );
      expect(result).toBeUndefined();
    });

    it('rejects invalid address format', async () => {
      await expect(
        (service as any).validateBtcTestnetAddress('invalid-address'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects mainnet bech32 address', async () => {
      await expect(
        (service as any).validateBtcTestnetAddress(
          'bc1q9nzuyc2hsplr3ka0hygt3f0eksr22sv0ph9rp9',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects derivation path not following BIP-48', async () => {
      await expect(
        (service as any).validateBtcTestnetAddress(
          'tb1q9nzuyc2hsplr3ka0hygt3f0eksr22sv0ph9rp9',
          "m/44'/0'/0'/0/0",
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verify BTC address', () => {
    it('returns valid for valid bech32 testnet address', () => {
      const result = (service as any).verifyBtcTestnetAddress(
        'tb1q9nzuyc2hsplr3ka0hygt3f0eksr22sv0ph9rp9',
      );
      expect(result.valid).toBe(true);
    });

    it('returns invalid for malformed address', () => {
      const result = (service as any).verifyBtcTestnetAddress('not-valid');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid BTC testnet');
    });

    it('returns invalid for wrong derivation path format', () => {
      const result = (service as any).verifyBtcTestnetAddress(
        'tb1q9nzuyc2hsplr3ka0hygt3f0eksr22sv0ph9rp9',
        "m/44'/0'/0'/0/0",
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('BIP-48');
    });
  });

  describe('create address', () => {
    it('rejects wallet not found', async () => {
      walletRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create('wallet-001', 'tenant-001', {
          address: 'tb1q9nzuyc2hsplr3ka0hygt3f0eksr22sv0ph9rp9',
          chainSymbol: 'BTC',
          network: 'bitcoin-testnet',
        }),
      ).rejects.toThrow();
    });

    it('creates address with audit log', async () => {
      const mockSavedAddress = {
        id: 'addr-001',
        tenantId: 'tenant-001',
        walletId: 'wallet-001',
        address: 'tb1q9nzuyc2hsplr3ka0hygt3f0eksr22sv0ph9rp9',
        derivationPath: null,
        derivationIndex: 0,
        chainSymbol: 'BTC',
        network: 'bitcoin-testnet',
        status: AddressStatus.ACTIVE,
        createdAt: new Date(),
      } as Address;

      walletRepo.findOne.mockResolvedValue(mockWallet);
      addressRepo.count.mockResolvedValue(0);
      addressRepo.create.mockReturnValue(mockSavedAddress);
      addressRepo.save.mockResolvedValue(mockSavedAddress);
      auditLogRepo.create.mockReturnValue({} as AuditLog);
      auditLogRepo.save.mockResolvedValue({} as AuditLog);

      const result = await service.create('wallet-001', 'tenant-001', {
        address: 'tb1q9nzuyc2hsplr3ka0hygt3f0eksr22sv0ph9rp9',
        chainSymbol: 'BTC',
        network: 'bitcoin-testnet',
      });

      expect(result).toEqual(mockSavedAddress);
      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'ADDRESS_CREATED' }),
      );
    });
  });

  describe('findAllByWallet', () => {
    it('throws NotFoundException for unknown wallet', async () => {
      walletRepo.findOne.mockResolvedValue(null);
      await expect(
        service.findAllByWallet('wallet-001', 'tenant-001'),
      ).rejects.toThrow();
    });
  });
});