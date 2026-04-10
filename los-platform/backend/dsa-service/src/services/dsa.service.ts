import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import {
  DSAPartner,
  DSAPartnerStatus,
  DSAPartnerType,
  DSAOfficer,
  DSAApplication,
  DSACommission,
  CommissionType,
} from '../entities/dsa.entity';
import {
  RegisterPartnerDto,
  PartnerApprovalDto,
  DSALoginDto,
  DSALoginResponseDto,
  CreateOfficerDto,
  CreateDSAApplicationDto,
  DSADashboardDto,
  CommissionSummaryDto,
  CommissionDetailDto,
  PartnerListQueryDto,
  PartnerDetailDto,
  DSASetPasswordDto,
} from '../dto';
import { KafkaService, KAFKA_TOPICS, hashMobile, hashPan, maskMobile } from '@los/common';

const JWT_SECRET = process.env.DSA_JWT_SECRET || 'dsa-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.DSA_JWT_EXPIRES_IN || '8h';
const REFRESH_EXPIRES_IN = process.env.DSA_REFRESH_EXPIRES_IN || '7d';
const SALT_ROUNDS = 12;

@Injectable()
export class DSAService {
  private readonly logger = new Logger(DSAService.name);

  constructor(
    @InjectRepository(DSAPartner)
    private readonly partnerRepo: Repository<DSAPartner>,
    @InjectRepository(DSAOfficer)
    private readonly officerRepo: Repository<DSAOfficer>,
    @InjectRepository(DSAApplication)
    private readonly applicationRepo: Repository<DSAApplication>,
    @InjectRepository(DSACommission)
    private readonly commissionRepo: Repository<DSACommission>,
    private readonly dataSource: DataSource,
    private readonly kafka: KafkaService,
  ) {}

  async registerPartner(dto: RegisterPartnerDto): Promise<{ partnerId: string; partnerCode: string; status: DSAPartnerStatus; message: string }> {
    const existingByPan = await this.partnerRepo.findOne({ where: { panHash: hashPan(dto.pan) } });
    if (existingByPan) {
      throw new ConflictException('A DSA partner with this PAN already exists');
    }

    const existingByEmail = await this.partnerRepo.findOne({ where: { contactEmail: dto.contactEmail } });
    if (existingByEmail) {
      throw new ConflictException('A DSA partner with this email already exists');
    }

    const existingByMobile = await this.partnerRepo.findOne({ where: { contactMobile: dto.contactMobile } });
    if (existingByMobile) {
      throw new ConflictException('A DSA partner with this mobile already exists');
    }

    if (dto.gstin) {
      const existingByGstin = await this.partnerRepo.findOne({ where: { gstinHash: hashPan(dto.gstin) } });
      if (existingByGstin) {
        throw new ConflictException('A DSA partner with this GSTIN already exists');
      }
    }

    const partnerCode = await this.generatePartnerCode(dto.state, dto.partnerType);

    const partner = this.partnerRepo.create({
      partnerCode,
      partnerName: dto.partnerName,
      partnerType: dto.partnerType,
      status: DSAPartnerStatus.PENDING_APPROVAL,
      panHash: hashPan(dto.pan),
      panEnc: this.encryptField(dto.pan),
      gstin: dto.gstin,
      gstinHash: dto.gstin ? hashPan(dto.gstin) : null,
      registeredAddress: dto.registeredAddress,
      city: dto.city,
      state: dto.state,
      pincode: dto.pincode,
      contactName: dto.contactName,
      contactMobile: dto.contactMobile,
      contactEmail: dto.contactEmail,
      primaryBankAccount: dto.primaryBankAccount,
      primaryIfsc: dto.primaryIfsc,
      bankAccountHolder: dto.bankAccountHolder,
      commissionType: dto.commissionType || CommissionType.HYBRID,
      territoryCodes: dto.territoryCodes || [dto.state],
      allowedProducts: dto.allowedProducts || ['PL', 'BL'],
      minLoanAmount: dto.minLoanAmount || 50000,
      maxLoanAmount: dto.maxLoanAmount || 50000000,
    });

    const saved = await this.partnerRepo.save(partner);
    this.logger.log(`DSA Partner registered: ${partnerCode} (${saved.id})`);

    await this.kafka.emit(KAFKA_TOPICS.DSA_PARTNER_REGISTERED, {
      partnerId: saved.id,
      partnerCode: saved.partnerCode,
      partnerType: saved.partnerType,
      city: saved.city,
      state: saved.state,
      contactMobile: saved.contactMobile,
      contactEmail: saved.contactEmail,
      timestamp: new Date().toISOString(),
    });

    return {
      partnerId: saved.id,
      partnerCode: saved.partnerCode,
      status: saved.status,
      message: `Partner ${partnerCode} registered successfully. Your application is under review and will be processed within 2-3 business days.`,
    };
  }

