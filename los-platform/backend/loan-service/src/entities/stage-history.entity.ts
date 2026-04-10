import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('application_stage_history')
@Index('idx_stage_app_id', ['applicationId', 'timestamp'])
export class ApplicationStageHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id' })
  applicationId: string;

  @Column({ name: 'from_status', length: 40, nullable: true })
  fromStatus?: string;

  @Column({ name: 'to_status', length: 40 })
  toStatus: string;

  @Column({ name: 'action_by', nullable: true })
  actionBy?: string;

  @Column({ name: 'action_by_role', length: 30, nullable: true })
  actionByRole?: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @CreateDateColumn({ name: 'timestamp', type: 'timestamptz' })
  timestamp: Date;
}
