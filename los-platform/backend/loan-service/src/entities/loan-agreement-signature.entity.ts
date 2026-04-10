import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { LoanAgreement } from './loan-agreement.entity';

export enum SignatureStatus {
  PENDING = 'PENDING',
  INITIATED = 'INITIATED',
  OTP_SENT = 'OTP_SENT',
  SIGNED = 'SIGNED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

@Entity('loan_agreement_signatures')
@Index(['agreementId'])
@Index(['esignTransactionId'])
export class LoanAgreementSignature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'agreement_id', type: 'uuid' })
  agreementId: string;

  @ManyToOne(() => LoanAgreement)
  @JoinColumn({ name: 'agreement_id' })
  agreement: LoanAgreement;

  @Column({ name: 'signer_type', type: 'varchar', length: 30 })
  signerType: string;

  @Column({ name: 'signer_name', type: 'varchar', length: 200 })
  signerName: string;

  @Column({ name: 'signer_mobile', type: 'varchar', length: 15, nullable: true })
  signerMobile: string | null;

  @Column({ name: 'signer_email', type: 'varchar', length: 254, nullable: true })
  signerEmail: string | null;

  @Column({ name: 'signer_role', type: 'varchar', length: 30, nullable: true })
  signerRole: string | null;

  @Column({ name: 'esign_transaction_id', type: 'varchar', length: 100, nullable: true })
  esignTransactionId: string | null;

  @Column({ name: 'esign_provider', type: 'varchar', length: 30, nullable: true })
  esignProvider: string | null;

  @Column({ name: 'document_hash_before_sign', type: 'char', length: 64, nullable: true })
  documentHashBeforeSign: string | null;

  @Column({ name: 'document_hash_after_sign', type: 'char', length: 64, nullable: true })
  documentHashAfterSign: string | null;

  @Column({ name: 'certificate_serial_number', type: 'varchar', length: 100, nullable: true })
  certificateSerialNumber: string | null;

  @Column({ name: 'certificate_valid_from', type: 'timestamptz', nullable: true })
  certificateValidFrom: Date | null;

  @Column({ name: 'certificate_valid_to', type: 'timestamptz', nullable: true })
  certificateValidTo: Date | null;

  @Column({ name: 'signer_aadhaar_hash', type: 'char', length: 64, nullable: true })
  signerAadhaarHash: string | null;

  @Column({ name: 'consent_taken', default: false })
  consentTaken: boolean;

  @Column({ name: 'consent_timestamp', type: 'timestamptz', nullable: true })
  consentTimestamp: Date | null;

  @Column({ name: 'consent_ip', type: 'varchar', length: 45, nullable: true })
  consentIp: string | null;

  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true })
  signedAt: Date | null;

  @Column({ type: 'varchar', length: 20, default: SignatureStatus.PENDING })
  signatureStatus: SignatureStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'signed_document_key', type: 'varchar', length: 500, nullable: true })
  signedDocumentKey: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