  async approvePartner(
    partnerId: string,
    dto: PartnerApprovalDto,
    approverId: string,
  ): Promise<{ partnerId: string; partnerCode: string; status: DSAPartnerStatus; message: string }> {
    const partner = await this.partnerRepo.findOne({ where: { id: partnerId } });
    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    if (partner.status !== DSAPartnerStatus.PENDING_APPROVAL && partner.status !== DSAPartnerStatus.UNDER_REVIEW) {
      throw new BadRequestException(`Partner cannot be approved from status: ${partner.status}`);
    }

    const passwordToken = uuidv4();
    const hashedToken = crypto.createHash('sha256').update(passwordToken).digest('hex');

    if (dto.status === DSAPartnerStatus.APPROVED) {
      const now = new Date();
      partner.status = DSAPartnerStatus.APPROVED;
      partner.upfrontCommissionBps = dto.upfrontCommissionBps ?? 100;
      partner.trailCommissionBps = dto.trailCommissionBps ?? 50;
      partner.agreementValidFrom = now;
      partner.agreementValidTo = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      partner.remarks = dto.remarks || null;
      partner.onboardingOfficerId = approverId;
    } else if (dto.status === DSAPartnerStatus.REJECTED) {
      if (!dto.rejectionReason) {
        throw new BadRequestException('Rejection reason is required');
      }
      partner.status = DSAPartnerStatus.REJECTED;
      partner.rejectionReason = dto.rejectionReason;
      partner.rejectedBy = approverId;
      partner.remarks = dto.remarks || null;
    }

    await this.partnerRepo.save(partner);
    this.logger.log(`Partner ${partner.partnerCode} ${dto.status} by ${approverId}`);

    await this.kafka.emit(KAFKA_TOPICS.DSA_PARTNER_STATUS_CHANGED, {
      partnerId: partner.id,
      partnerCode: partner.partnerCode,
      oldStatus: partner.status,
      newStatus: dto.status,
      approvedBy: approverId,
      timestamp: new Date().toISOString(),
    });

    const message =
      dto.status === DSAPartnerStatus.APPROVED
        ? `Partner ${partner.partnerCode} approved. Commission: ${dto.upfrontCommissionBps ?? 100}bps upfront, ${dto.trailCommissionBps ?? 50}bps trail. Agreement valid for 1 year.`
        : `Partner ${partner.partnerCode} rejected. Reason: ${dto.rejectionReason}`;

    return { partnerId: partner.id, partnerCode: partner.partnerCode, status: partner.status, message };
  }

  async partnerLogin(dto: DSALoginDto): Promise<DSALoginResponseDto> {
    const partner = await this.partnerRepo.findOne({ where: { partnerCode: dto.partnerCode } });
    if (!partner) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (partner.status !== DSAPartnerStatus.APPROVED) {
      throw new ForbiddenException(
        `Account is ${partner.status.replace(/_/g, ' ').toLowerCase()}. Please contact support.`,
      );
    }

    const isValidPassword = await this.verifyPassword(dto.password, partner.panHash);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokenPayload = {
      sub: partner.id,
      partnerCode: partner.partnerCode,
      partnerName: partner.partnerName,
      role: 'DSA_PARTNER',
      type: 'partner',
    };

    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const refreshToken = jwt.sign(
      { sub: partner.id, type: 'refresh', version: 1 },
      JWT_SECRET,
      { expiresIn: REFRESH_EXPIRES_IN },
    );

    this.logger.log(`Partner ${partner.partnerCode} logged in from ${dto.ipAddress || 'unknown'}`);

    return {
      accessToken,
      refreshToken,
      expiresIn: 28800,
      partnerId: partner.id,
      partnerCode: partner.partnerCode,
      partnerName: partner.partnerName,
      role: 'DSA_PARTNER',
    };
  }

