import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, QueryRunner } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Kafka } from 'kafkajs';
import { LoanApplicationService } from '../services/loan-application.service';
import {
  LoanApplication,
  ApplicationStageHistory,
  ApplicationStatus,
  LoanType,
  ChannelCode,
} from '../entities';
import { CreateApplicationDto } from '../dto';
import { createError, hashPan } from '@los/common';

describe('LoanApplicationService', () => {
  let service: LoanApplicationService;
  let applicationRepository: jest.Mocked<Repository<LoanApplication>>;
  let stageHistoryRepository: jest.Mocked<Repository<ApplicationStageHistory>>;
  let dataSource: jest.Mocked<DataSource>;
  let queryRunner: jest.Mocked<QueryRunner>;

  const mockProducer = {
    connect: jest.fn(),
    send: jest.fn(),
    disconnect: jest.fn(),
  };

  const mockKafka = {
    producer: jest.fn().mockReturnValue(mockProducer),
  };

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn(),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoanApplicationService,
        {
          provide: getRepositoryToken(LoanApplication),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getManyAndCount: jest.fn(),
            }),
            query: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ApplicationStageHistory),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
              const config: Record<string, any> = {
                KAFKA_BROKERS: ['localhost:9092'],
              };
              return config[key] || defaultValue;
            }),
          },
        },
        {
          provide: Kafka,
          useValue: mockKafka,
        },
      ],
    }).compile();

    service = module.get<LoanApplicationService>(LoanApplicationService);
    applicationRepository = module.get(getRepositoryToken(LoanApplication));
    stageHistoryRepository = module.get(getRepositoryToken(ApplicationStageHistory));
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createApplication', () => {
    const createDto: CreateApplicationDto = {
      loanType: LoanType.PERSONAL_LOAN,
      channelCode: ChannelCode.MOBILE_APP,
      branchCode: 'MH001',
      applicant: {
        fullName: 'Ravi Sharma',
        dob: '1990-04-21',
        gender: 'MALE',
        maritalStatus: 'MARRIED',
        mobile: '9876543210',
        email: 'ravi@example.com',
        residentialStatus: 'RESIDENT_INDIAN',
        addresses: [{
          line1: '123 Main St',
          city: 'Pune',
          district: 'Pune',
          state: 'MH',
          pincode: '411057',
        }],
        yearsAtCurrentAddress: 3,
        ownOrRentedResidence: 'RENTED',
      },
      employmentDetails: {
        employmentType: 'SALARIED_PRIVATE' as any,
        employerName: 'Infosys',
        designation: 'Engineer',
        totalWorkExperienceMonths: 84,
        currentJobExperienceMonths: 50,
        grossMonthlyIncome: 12000000,
        netMonthlyIncome: 9500000,
        totalAnnualIncome: 144000000,
      },
      loanRequirement: {
        loanType: LoanType.PERSONAL_LOAN,
        requestedAmount: 50000000,
        requestedTenureMonths: 36,
        purposeDescription: 'Medical',
      },
    };

    it('should create application successfully for new user', async () => {
      applicationRepository.findOne.mockResolvedValue(null);
      applicationRepository.query.mockResolvedValue([{ seq: '1' }]);
      applicationRepository.create.mockReturnValue({
        id: 'app-id',
        applicationNumber: 'LOS-2024-MH-000001',
        status: ApplicationStatus.DRAFT,
        createdAt: new Date(),
      } as LoanApplication);
      (queryRunner.manager.save as jest.Mock).mockResolvedValue({
        id: 'app-id',
        applicationNumber: 'LOS-2024-MH-000001',
        status: ApplicationStatus.DRAFT,
        loanType: LoanType.PERSONAL_LOAN,
        requestedAmount: 50000000,
        channelCode: ChannelCode.MOBILE_APP,
        branchCode: 'MH001',
        userId: 'user-id',
        createdAt: new Date(),
      });
      stageHistoryRepository.create.mockReturnValue({} as ApplicationStageHistory);
      (queryRunner.manager.save as jest.Mock).mockResolvedValue({});
      mockProducer.connect.mockResolvedValue(undefined);
      mockProducer.send.mockResolvedValue({});
      mockProducer.disconnect.mockResolvedValue(undefined);

      const result = await service.createApplication(createDto, 'user-id');

      expect(result).toHaveProperty('applicationId');
      expect(result).toHaveProperty('applicationNumber');
      expect(result.status).toBe(ApplicationStatus.DRAFT);
      expect(result.nextStep).toBe('COMPLETE_KYC');
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should reject duplicate application within 30 days', async () => {
      applicationRepository.findOne.mockResolvedValue({
        id: 'existing-app',
        applicationNumber: 'LOS-2024-MH-000001',
        status: ApplicationStatus.UNDER_PROCESSING,
        createdAt: new Date(),
      } as LoanApplication);

      await expect(service.createApplication(createDto, 'user-id'))
        .rejects.toMatchObject({
          code: 'APP_003',
        });

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should reject if PAN not provided', async () => {
      const dtoWithoutPan = {
        ...createDto,
        applicant: {
          ...createDto.applicant,
          panNumber: undefined,
        },
      };

      await expect(service.createApplication(dtoWithoutPan as any, 'user-id'))
        .rejects.toMatchObject({
          code: 'GEN_004',
          message: 'PAN number is required',
        });
    });
  });

  describe('getApplication', () => {
    it('should return application for owner', async () => {
      const mockApplication = {
        id: 'app-id',
        applicationNumber: 'LOS-2024-MH-000001',
        status: ApplicationStatus.DRAFT,
        userId: 'user-id',
        applicantProfile: { fullName: 'Ravi' },
        employmentDetails: {},
        loanRequirement: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      applicationRepository.findOne.mockResolvedValue(mockApplication as LoanApplication);

      const result = await service.getApplication('app-id', 'user-id', 'APPLICANT');

      expect(result.applicationId).toBe('app-id');
    });

    it('should throw APP_001 for non-existent application', async () => {
      applicationRepository.findOne.mockResolvedValue(null);

      await expect(service.getApplication('non-existent', 'user-id', 'APPLICANT'))
        .rejects.toMatchObject({
          code: 'APP_001',
        });
    });

    it('should throw AUTH_006 for applicant accessing others application', async () => {
      applicationRepository.findOne.mockResolvedValue({
        id: 'app-id',
        userId: 'other-user-id',
      } as LoanApplication);

      await expect(service.getApplication('app-id', 'user-id', 'APPLICANT'))
        .rejects.toMatchObject({
          code: 'AUTH_006',
        });
    });
  });

  describe('submitApplication', () => {
    it('should submit application successfully', async () => {
      const mockApplication = {
        id: 'app-id',
        status: ApplicationStatus.DRAFT,
        userId: 'user-id',
        applicantProfile: { fullName: 'Ravi' },
        employmentDetails: { netMonthlyIncome: 9500000 },
        loanRequirement: {},
        requestedAmount: 50000000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      applicationRepository.findOne.mockResolvedValue(mockApplication as LoanApplication);
      applicationRepository.save.mockResolvedValue({
        ...mockApplication,
        status: ApplicationStatus.SUBMITTED,
        submittedAt: expect.any(Date),
      } as LoanApplication);
      stageHistoryRepository.create.mockReturnValue({} as ApplicationStageHistory);
      stageHistoryRepository.save.mockResolvedValue({});
      mockProducer.connect.mockResolvedValue(undefined);
      mockProducer.send.mockResolvedValue({});
      mockProducer.disconnect.mockResolvedValue(undefined);

      const result = await service.submitApplication('app-id', 'user-id', 'APPLICANT');

      expect(result.status).toBe(ApplicationStatus.SUBMITTED);
    });

    it('should reject if application already submitted', async () => {
      applicationRepository.findOne.mockResolvedValue({
        id: 'app-id',
        status: ApplicationStatus.SUBMITTED,
      } as LoanApplication);

      await expect(service.submitApplication('app-id', 'user-id', 'APPLICANT'))
        .rejects.toMatchObject({
          code: 'APP_004',
        });
    });

    it('should reject if validation fails', async () => {
      applicationRepository.findOne.mockResolvedValue({
        id: 'app-id',
        status: ApplicationStatus.DRAFT,
        applicantProfile: {},
        employmentDetails: {},
        loanRequirement: {},
        requestedAmount: 0,
      } as LoanApplication);

      await expect(service.submitApplication('app-id', 'user-id', 'APPLICANT'))
        .rejects.toMatchObject({
          code: 'APP_004',
        });
    });
  });

  describe('transitionStatus', () => {
    it('should transition status validly', async () => {
      applicationRepository.findOne.mockResolvedValue({
        id: 'app-id',
        status: ApplicationStatus.DRAFT,
        applicationNumber: 'LOS-2024-MH-000001',
      } as LoanApplication);
      applicationRepository.save.mockResolvedValue({} as LoanApplication);
      stageHistoryRepository.create.mockReturnValue({} as ApplicationStageHistory);
      stageHistoryRepository.save.mockResolvedValue({});
      mockProducer.connect.mockResolvedValue(undefined);
      mockProducer.send.mockResolvedValue({});
      mockProducer.disconnect.mockResolvedValue(undefined);

      await service.transitionStatus(
        'app-id',
        ApplicationStatus.SUBMITTED,
        'user-id',
        'APPLICANT',
        'User submitted application'
      );

      expect(applicationRepository.save).toHaveBeenCalled();
      expect(stageHistoryRepository.save).toHaveBeenCalled();
    });

    it('should reject invalid status transition', async () => {
      applicationRepository.findOne.mockResolvedValue({
        id: 'app-id',
        status: ApplicationStatus.REJECTED,
      } as LoanApplication);

      await expect(
        service.transitionStatus('app-id', ApplicationStatus.SUBMITTED, 'user-id', 'APPLICANT')
      ).rejects.toMatchObject({
        code: 'APP_004',
      });
    });
  });

  describe('updateApplication', () => {
    it('should update application in DRAFT status', async () => {
      applicationRepository.findOne.mockResolvedValue({
        id: 'app-id',
        status: ApplicationStatus.DRAFT,
        applicantProfile: { fullName: 'Old Name' },
        employmentDetails: {},
        loanRequirement: {},
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as LoanApplication);
      applicationRepository.save.mockResolvedValue({
        id: 'app-id',
        status: ApplicationStatus.DRAFT,
        applicantProfile: { fullName: 'New Name' },
        version: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as LoanApplication);

      const result = await service.updateApplication(
        'app-id',
        {
          section: 'APPLICANT',
          data: { fullName: 'New Name' },
          version: 1,
        },
        'user-id'
      );

      expect(applicationRepository.save).toHaveBeenCalled();
    });

    it('should reject update for non-DRAFT applications', async () => {
      applicationRepository.findOne.mockResolvedValue({
        id: 'app-id',
        status: ApplicationStatus.SUBMITTED,
      } as LoanApplication);

      await expect(
        service.updateApplication('app-id', {
          section: 'APPLICANT',
          data: { fullName: 'New Name' },
          version: 1,
        }, 'user-id')
      ).rejects.toMatchObject({
        code: 'APP_004',
      });
    });

    it('should reject on version conflict', async () => {
      applicationRepository.findOne.mockResolvedValue({
        id: 'app-id',
        status: ApplicationStatus.DRAFT,
        applicantProfile: {},
        employmentDetails: {},
        loanRequirement: {},
        version: 2,
      } as LoanApplication);

      await expect(
        service.updateApplication('app-id', {
          section: 'APPLICANT',
          data: { fullName: 'New Name' },
          version: 1,
        }, 'user-id')
      ).rejects.toMatchObject({
        code: 'APP_005',
      });
    });
  });
});
