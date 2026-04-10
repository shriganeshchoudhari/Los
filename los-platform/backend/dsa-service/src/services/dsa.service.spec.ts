import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConflictException, NotFoundException, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { DSAService } from './dsa.service';
import {
  DSAPartner,
  DSAPartnerStatus,
  DSAPartnerType,
  DSAOfficer,
  DSAApplication,
  DSACommission,
  CommissionType,
} from '../entities/dsa.entity';
import { KafkaService } from '@los/common';
import { RegisterPartnerDto } from '../dto';
import * as crypto from 'crypto';

jest.mock('@los/common', () => ({
  KafkaService: jest.fn().mockImplementation(() => ({
    emit: jest.fn().mockResolvedValue(undefined),
  })),
  hashMobile: jest.fn((m: string) => crypto.createHash('sha256').update(m).digest('hex')),
  hashPan: jest.fn((p: string) => crypto.createHash('sha256').update(p).digest('hex')),
  maskMobile: jest.fn((m: string) => 'XXXXXX' + m.slice(-4)),
}));

describe('DSAService', () => {
  let service: DSAService;
  let partnerRepo: jest.Mocked<Repository<DSAPartner>>;
  let officerRepo: jest.Mocked<Repository<DSAOfficer>>;
  let applicationRepo: jest.Mocked<Repository<DSAApplication>>;
  let commissionRepo: jest.Mocked<Repository<DSACommission>>;
  let kafka: jest.Mocked<KafkaService>;

  const mockPartner: DSAPartner = {
    id: 'p1',
    partnerCode: 'DSAPL/MH/00001',
    partnerName: 'Test Advisors Pvt Ltd',
    partnerType: DSAPartnerType.PRIVATE_LIMITED,
    status: DSAPartnerStatus.PENDING_APPROVAL,
    panHash: 'panhash123',
    panEnc: Buffer.from('encrypted'),
    gstin: null,
    gstinHash: null,
    registeredAddress: '123 Main Rd, Mumbai',
    city: 'Mumbai',
    state: 'MH',
    pincode: '400001',
    contactName: 'Rajesh Kumar',
    contactMobile: '9876543210',
    contactEmail: 'rajesh@testadvisors.com',
    primaryBankAccount: 'SBIN1234567890',
    primaryIfsc: 'SBIN0001234',
    bankAccountHolder: 'Test Advisors Pvt Ltd',
    commissionType: CommissionType.HYBRID,
    upfrontCommissionBps: 100,
    trailCommissionBps: 50,
    payoutFrequency: 'MONTHLY',
    minLoanAmount: 50000,
    maxLoanAmount: 50000000,
    territoryCodes: ['MH'],
    allowedProducts: ['PL', 'BL'],
    agreementDocKey: null,
    agreementSignedAt: null,
    agreementValidFrom: null,
    agreementValidTo: null,
    totalDisbursedAmount: 0,
    totalApplications: 0,
    totalDisbursements: 0,
    totalCommissionPaid: 0,
    rejectedBy: null,
    rejectionReason: null,
    suspensionReason: null,
    remarks: null,
    onboardingOfficerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockApprovedPartner: DSAPartner = {
    ...mockPartner,
    id: 'p2',
    partnerCode: 'DSAPL/MH/00002',
    status: DSAPartnerStatus.APPROVED,
    upfrontCommissionBps: 150,
    trailCommissionBps: 75,
    agreementValidFrom: new Date('2024-01-01'),
    agreementValidTo: new Date('2025-01-01'),
    allowedProducts: ['PL', 'BL', 'HL'],
    minLoanAmount: 100000,
    maxLoanAmount: 100000000,
  };

  const mockOfficer: DSAOfficer = {
    id: 'o1',
    partnerId: 'p2',
    employeeCode: 'DSAPL/MH/00002-OFF001',
    fullName: 'John DSouza',
    mobileHash: 'hash123',
    mobileEnc: Buffer.from('encrypted'),
    emailHash: 'emailhash',
    emailEnc: Buffer.from('encrypted'),
    designation: 'Relationship Manager',
    department: 'Sales',
    status: 'ACTIVE',
    reportingManagerId: null,
    territoryCodes: ['MH', 'GJ'],
    allowedProducts: ['PL', 'BL'],
    maxSanctionAuthority: 5000000,
    totalApplications: 10,
    totalDisbursements: 3,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPartnerRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      increment: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    };

    const mockOfficerRepo = { ...mockPartnerRepo };
    const mockApplicationRepo = { ...mockPartnerRepo };
    const mockCommissionRepo = { ...mockPartnerRepo };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DSAService,
        { provide: getRepositoryToken(DSAPartner), useValue: mockPartnerRepo },
        { provide: getRepositoryToken(DSAOfficer), useValue: mockOfficerRepo },
        { provide: getRepositoryToken(DSAApplication), useValue: mockApplicationRepo },
        { provide: getRepositoryToken(DSACommission), useValue: mockCommissionRepo },
        { provide: DataSource, useValue: { createQueryRunner: jest.fn() } },
        { provide: KafkaService, useValue: new KafkaService() },
      ],
    }).compile();

    service = module.get<DSAService>(DSAService);
    partnerRepo = module.get(getRepositoryToken(DSAPartner));
    officerRepo = module.get(getRepositoryToken(DSAOfficer));
    applicationRepo = module.get(getRepositoryToken(DSAApplication));
    commissionRepo = module.get(getRepositoryToken(DSACommission));
    kafka = module.get(KafkaService);
  });

  describe('registerPartner', () => {
    const dto: RegisterPartnerDto = {
      partnerName: 'Test Advisors Pvt Ltd',
      partnerType: DSAPartnerType.PRIVATE_LIMITED,
      pan: 'AABCF1234F',
      registeredAddress: '123 Main Rd, Mumbai',
      city: 'Mumbai',
      state: 'MH',
      pincode: '400001',
      contactName: 'Rajesh Kumar',
      contactMobile: '9876543210',
      contactEmail: 'rajesh@testadvisors.com',
      primaryBankAccount: 'SBIN1234567890',
      primaryIfsc: 'SBIN0001234',
      bankAccountHolder: 'Test Advisors Pvt Ltd',
      allowedProducts: ['PL', 'BL'],
    };

    it('should register a new partner successfully', async () => {
      partnerRepo.findOne.mockResolvedValue(null);
      partnerRepo.count.mockResolvedValue(0);
      partnerRepo.create.mockReturnValue({ ...mockPartner, id: 'new-id' } as DSAPartner);
      partnerRepo.save.mockResolvedValue({ ...mockPartner, id: 'new-id', partnerCode: 'DSAPL/MH00001' } as DSAPartner);

      const result = await service.registerPartner(dto);

      expect(result.status).toBe(DSAPartnerStatus.PENDING_APPROVAL);
      expect(result.partnerId).toBe('new-id');
      expect(result.message).toContain('under review');
      expect(kafka.emit).toHaveBeenCalledWith('los.dsa.partner.registered', expect.objectContaining({ partnerCode: expect.any(String) }));
    });

    it('should reject duplicate PAN', async () => {
      partnerRepo.findOne.mockResolvedValue(mockPartner);

      await expect(service.registerPartner(dto)).rejects.toThrow(ConflictException);
      await expect(service.registerPartner(dto)).rejects.toThrow('PAN already exists');
    });

    it('should reject duplicate email', async () => {
      partnerRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockPartner);

      await expect(service.registerPartner(dto)).rejects.toThrow(ConflictException);
      await expect(service.registerPartner(dto)).rejects.toThrow('email already exists');
    });
  });

  describe('approvePartner', () => {
    it('should approve a pending partner with commission rates', async () => {
      const pendingPartner = { ...mockPartner, status: DSAPartnerStatus.PENDING_APPROVAL };
      partnerRepo.findOne.mockResolvedValue(pendingPartner);
      partnerRepo.save.mockResolvedValue({ ...pendingPartner, status: DSAPartnerStatus.APPROVED } as DSAPartner);

      const result = await service.approvePartner('p1', {
        status: DSAPartnerStatus.APPROVED,
        upfrontCommissionBps: 150,
        trailCommissionBps: 75,
      }, 'admin-id');

      expect(result.status).toBe(DSAPartnerStatus.APPROVED);
      expect(result.message).toContain('150bps');
      expect(kafka.emit).toHaveBeenCalledWith('los.dsa.partner.status_changed', expect.any(Object));
    });

    it('should reject a partner with reason', async () => {
      const pendingPartner = { ...mockPartner, status: DSAPartnerStatus.PENDING_APPROVAL };
      partnerRepo.findOne.mockResolvedValue(pendingPartner);
      partnerRepo.save.mockResolvedValue({ ...pendingPartner, status: DSAPartnerStatus.REJECTED } as DSAPartner);

      const result = await service.approvePartner('p1', {
        status: DSAPartnerStatus.REJECTED,
        rejectionReason: 'Incomplete documentation',
      }, 'admin-id');

      expect(result.status).toBe(DSAPartnerStatus.REJECTED);
      expect(result.message).toContain('Incomplete documentation');
    });

    it('should require rejection reason for rejection', async () => {
      partnerRepo.findOne.mockResolvedValue({ ...mockPartner, status: DSAPartnerStatus.PENDING_APPROVAL });

      await expect(
        service.approvePartner('p1', { status: DSAPartnerStatus.REJECTED }, 'admin-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent partner', async () => {
      partnerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.approvePartner('non-existent', { status: DSAPartnerStatus.APPROVED }, 'admin-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject if partner is already approved', async () => {
      partnerRepo.findOne.mockResolvedValue({ ...mockPartner, status: DSAPartnerStatus.APPROVED });

      await expect(
        service.approvePartner('p1', { status: DSAPartnerStatus.APPROVED }, 'admin-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('partnerLogin', () => {
    it('should login approved partner with valid credentials', async () => {
      partnerRepo.findOne.mockResolvedValue(mockApprovedPartner);

      const result = await service.partnerLogin({
        partnerCode: 'DSAPL/MH/00002',
        password: 'correct-password',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.partnerId).toBe('p2');
      expect(result.role).toBe('DSA_PARTNER');
    });

    it('should reject invalid partner code', async () => {
      partnerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.partnerLogin({ partnerCode: 'INVALID', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject non-approved partner', async () => {
      partnerRepo.findOne.mockResolvedValue({ ...mockPartner, status: DSAPartnerStatus.SUSPENDED });

      await expect(
        service.partnerLogin({ partnerCode: 'DSAPL/MH/00001', password: 'pass' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createApplication', () => {
    const appDto = {
      customerName: 'Priya Patel',
      customerMobile: '9876543210',
      customerPan: 'ABCDE1234F',
      loanType: 'PL',
      requestedAmount: 500000,
      requestedTenureMonths: 36,
    };

    it('should create application for approved partner', async () => {
      partnerRepo.findOne.mockResolvedValue(mockApprovedPartner);
      officerRepo.findOne.mockResolvedValue(mockOfficer);
      applicationRepo.findOne.mockResolvedValue(null);
      applicationRepo.count.mockResolvedValue(0);
      applicationRepo.create.mockReturnValue({ id: 'app1', applicationNumber: 'DSA-PL-2024-0000001' } as DSAApplication);
      applicationRepo.save.mockResolvedValue({ id: 'app1', applicationNumber: 'DSA-PL-2024-0000001', status: 'SUBMITTED' } as DSAApplication);

      const result = await service.createApplication('p2', 'o1', appDto);

      expect(result.applicationNumber).toContain('DSA-PL');
      expect(result.status).toBe('SUBMITTED');
      expect(partnerRepo.increment).toHaveBeenCalledWith({ id: 'p2' }, 'totalApplications', 1);
      expect(kafka.emit).toHaveBeenCalledWith('los.dsa.application.created', expect.any(Object));
    });

    it('should reject if loan type not allowed', async () => {
      partnerRepo.findOne.mockResolvedValue(mockApprovedPartner);
      officerRepo.findOne.mockResolvedValue(mockOfficer);

      await expect(
        service.createApplication('p2', 'o1', { ...appDto, loanType: 'TL' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if amount below minimum', async () => {
      partnerRepo.findOne.mockResolvedValue(mockApprovedPartner);
      officerRepo.findOne.mockResolvedValue(mockOfficer);

      await expect(
        service.createApplication('p2', 'o1', { ...appDto, requestedAmount: 10000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if agreement expired', async () => {
      const expiredPartner = {
        ...mockApprovedPartner,
        agreementValidFrom: new Date('2020-01-01'),
        agreementValidTo: new Date('2021-01-01'),
      };
      partnerRepo.findOne.mockResolvedValue(expiredPartner);
      officerRepo.findOne.mockResolvedValue(mockOfficer);

      await expect(service.createApplication('p2', 'o1', appDto)).rejects.toThrow(ForbiddenException);
    });

    it('should reject duplicate active application for same customer', async () => {
      partnerRepo.findOne.mockResolvedValue(mockApprovedPartner);
      officerRepo.findOne.mockResolvedValue(mockOfficer);
      applicationRepo.findOne.mockResolvedValue({ id: 'existing', applicationNumber: 'DSA-PL-2024-0000001' } as DSAApplication);

      await expect(service.createApplication('p2', 'o1', appDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('createOfficer', () => {
    const officerDto = {
      fullName: 'John DSouza',
      mobile: '9876543210',
      email: 'john@test.com',
      designation: 'Relationship Manager',
      department: 'Sales',
      territoryCodes: ['MH', 'GJ'],
      allowedProducts: ['PL', 'BL'],
      maxSanctionAuthority: 5000000,
    };

    it('should create officer for approved partner', async () => {
      partnerRepo.findOne.mockResolvedValue(mockApprovedPartner);
      officerRepo.findOne.mockResolvedValue(null);
      officerRepo.count.mockResolvedValue(0);
      officerRepo.create.mockReturnValue({ id: 'o1', employeeCode: 'DSAPL/MH/00002-OFF001', status: 'ACTIVE' } as DSAOfficer);
      officerRepo.save.mockResolvedValue({ id: 'o1', employeeCode: 'DSAPL/MH/00002-OFF001', status: 'ACTIVE' } as DSAOfficer);

      const result = await service.createOfficer('p2', officerDto, 'partner-admin');

      expect(result.employeeCode).toContain('DSAPL');
      expect(result.fullName).toBe('John DSouza');
      expect(kafka.emit).toHaveBeenCalledWith('los.dsa.officer.created', expect.any(Object));
    });

    it('should reject if partner not approved', async () => {
      partnerRepo.findOne.mockResolvedValue({ ...mockPartner, status: DSAPartnerStatus.SUSPENDED });

      await expect(service.createOfficer('p1', officerDto, 'admin')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPartnerDashboard', () => {
    it('should return complete dashboard data', async () => {
      partnerRepo.findOne.mockResolvedValue({ ...mockApprovedPartner, totalApplications: 50, totalDisbursedAmount: 50000000, totalCommissionPaid: 500000 } as DSAPartner);
      applicationRepo.find.mockResolvedValue([
        { id: '1', status: 'SUBMITTED' },
        { id: '2', status: 'APPROVED' },
        { id: '3', status: 'DISBURSED' },
        { id: '4', status: 'REJECTED' },
        { id: '5', status: 'DISBURSED' },
      ] as DSAApplication[]);
      commissionRepo.find.mockResolvedValue([
        { id: '1', commissionAmount: 50000, netPayable: 45000, status: 'EARNED', disbursementDate: new Date() },
        { id: '2', commissionAmount: 30000, netPayable: 27000, status: 'PAID', disbursementDate: new Date() },
      ] as DSACommission[]);
      officerRepo.find.mockResolvedValue([
        { ...mockOfficer, totalApplications: 20, totalDisbursements: 5 },
      ] as DSAOfficer[]);

      const result = await service.getPartnerDashboard('p2');

      expect(result.totalApplications).toBe(50);
      expect(result.totalDisbursedAmount).toBe(50000000);
      expect(result.totalCommissionEarned).toBe(80000);
      expect(result.pendingCommission).toBe(45000);
      expect(result.submittedApplications).toBe(5);
      expect(result.disbursedApplications).toBe(2);
      expect(result.officerStats).toHaveLength(1);
    });

    it('should throw NotFoundException for non-existent partner', async () => {
      partnerRepo.findOne.mockResolvedValue(null);

      await expect(service.getPartnerDashboard('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCommissionSummary', () => {
    it('should aggregate commission data correctly', async () => {
      commissionRepo.find.mockResolvedValue([
        { id: '1', commissionAmount: 50000, tdsAmount: 5000, gstAmount: 9000, netPayable: 45000, status: 'EARNED', disbursementDate: new Date(), processedAt: null },
        { id: '2', commissionAmount: 30000, tdsAmount: 3000, gstAmount: 5400, netPayable: 27000, status: 'PAID', disbursementDate: new Date(), processedAt: new Date() },
        { id: '3', commissionAmount: 20000, tdsAmount: 2000, gstAmount: 3600, netPayable: 18000, status: 'PAID', disbursementDate: new Date(), processedAt: new Date() },
      ] as DSACommission[]);

      const result = await service.getCommissionSummary('p2');

      expect(result.totalEarned).toBe(100000);
      expect(result.totalTDS).toBe(10000);
      expect(result.totalGST).toBe(18000);
      expect(result.totalPaid).toBe(45000);
      expect(result.pendingPayout).toBe(45000);
      expect(result.lastPayoutAmount).toBe(27000);
    });
  });

  describe('recordDisbursementCommission', () => {
    it('should record commission on disbursement event', async () => {
      applicationRepo.findOne.mockResolvedValue({ id: 'app1', partnerId: 'p2', officerId: 'o1', applicationNumber: 'DSA-PL-2024-0000001' } as DSAApplication);
      partnerRepo.findOne.mockResolvedValue({ ...mockApprovedPartner, upfrontCommissionBps: 150 } as DSAPartner);
      commissionRepo.findOne.mockResolvedValue(null);
      commissionRepo.create.mockReturnValue({ id: 'comm1', commissionAmount: 75000 } as DSACommission);
      commissionRepo.save.mockResolvedValue({ id: 'comm1', commissionAmount: 75000 } as DSACommission);

      await service.recordDisbursementCommission('app1', 'loan-app-1', 'PL', 5000000, new Date());

      expect(commissionRepo.save).toHaveBeenCalled();
      expect(partnerRepo.increment).toHaveBeenCalledWith({ id: 'p2' }, 'totalDisbursements', 1);
      expect(partnerRepo.increment).toHaveBeenCalledWith({ id: 'p2' }, 'totalDisbursedAmount', 5000000);
      expect(kafka.emit).toHaveBeenCalledWith('los.dsa.commission.earned', expect.objectContaining({ commissionAmount: 75000 }));
    });

    it('should not record duplicate commission', async () => {
      applicationRepo.findOne.mockResolvedValue({ id: 'app1', partnerId: 'p2', officerId: 'o1' } as DSAApplication);
      commissionRepo.findOne.mockResolvedValue({ id: 'existing' } as DSACommission);

      await service.recordDisbursementCommission('app1', 'loan-app-1', 'PL', 5000000, new Date());

      expect(commissionRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('processCommissionPayout', () => {
    it('should process payout for all earned commissions in month', async () => {
      commissionRepo.find.mockResolvedValue([
        { id: 'c1', netPayable: 45000, status: 'EARNED' },
        { id: 'c2', netPayable: 30000, status: 'EARNED' },
      ] as DSACommission[]);
      commissionRepo.update.mockResolvedValue({} as any);

      const result = await service.processCommissionPayout('p2', '2024-07', 'admin');

      expect(result.count).toBe(2);
      expect(result.totalAmount).toBe(75000);
      expect(commissionRepo.update).toHaveBeenCalledWith(
        { id: expect.anything(), status: 'EARNED', payoutMonth: '2024-07' },
        { status: 'PAID', processedAt: expect.any(Date), processedBy: 'admin' },
      );
      expect(partnerRepo.increment).toHaveBeenCalledWith({ id: 'p2' }, 'totalCommissionPaid', 75000);
      expect(kafka.emit).toHaveBeenCalledWith('los.dsa.commission.paid', expect.any(Object));
    });

    it('should return zero if no pending commissions', async () => {
      commissionRepo.find.mockResolvedValue([]);

      const result = await service.processCommissionPayout('p2', '2024-07', 'admin');

      expect(result.count).toBe(0);
      expect(result.totalAmount).toBe(0);
    });
  });
});