  async createOfficer(partnerId: string, dto: CreateOfficerDto, requestorId: string): Promise<DSAOfficer> {
    const partner = await this.partnerRepo.findOne({ where: { id: partnerId } });
    if (!partner) {
      throw new NotFoundException('Partner not found');
    }
    if (partner.status !== DSAPartnerStatus.APPROVED) {
      throw new BadRequestException('Partner must be approved to create officers');
    }

    const mobileHash = hashMobile(dto.mobile);
    const existingByMobile = await this.officerRepo.findOne({ where: { partnerId, mobileHash } });
    if (existingByMobile) {
      throw new ConflictException('An officer with this mobile already exists for this partner');
    }

    const existingByEmail = await this.officerRepo.findOne({ where: { emailHash: hashPan(dto.email) } });
    if (existingByEmail) {
      throw new ConflictException('An officer with this email already exists for this partner');
    }

    const employeeCode = await this.generateEmployeeCode(partner.partnerCode);

    const tempPassword = this.generateTempPassword();
    const hashedPassword = crypto.createHash('sha256').update(tempPassword).digest('hex');

    const officer = this.officerRepo.create({
      partnerId,
      employeeCode,
      fullName: dto.fullName,
      mobileHash,
      mobileEnc: this.encryptField(dto.mobile),
      emailHash: hashPan(dto.email),
      emailEnc: dto.email ? this.encryptField(dto.email) : null,
      passwordHash: hashedPassword,
      designation: dto.designation,
      department: dto.department || 'Sales',
      status: 'ACTIVE',
      territoryCodes: dto.territoryCodes || partner.territoryCodes,
      allowedProducts: dto.allowedProducts || partner.allowedProducts,
      maxSanctionAuthority: dto.maxSanctionAuthority || 0,
    });

    const saved = await this.officerRepo.save(officer);
    this.logger.log(`DSA Officer created: ${employeeCode} for partner ${partner.partnerCode}`);

    await this.kafka.emit(KAFKA_TOPICS.DSA_OFFICER_CREATED, {
      officerId: saved.id,
      employeeCode: saved.employeeCode,
      partnerId,
      fullName: saved.fullName,
      createdBy: requestorId,
      tempPasswordGenerated: true,
      timestamp: new Date().toISOString(),
    });

    return saved;
  }

