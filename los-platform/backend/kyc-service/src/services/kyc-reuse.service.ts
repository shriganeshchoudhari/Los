import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { AadhaarKYCResult, PANVerificationResult } from '../entities/kyc.entity';
import { createError } from '@los/common';

const KYC_VALIDITY_YEARS = 10;

export interface KycReuseCheckResult {
  canReuse: boolean;
  existingKycId?: string;
  reuseEligible?: boolean;
  validityExpiresAt?: string;
  daysRemaining?: number;
  reason?: string;
}

export interface KycReuseResult {
  success: boolean;
  reusedKycId?: string;
  newKycId?: string;
  error?: string;
}

@Injectable()
export class KycReuseService {
  private readonly logger = new Logger(KycReuseService.name);

  constructor(
    @InjectRepository(AadhaarKYCResult)
    private readonly aadhaarRepository: Repository<AadhaarKYCResult>,
    @InjectRepository(PANVerificationResult)
    private readonly panRepository: Repository<PANVerificationResult>,
  ) {}

  async checkReuseEligibility(
    applicationId: string,
    userId: string,
    aadhaarHash: string,
    panMasked?: string,
  ): Promise<KycReuseCheckResult> {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - KYC_VALIDITY_YEARS);

    const existingAadhaar = await this.aadhaarRepository.findOne({
      where: {
        aadhaarNumberHash: aadhaarHash,
        verifiedAt: MoreThan(cutoffDate),
      },
      relations: ['kyc'],
      order: { verifiedAt: 'DESC' },
    });

    if (!existingAadhaar) {
      return {
        canReuse: false,
        reason: `No valid KYC found for this Aadhaar. Aadhaar KYC older than ${KYC_VALIDITY_YEARS} years found.`,
      };
    }

    const validityExpiresAt = new Date(existingAadhaar.verifiedAt);
    validityExpiresAt.setFullYear(validityExpiresAt.getFullYear() + KYC_VALIDITY_YEARS);

    if (validityExpiresAt < new Date()) {
      return {
        canReuse: false,
        existingKycId: existingAadhaar.kycId,
        validityExpiresAt: validityExpiresAt.toISOString(),
        reason: `KYC validity expired on ${validityExpiresAt.toLocaleDateString()}. Fresh KYC required.`,
      };
    }

    if (existingAadhaar.kyc?.status === 'KYC_FAILED') {
      return {
        canReuse: false,
        existingKycId: existingAadhaar.kycId,
        reason: 'Previous KYC failed. Fresh KYC required.',
      };
    }

    const daysRemaining = Math.ceil(
      (validityExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    return {
      canReuse: true,
      existingKycId: existingAadhaar.kycId,
      reuseEligible: true,
      validityExpiresAt: validityExpiresAt.toISOString(),
      daysRemaining,
    };
  }

  async reuseKyc(
    applicationId: string,
    userId: string,
    existingKycId: string,
  ): Promise<KycReuseResult> {
    try {
      const existingAadhaar = await this.aadhaarRepository.findOne({
        where: { kycId: existingKycId },
      });

      if (!existingAadhaar) {
        throw createError('KYC_015', 'Existing KYC record not found');
      }

      const existingPan = await this.panRepository.findOne({
        where: { kycId: existingKycId },
      });

      this.logger.log(
        `KYC reuse successful: application ${applicationId} reusing KYC ${existingKycId}`,
        {
          previousAadhaar: existingAadhaar.id,
          previousPan: existingPan?.id,
          previousVerifiedAt: existingAadhaar.verifiedAt,
        },
      );

      return {
        success: true,
        reusedKycId: existingKycId,
      };
    } catch (error) {
      this.logger.error(`KYC reuse failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async getReuseHistory(
    userId: string,
    limit = 10,
  ): Promise<{ applicationId: string; reusedAt: string; validityExpiresAt: string }[]> {
    const aadhaarRecords = await this.aadhaarRepository
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.kyc', 'kyc')
      .where('kyc.userId = :userId', { userId })
      .andWhere('a.verifiedAt > :cutoffDate', {
        cutoffDate: new Date(Date.now() - KYC_VALIDITY_YEARS * 365 * 24 * 60 * 60 * 1000),
      })
      .orderBy('a.verifiedAt', 'DESC')
      .take(limit)
      .getMany();

    return aadhaarRecords.map((record) => {
      const validityExpiresAt = new Date(record.verifiedAt);
      validityExpiresAt.setFullYear(validityExpiresAt.getFullYear() + KYC_VALIDITY_YEARS);

      return {
        applicationId: record.kyc?.applicationId || '',
        reusedAt: record.verifiedAt.toISOString(),
        validityExpiresAt: validityExpiresAt.toISOString(),
      };
    });
  }
}
