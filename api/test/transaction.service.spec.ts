import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditEventType } from '../src/audit-log/audit-log.entity';
import { Address } from '../src/address/address.entity';
import { PsbtBuilderService } from '../src/transaction-builder/psbt-builder.service';
import { FeeService } from '../src/transaction-builder/fee.service';
import { UtxoService } from '../src/transaction-builder/utxo.service';
import { ImportSignedPayloadDto } from '../src/transaction/dto/transaction-payload.dto';
import { Asset, FeePolicy, TransactionRequest, TransactionState } from '../src/transaction/transaction.entity';
import { TransactionService } from '../src/transaction/transaction.service';
import { Wallet } from '../src/wallet/wallet.entity';

function makeApprovedTx(overrides: Partial<TransactionRequest> = {}): TransactionRequest {
  return {
    id: 'tx-001',
    tenantId: 'tenant-001',
    walletId: 'wallet-001',
    createdBy: 'user-creator',
    amount: '0.1',
    asset: Asset.BTC,
    chainSymbol: 'BTC',
    network: 'bitcoin-testnet',
    destination: 'tb1q9nzuyc2hsplr3ka0hygt3f0eksr22sv0ph9rp9',
    state: TransactionState.APPROVED,
    payloadHash: 'sha256:' + 'a'.repeat(64),
    unsignedPayload: {
      version: '1.0',
      txRequestId: 'tx-001',
      tenantId: 'tenant-001',
      walletId: 'wallet-001',
      asset: Asset.BTC,
      amount: '0.1',
      destination: 'tb1q9nzuyc2hsplr3ka0hygt3f0eksr22sv0ph9rp9',
      network: 'bitcoin-testnet',
      feePolicy: FeePolicy.MEDIUM,
      networkFee: '1000',
      utxoInputs: [],
      changeAddress: 'tb1q9nzuyc2hsplr3ka0hygt3f0eksr22sv0ph9rp9',
      createdAt: '2026-04-29T00:00:00.000Z',
    },
    feePolicy: FeePolicy.MEDIUM,
    networkFee: '1000',
    utxoInputs: [],
    payloadLockedAt: new Date(),
    btcPsbtBase64: Buffer.from('{}').toString('base64'),
    signedPayload: null,
    signedPayloadHash: null,
    signerKeyIds: null,
    signedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isPayloadLocked: () => true,
    ...overrides,
  } as TransactionRequest;
}

function makeSignedDto(overrides: Partial<ImportSignedPayloadDto> = {}): ImportSignedPayloadDto {
  return {
    version: '1.0',
    payloadHash: 'sha256:' + 'a'.repeat(64),
    keyId: 'key_001',
    signerFingerprint: 'abcd1234',
    signedPsbtBase64: Buffer.from('{"partialSignatures":[]}').toString('base64'),
    signatureCount: 1,
    signatures: [
      {
        keyId: 'key_001',
        fingerprint: 'abcd1234',
        publicKey: '02' + 'b'.repeat(64),
        derivationPath: "m/48'/1'/0'/2'",
        payloadSignature: '3044',
        psbtDigest: 'c'.repeat(64),
        signedAt: '2026-04-29T00:00:00Z',
      },
    ],
    signedAt: '2026-04-29T00:00:00Z',
    ...overrides,
  };
}

describe('TransactionService signed payload import', () => {
  let service: TransactionService;
  let txRepo: jest.Mocked<Repository<TransactionRequest>>;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        { provide: getRepositoryToken(TransactionRequest), useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn(), find: jest.fn() } },
        { provide: getRepositoryToken(Wallet), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Address), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(AuditLog), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: UtxoService, useValue: { selectUtxos: jest.fn() } },
        { provide: FeeService, useValue: { estimateFee: jest.fn() } },
        { provide: PsbtBuilderService, useValue: { computePayloadHash: jest.fn(() => 'sha256:' + 'd'.repeat(64)) } },
      ],
    }).compile();

    service = module.get(TransactionService);
    txRepo = module.get(getRepositoryToken(TransactionRequest));
    auditLogRepo = module.get(getRepositoryToken(AuditLog));
    txRepo.save.mockImplementation(async (tx) => tx as TransactionRequest);
    auditLogRepo.create.mockImplementation((audit) => audit as AuditLog);
    auditLogRepo.save.mockResolvedValue({} as AuditLog);
  });

  it('imports a partial signature and moves transaction to PARTIALLY_SIGNED', async () => {
    txRepo.findOne.mockResolvedValue(makeApprovedTx());

    const result = await service.importSignedPayload('tx-001', 'tenant-001', makeSignedDto());

    expect(result.state).toBe(TransactionState.PARTIALLY_SIGNED);
    expect(result.signerKeyIds).toEqual(['key_001']);
    expect(result.signedPayload?.payloadHash).toBe('sha256:' + 'a'.repeat(64));
    expect(auditLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventType.SIGNED_PAYLOAD_IMPORTED,
        actorId: 'key_001',
        actorType: 'offline_signer',
      }),
    );
  });

  it('marks transaction SIGNED after enough signatures are imported', async () => {
    txRepo.findOne.mockResolvedValue(makeApprovedTx());

    const result = await service.importSignedPayload(
      'tx-001',
      'tenant-001',
      makeSignedDto({ signatureCount: 2 }),
    );

    expect(result.state).toBe(TransactionState.SIGNED);
  });

  it('rejects signed payloads whose payload hash does not match', async () => {
    txRepo.findOne.mockResolvedValue(makeApprovedTx());

    await expect(
      service.importSignedPayload(
        'tx-001',
        'tenant-001',
        makeSignedDto({ payloadHash: 'sha256:' + 'f'.repeat(64) }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects imports before approval', async () => {
    txRepo.findOne.mockResolvedValue(makeApprovedTx({ state: TransactionState.PENDING_APPROVAL }));

    await expect(
      service.importSignedPayload('tx-001', 'tenant-001', makeSignedDto()),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects duplicate signer key imports', async () => {
    txRepo.findOne.mockResolvedValue(makeApprovedTx({ signerKeyIds: ['key_001'] }));

    await expect(
      service.importSignedPayload('tx-001', 'tenant-001', makeSignedDto()),
    ).rejects.toThrow(ConflictException);
  });

  it('only exports signer envelopes after approval', async () => {
    txRepo.findOne.mockResolvedValue(makeApprovedTx({ state: TransactionState.PENDING_APPROVAL }));

    await expect(
      service.getUnsignedPayload('tx-001', 'tenant-001'),
    ).rejects.toThrow(ConflictException);
  });

  it('exports signer envelope with hash and BTC PSBT after approval', async () => {
    txRepo.findOne.mockResolvedValue(makeApprovedTx());

    const envelope = await service.getUnsignedPayload('tx-001', 'tenant-001');

    expect(envelope).toEqual(
      expect.objectContaining({
        txRequestId: 'tx-001',
        payloadHash: 'sha256:' + 'a'.repeat(64),
        btcPsbtBase64: Buffer.from('{}').toString('base64'),
      }),
    );
  });
});