  async officerLogin(employeeCode: string, password: string): Promise<DSALoginResponseDto> {
    const officer = await this.officerRepo.findOne({ where: { employeeCode } });
    if (!officer) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (officer.status !== 'ACTIVE') {
      throw new ForbiddenException(`Account is ${officer.status.toLowerCase()}. Please contact your DSA administrator.`);
    }

    const partner = await this.partnerRepo.findOne({ where: { id: officer.partnerId } });
    if (!partner || partner.status !== DSAPartnerStatus.APPROVED) {
      throw new ForbiddenException('Your DSA partner account is not active');
    }

    const isValid = await this.verifyPassword(password, officer.mobileHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.officerRepo.update(officer.id, { lastLoginAt: new Date() });

    const tokenPayload = {
      sub: officer.id,
      partnerId: officer.partnerId,
      partnerCode: partner.partnerCode,
      employeeCode: officer.employeeCode,
      fullName: officer.fullName,
      role: 'DSA_OFFICER',
      type: 'officer',
    };

    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const refreshToken = jwt.sign(
      { sub: officer.id, type: 'refresh', version: 1 },
      JWT_SECRET,
      { expiresIn: REFRESH_EXPIRES_IN },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 28800,
      partnerId: officer.partnerId,
      partnerCode: partner.partnerCode,
      partnerName: partner.partnerName,
      role: 'DSA_OFFICER',
    };
  }

  async createApplication(
    partnerId: string,
    officerId: string,
    dto: CreateDSAApplicationDto,
  ): Promise<DSAApplication> {
    const partner = await this.partnerRepo.findOne({ where: { id: partnerId } });
    if (!partner) {
      throw new NotFoundException('Partner not found');
    }
    if (partner.status !== DSAPartnerStatus.APPROVED) {
      throw new BadRequestException('Partner account is not active');
    }

    const now = new Date();
    if (partner.agreementValidFrom && partner.agreementValidTo) {
      if (now < partner.agreementValidFrom || now > partner.agreementValidTo) {
        throw new ForbiddenException('Partner agreement has expired or not yet started');
      }
    }

    if (partner.allowedProducts && !partner.allowedProducts.includes(dto.loanType)) {
      throw new BadRequestException(`Loan type ${dto.loanType} is not allowed for this partner`);
    }

    if (dto.requestedAmount < partner.minLoanAmount) {
      throw new BadRequestException(`Minimum loan amount is ${partner.minLoanAmount}`);
    }
    if (dto.requestedAmount > partner.maxLoanAmount) {
      throw new BadRequestException(`Maximum loan amount is ${partner.maxLoanAmount}`);
    }

    const officer = await this.officerRepo.findOne({ where: { id: officerId } });
    if (!officer || officer.partnerId !== partnerId) {
      throw new NotFoundException('Officer not found or not associated with this partner');
    }

    const existingCustomerApp = await this.applicationRepo.findOne({
      where: {
        partnerId,
        customerMobileHash: hashMobile(dto.customerMobile),
        status: In(['SUBMITTED', 'UNDER_PROCESSING', 'APPROVED', 'DISBURSED']),
      },
    });
    if (existingCustomerApp) {
      throw new ConflictException(
        `An active application already exists for this customer (${existingCustomerApp.applicationNumber}). Customer must complete or withdraw the existing application first.`,
      );
    }

    const applicationNumber = await this.generateApplicationNumber(dto.loanType);

    const application = this.applicationRepo.create({
      applicationNumber,
      partnerId,
      officerId,
      customerName: dto.customerName,
      customerMobileHash: hashMobile(dto.customerMobile),
      customerPanHash: dto.customerPan ? hashPan(dto.customerPan) : null,
      loanType: dto.loanType,
      requestedAmount: dto.requestedAmount,
      requestedTenureMonths: dto.requestedTenureMonths,
      status: 'SUBMITTED',
      utmSource: dto.utmSource,
      utmMedium: dto.utmMedium,
      sourceLeadId: dto.sourceLeadId,
      remarks: dto.remarks,
    });

    const saved = await this.applicationRepo.save(application);

    await this.partnerRepo.increment({ id: partnerId }, 'totalApplications', 1);
    await this.officerRepo.increment({ id: officerId }, 'totalApplications', 1);

    this.logger.log(
      `DSA Application created: ${applicationNumber} by officer ${officer.employeeCode} for partner ${partner.partnerCode}`,
    );

    await this.kafka.emit(KAFKA_TOPICS.DSA_APPLICATION_CREATED, {
      applicationId: saved.id,
      applicationNumber: saved.applicationNumber,
      partnerId,
      partnerCode: partner.partnerCode,
      officerId,
      customerName: saved.customerName,
      customerMobile: maskMobile(dto.customerMobile),
      loanType: dto.loanType,
      requestedAmount: dto.requestedAmount,
      requestedTenureMonths: dto.requestedTenureMonths,
      utmSource: dto.utmSource,
      utmMedium: dto.utmMedium,
      timestamp: new Date().toISOString(),
    });

    return saved;
  }

  async getPartnerDashboard(partnerId: string): Promise<DSADashboardDto> {
    const partner = await this.partnerRepo.findOne({ where: { id: partnerId } });
    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    const applications = await this.applicationRepo.find({ where: { partnerId } });
    const commissions = await this.commissionRepo.find({ where: { partnerId } });

    const submitted = applications.filter((a) =>
      ['SUBMITTED', 'UNDER_PROCESSING', 'APPROVED', 'DISBURSED', 'CONDITIONALLY_APPROVED'].includes(a.status),
    ).length;
    const approved = applications.filter((a) => ['APPROVED', 'CONDITIONALLY_APPROVED', 'SANCTIONED', 'DISBURSEMENT_IN_PROGRESS', 'DISBURSED'].includes(a.status)).length;
    const disbursed = applications.filter((a) => a.status === 'DISBURSED').length;
    const rejected = applications.filter((a) => a.status === 'REJECTED').length;

    const totalCommissionEarned = commissions.reduce((sum, c) => sum + Number(c.commissionAmount), 0);
    const totalCommissionPaid = commissions
      .filter((c) => c.status === 'PAID')
      .reduce((sum, c) => sum + Number(c.netPayable), 0);
    const pendingCommission = commissions
      .filter((c) => c.status === 'EARNED')
      .reduce((sum, c) => sum + Number(c.netPayable), 0);

    const conversionRate = submitted > 0 ? (approved / submitted) * 100 : 0;
    const disbursementRate = approved > 0 ? (disbursed / approved) * 100 : 0;

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentApps = applications.filter((a) => new Date(a.createdAt) >= sixMonthsAgo);
    const monthlyTrend = this.computeMonthlyTrend(recentApps, commissions.filter((c) => new Date(c.disbursementDate) >= sixMonthsAgo));

    const officers = await this.officerRepo.find({ where: { partnerId } });
    const officerStats = officers.map((o) => ({
      officerId: o.id,
      officerName: o.fullName,
      applications: o.totalApplications,
      disbursements: o.totalDisbursements,
    }));

    return {
      partnerId,
      partnerName: partner.partnerName,
      status: partner.status,
      totalApplications: partner.totalApplications,
      submittedApplications: submitted,
      approvedApplications: approved,
      disbursedApplications: disbursed,
      rejectedApplications: rejected,
      totalDisbursedAmount: Number(partner.totalDisbursedAmount),
      totalCommissionEarned,
      totalCommissionPaid,
      pendingCommission,
      conversionRate: Math.round(conversionRate * 100) / 100,
      disbursementRate: Math.round(disbursementRate * 100) / 100,
      monthlyTrend,
      officerStats,
    };
  }

  async getCommissionSummary(partnerId: string): Promise<CommissionSummaryDto> {
    const commissions = await this.commissionRepo.find({ where: { partnerId } });

    const totalEarned = commissions.reduce((sum, c) => sum + Number(c.commissionAmount), 0);
    const totalTDS = commissions.reduce((sum, c) => sum + Number(c.tdsAmount), 0);
    const totalGST = commissions.reduce((sum, c) => sum + Number(c.gstAmount), 0);
    const totalPaid = commissions.filter((c) => c.status === 'PAID').reduce((sum, c) => sum + Number(c.netPayable), 0);
    const pendingPayout = commissions.filter((c) => c.status === 'EARNED').reduce((sum, c) => sum + Number(c.netPayable), 0);

    const paidCommissions = commissions.filter((c) => c.status === 'PAID').sort((a, b) => new Date(b.processedAt!).getTime() - new Date(a.processedAt!).getTime());
    const lastPaid = paidCommissions[0];

    return {
      partnerId,
      totalEarned,
      totalTDS,
      totalGST,
      totalPaid,
      pendingPayout,
      lastPayoutDate: lastPaid?.processedAt || null,
      lastPayoutAmount: lastPaid ? Number(lastPaid.netPayable) : 0,
    };
  }

  async getCommissionHistory(partnerId: string, page = 0, size = 20): Promise<{ data: CommissionDetailDto[]; total: number }> {
    const [commissions, total] = await this.commissionRepo.findAndCount({
      where: { partnerId },
      order: { createdAt: 'DESC' },
      skip: page * size,
      take: size,
    });

    return {
      data: commissions.map((c) => ({
        id: c.id,
        applicationId: c.applicationId,
        loanApplicationId: c.loanApplicationId,
        loanType: c.loanType,
        disbursedAmount: Number(c.disbursedAmount),
        commissionType: c.commissionType,
        commissionRateBps: c.commissionRateBps,
        commissionAmount: Number(c.commissionAmount),
        gstAmount: Number(c.gstAmount),
        tdsAmount: Number(c.tdsAmount),
        netPayable: Number(c.netPayable),
        disbursementDate: c.disbursementDate,
        payoutMonth: c.payoutMonth,
        status: c.status,
        processedAt: c.processedAt,
      })),
      total,
    };
  }

  async listPartners(query: PartnerListQueryDto): Promise<{ data: PartnerDetailDto[]; total: number; page: number; size: number }> {
    const { status, partnerType, search, page = 0, size = 20 } = query;

    const where: any = {};
    if (status) where.status = status;
    if (partnerType) where.partnerType = partnerType;
    if (search) {
      where.partnerName = Like(`%${search}%`);
    }

    const [partners, total] = await this.partnerRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: page * size,
      take: size,
    });

