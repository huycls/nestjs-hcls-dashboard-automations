import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { JobStatus } from '../jobs.constants';

@Entity('automation_jobs')
export class AutomationJobEntity {
  @PrimaryColumn('text')
  id: string;

  @Column('text', { nullable: true })
  siteId: string | null;

  @Column('text')
  workflowId: string;

  @Column('text')
  topic: string;

  @Column('text', { default: 'queued' })
  status: JobStatus;

  @Column('simple-json', { nullable: true })
  n8nResponse: Record<string, unknown> | null;

  @Column('simple-json', { nullable: true })
  callbackPayload: Record<string, unknown> | null;

  @Column('text', { nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column('datetime', { nullable: true })
  completedAt: Date | null;
}
