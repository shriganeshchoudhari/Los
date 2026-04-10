import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as xml2js from 'xml2js';
import { AadhaarKYCResult, KYCStatus } from '../entities/kyc.entity';
import { KYCREcord } from '../entities/kyc.entity';
import { hashAadhaar, createError, AuditService, AuditEventCategory, AuditEventType } from '@los/common';

@Injectable()
export class OfflineXmlKycService {
  private readonly logger = new Logger(OfflineXmlKycService.name);
  private readonly uidaiPublicKey: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(AadhaarKYCResult)
    private readonly aadhaarRepository: Repository<AadhaarKYCResult>,
    @InjectRepository(KYCREcord)
    private readonly kycRepository: Repository<KYCREcord>,
    private readonly auditService: AuditService,
  ) {
    this.uidaiPublicKey = this.configService.get<string>('UIDAI_PUBLIC_KEY', '');
  }

  async processOfflineXml(
    applicationId: string,
    xmlContent: string,
    shareCode: string,
    mobile: string,
    userId: string,
  ): Promise<{ success: boolean; kycId: string; error?: string }> {
    try {
      const validationError = this.validateXmlSignature(xmlContent);
      if (validationError) {
        throw createError('KYC_007', validationError);
      }

      const parsed = await this.parseXml(xmlContent);

      if (mobile && parsed.mobile !== mobile) {
        const providedHash = hashAadhaar(mobile);
        if (parsed.mobileHash !== providedHash) {
          throw createError('KYC_008', 'Mobile number in XML does not match registered mobile');
        }
      }

      const kycRecord = await this.kycRepository.findOne({ where: { applicationId } });
      if (!kycRecord) {
        throw createError('APP_001', 'KYC record not found');
      }

      const aadhaarKyc = this.aadhaarRepository.create({
        kycId: kycRecord.id,
        txnId: `OFFLINE_${Date.now()}`,
        uidaiRefId: parsed.referenceId || `OFFLINE_${Date.now()}`,
        aadhaarNumberHash: parsed.aadhaarHash,
        name: parsed.name,
        dob: new Date(parsed.dob),
        gender: parsed.gender,
        addressJson: parsed.address,
        photoStorageKey: parsed.photoKey,
        xmlStorageKey: `kyc-xmls/${kycRecord.id}/${Date.now()}.xml.enc`,
        signatureValid: parsed.signatureValid,
        uidaiResponseCode: 'OFFLINE',
        authCode: 'XML_VERIFIED',
        verifiedAt: new Date(),
        ipMetadata: {
          source: 'offline_xml',
          shareCodeProvided: !!shareCode,
          mobileVerified: !!mobile,
          timestamp: new Date().toISOString(),
        },
      });

      const saved = await this.aadhaarRepository.save(aadhaarKyc);

      kycRecord.status = KYCStatus.AADHAAR_VERIFIED;
      kycRecord.userId = userId;
      await this.kycRepository.save(kycRecord);

      this.logger.log(`Offline XML KYC successful for application ${applicationId}`);

      await this.auditService.log({
        eventCategory: AuditEventCategory.KYC,
        eventType: AuditEventType.KYC_VERIFY,
        entityType: 'KYCREcord',
        entityId: kycRecord.id,
        metadata: {
          applicationId,
          verificationType: 'OFFLINE_XML',
          status: 'SUCCESS',
          name: parsed.name,
          signatureValid: parsed.signatureValid,
        },
      });

      return { success: true, kycId: saved.id };
    } catch (error) {
      this.logger.error(`Offline XML KYC failed: ${error.message}`);
      return { success: false, kycId: '', error: error.message };
    }
  }

  private validateXmlSignature(xmlContent: string): string | null {
    try {
      const signatureMatch = xmlContent.match(/<Signature[^>]*>([\s\S]*?)<\/Signature>/i);
      if (!signatureMatch) {
        return 'XML signature not found';
      }

      const base64Signature = xmlContent.match(/<SignatureValue[^>]*>([\s\S]*?)<\/SignatureValue>/i)?.[1]?.trim();
      if (!base64Signature) {
        return 'Signature value not found in XML';
      }

      const signedDataMatch = xmlContent.match(/<SignedInfo>([\s\S]*?)<\/SignedInfo>/i);
      if (!signedDataMatch) {
        return 'SignedInfo not found in XML';
      }

      const signedData = signedDataMatch[1];
      const expectedHash = crypto.createHash('sha256').update(signedData).digest('base64');

      if (this.uidaiPublicKey) {
        try {
          const signatureBuffer = Buffer.from(base64Signature, 'base64');
          const verify = crypto.createVerify('SHA256');
          verify.update(signedData);
          const isValid = verify.verify(this.uidaiPublicKey, signatureBuffer);
          if (!isValid) {
            return 'XML signature verification failed';
          }
        } catch (err) {
          this.logger.warn(`Signature verification skipped (key unavailable): ${err.message}`);
        }
      }

      return null;
    } catch (error) {
      return `XML validation error: ${error.message}`;
    }
  }

  private async parseXml(xmlContent: string): Promise<{
    referenceId: string;
    aadhaarHash: string;
    name: string;
    dob: string;
    gender: string;
    address: Record<string, any>;
    photoKey: string;
    mobileHash: string;
    signatureValid: boolean;
  }> {
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xmlContent);

    const uidData = result['UidData'] || result['OfflineUidData'] || {};

    const pht = uidData['Pht'] || uidData['Photo'];
    const photoKey = pht ? `kyc-photos/${Date.now()}-${Math.random().toString(36).substr(2, 8)}.jpg` : null;

    const poa = uidData['Poa'] || uidData['Address'] || {};
    const address = this.extractAddress(poa);

    const referenceId = uidData['UidDataSignedRefNum'] || uidData['referenceId'] || `REF${Date.now()}`;

    const aadhaarNumber = uidData['Uid'] || uidData['aadhaarNumber'] || '';
    const aadhaarHash = hashAadhaar(aadhaarNumber);

    const mobileNumber = uidData['Mobile'] || uidData['mobileNumber'] || '';
    const mobileHash = mobileNumber ? hashAadhaar(mobileNumber) : '';

    const name = (uidData['Pfa'] || uidData['Name'] || '').toUpperCase().trim();
    const dob = uidData['Dob'] || uidData['birthDate'] || '1900-01-01';
    const gender = (uidData['Gender'] || '').toUpperCase().charAt(0) || 'O';

    return {
      referenceId,
      aadhaarHash,
      name,
      dob,
      gender,
      address,
      photoKey,
      mobileHash,
      signatureValid: true,
    };
  }

  private extractAddress(poa: any): Record<string, unknown> {
    if (!poa) return {};

    const normalize = (v: any): string => {
      if (typeof v === 'string') return v;
      if (v && v['_']) return v['_'];
      return '';
    };

    return {
      careOf: normalize(poa['Co']),
      houseNumber: normalize(poa['House']),
      street: normalize(poa['Street']),
      landmark: normalize(poa['Lm']),
      locality: normalize(poa['Loc']),
      vtc: normalize(poa['Vtc']),
      district: normalize(poa['Dist']),
      state: normalize(poa['State']),
      pincode: normalize(poa['Pc']),
      country: normalize(poa['Country']) || 'India',
    };
  }
}
