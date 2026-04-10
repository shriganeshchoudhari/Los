import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { UserRole, UserStatus } from '@los/common';

@Entity('users')
@Index('idx_users_mobile_hash', ['mobileHash'])
@Index('idx_users_role_status', ['role', 'status'])
@Index('idx_users_employee_id', ['employeeId'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', unique: true, nullable: true, length: 20 })
  employeeId?: string;

  @Column({ name: 'full_name', length: 200 })
  fullName: string;

  @Column({ length: 254, nullable: true })
  email?: string;

  @Column({ length: 10, unique: true })
  mobile: string;

  @Column({ name: 'mobile_hash', length: 64 })
  mobileHash: string;

  @Column({ length: 30 })
  role: UserRole;

  @Column({ length: 20, default: 'ACTIVE' })
  status: UserStatus;

  @Column({ name: 'branch_code', length: 10, nullable: true })
  branchCode?: string;

  @Column({ name: 'pan_number_encrypted', type: 'jsonb', nullable: true })
  panNumberEncrypted?: Record<string, unknown>;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date;

  @Column({ name: 'failed_login_attempts', default: 0 })
  failedLoginAttempts: number;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
