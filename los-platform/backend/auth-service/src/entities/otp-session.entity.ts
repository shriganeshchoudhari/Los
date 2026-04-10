import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum OtpPurpose {
  LOGIN = 'LOGIN',
  AADHAAR_CONSENT = 'AADHAAR_CONSENT',
  LOAN_APPLICATION_SUBMIT = 'LOAN_APPLICATION_SUBMIT',
  DISBURSEMENT_CONFIRM = 'DISBURSEMENT_CONFIRM',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

@Entity('otp_sessions')
@Index('idx_otp_sessions_mobile_hash_expires', ['mobileHash', 'expiresAt'], { where: 'is_used = FALSE' })
export class OtpSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mobile_hash', length: 64 })
  mobileHash: string;

  @Column({ name: 'otp_hash', length: 60 })
  otpHash: string;

  @Column({ length: 30 })
  purpose: OtpPurpose;

  @Column({ default: 0 })
  attempts: number;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'is_used', default: false })
  isUsed: boolean;

  @Column({ name: 'ip_address', type: 'inet' })
  ipAddress: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