    return {
      data: partners.map((p) => this.mapPartnerToDetail(p)),
      total,
      page,
      size,
    };
  }

  async getPartnerById(partnerId: string): Promise<PartnerDetailDto> {
    const partner = await this.partnerRepo.findOne({ where: { id: partnerId } });
    if (!partner) {
      throw new NotFoundException('Partner not found');
    }
    return this.mapPartnerToDetail(partner);
  }

  async listApplications(
    partnerId: string,
    status?: string,
    page = 0,
    size = 20,
  ): Promise<{ data: DSAApplication[]; total: number }> {
    const where: any = { partnerId };
    if (status) where.status = status;

    const [applications, total] = await this.applicationRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: page * size,
      take: size,
    });

    return { data: applications, total };
  }

  async getOfficers(partnerId: string): Promise<DSAOfficer[]> {
    return this.officerRepo.find({ where: { partnerId }, order: { createdAt: 'ASC' } });
  }

  async recordDisbursementCommission(
    applicationId: string,
    loanApplicationId: string,
    loanType: string,
    disbursedAmount: number,
    disbursementDate: Date,
  ): Promise<void> {
    const application = await this.applicationRepo.findOne({ where: { id: applicationId } });
    if (!application) {
      this.logger.warn(`DSA application not found for commission recording: ${applicationId}`);
      return;
    }

    const partner = await this.partnerRepo.findOne({ where: { id: application.partnerId } });
    if (!partner || partner.status !== DSAPartnerStatus.APPROVED) {
      this.logger.warn(`Partner not approved for commission: ${application.partnerId}`);
      return;
    }

    const existingCommission = await this.commissionRepo.findOne({ where: { applicationId } });
    if (existingCommission) {
      this.logger.warn(`Commission already recorded for application: ${applicationId}`);
      return;
    }

    const bps = partner.upfrontCommissionBps || 100;
    const commissionAmount = Math.floor((disbursedAmount * bps) / 10000);
    const gstAmount = Math.floor(commissionAmount * 0.18);
    const tdsAmount = Math.floor(commissionAmount * 0.10);
    const netPayable = commissionAmount + gstAmount - tdsAmount;
    const payoutMonth = `${disbursementDate.getFullYear()}-${String(disbursementDate.getMonth() + 1).padStart(2, '0')}`;

    const commission = this.commissionRepo.create({
      partnerId: partner.id,
      officerId: application.officerId,
      applicationId,
      loanApplicationId,
      loanType,
      disbursedAmount,
      commissionType: partner.commissionType,
      commissionRateBps: bps,
      commissionAmount,
      gstAmount,
      tdsAmount,
      netPayable,
      disbursementDate,
      payoutMonth,
      status: 'EARNED',
    });

    await this.commissionRepo.save(commission);

    await this.partnerRepo.increment({ id: partner.id }, 'totalDisbursements', 1);
    await this.partnerRepo.increment({ id: partner.id }, 'totalDisbursedAmount', disbursedAmount);
    await this.officerRepo.increment({ id: application.officerId }, 'totalDisbursements', 1);

    this.logger.log(
      `Commission recorded: ₹${commissionAmount} for app ${application.applicationNumber} (partner: ${partner.partnerCode})`,
    );

    await this.kafka.emit(KAFKA_TOPICS.DSA_COMMISSION_EARNED, {
      commissionId: commission.id,
      partnerId: partner.id,
      partnerCode: partner.partnerCode,
      applicationId,
      loanApplicationId,
      disbursedAmount,
      commissionAmount,
      gstAmount,
      tdsAmount,
      netPayable,
      payoutMonth,
      timestamp: new Date().toISOString(),
    });
  }

  async processCommissionPayout(partnerId: string, payoutMonth: string, processedBy: string): Promise<{ count: number; totalAmount: number }> {
    const pending = await this.commissionRepo.find({
      where: { partnerId, payoutMonth, status: 'EARNED' },
    });

    if (pending.length === 0) {
      return { count: 0, totalAmount: 0 };
    }

    const totalAmount = pending.reduce((sum, c) => sum + Number(c.netPayable), 0);

    await this.commissionRepo.update(
      { id: In(pending.map((c) => c.id)) },
      { status: 'PAID', processedAt: new Date(), processedBy },
    );

    await this.partnerRepo.increment({ id: partnerId }, 'totalCommissionPaid', totalAmount);

    this.logger.log(`Commission payout processed: ${pending.length} records, ₹${totalAmount} for partner ${partnerId}`);

    await this.kafka.emit(KAFKA_TOPICS.DSA_COMMISSION_PAID, {
      partnerId,
      payoutMonth,
      recordCount: pending.length,
      totalAmount,
      processedBy,
      timestamp: new Date().toISOString(),
    });

    return { count: pending.length, totalAmount };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    try {
      const payload = jwt.verify(refreshToken, JWT_SECRET) as any;
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const payload = jwt.verify(refreshToken, JWT_SECRET, { ignoreExpiration: true }) as any;
    const partner = await this.partnerRepo.findOne({ where: { id: payload.sub } });
    if (!partner || partner.status !== DSAPartnerStatus.APPROVED) {
      throw new UnauthorizedException('Partner not found or not approved');
    }

    const accessToken = jwt.sign(
      { sub: partner.id, partnerCode: partner.partnerCode, partnerName: partner.partnerName, role: 'DSA_PARTNER', type: 'partner' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );
    const newRefreshToken = jwt.sign({ sub: partner.id, type: 'refresh', version: 1 }, JWT_SECRET, { expiresIn: REFRESH_EXPIRES_IN });

    return { accessToken, refreshToken: newRefreshToken, expiresIn: 28800 };
  }

  private async generatePartnerCode(state: string, partnerType: DSAPartnerType): Promise<string> {
    const prefixMap: Record<DSAPartnerType, string> = {
      [DSAPartnerType.INDIVIDUAL]: 'DSAI',
      [DSAPartnerType.SoleProprietorship]: 'DSASP',
      [DSAPartnerType.PARTNERSHIP]: 'DSAP',
      [DSAPartnerType.PRIVATE_LIMITED]: 'DSAPL',
      [DSAPartnerType.PUBLIC_LIMITED]: 'DSAPU',
      [DSAPartnerType.NBFC]: 'DSANB',
    };
    const prefix = prefixMap[partnerType] || 'DSA';
    const statePrefix = state;
    const count = await this.partnerRepo.count();
    const seq = String(count + 1).padStart(5, '0');
    return `${prefix}${statePrefix}${seq}`;
  }

  private async generateEmployeeCode(partnerCode: string): Promise<string> {
    const count = await this.officerRepo.count({ where: { partnerId: (await this.partnerRepo.findOne({ where: { partnerCode } }))?.id } });
    return `${partnerCode}-OFF${String(count + 1).padStart(3, '0')}`;
  }

  private async generateApplicationNumber(loanType: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.applicationRepo.count();
    const seq = String(count + 1).padStart(7, '0');
    return `DSA-${loanType}-${year}-${seq}`;
  }

  private async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const inputHash = crypto.createHash('sha256').update(password).digest('hex');
    return inputHash === storedHash;
  }

  private encryptField(value: string): Buffer {
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key-32-chars-here!!!', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]);
  }

  private decryptField(data: Buffer): string {
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key-32-chars-here!!!', 'salt', 32);
    const iv = data.subarray(0, 16);
    const tag = data.subarray(16, 32);
    const encrypted = data.subarray(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    return password;
  }

  private computeMonthlyTrend(
    applications: DSAApplication[],
    commissions: DSACommission[],
  ): { month: string; applications: number; disbursed: number; commission: number }[] {
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    return months.map((month) => {
      const monthApps = applications.filter((a) => {
        const d = new Date(a.createdAt);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === month;
      });
      const monthDisb = monthApps.filter((a) => a.status === 'DISBURSED').length;
      const monthComm = commissions
        .filter((c) => c.payoutMonth === month)
        .reduce((sum, c) => sum + Number(c.netPayable), 0);

      return { month, applications: monthApps.length, disbursed: monthDisb, commission: monthComm };
    });
  }

  private mapPartnerToDetail(p: DSAPartner): PartnerDetailDto {
    return {
      id: p.id,
      partnerCode: p.partnerCode,
      partnerName: p.partnerName,
      partnerType: p.partnerType,
      status: p.status,
      contactName: p.contactName,
      contactMobile: maskMobile(p.contactMobile),
      contactEmail: p.contactEmail,
      city: p.city,
      state: p.state,
      commissionType: p.commissionType,
      upfrontCommissionBps: p.upfrontCommissionBps,
      trailCommissionBps: p.trailCommissionBps,
      territoryCodes: p.territoryCodes || [],
      allowedProducts: p.allowedProducts || [],
      totalApplications: p.totalApplications,
      totalDisbursements: p.totalDisbursements,
      totalDisbursedAmount: Number(p.totalDisbursedAmount),
      totalCommissionPaid: Number(p.totalCommissionPaid),
      agreementValidFrom: p.agreementValidFrom,
      agreementValidTo: p.agreementValidTo,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
