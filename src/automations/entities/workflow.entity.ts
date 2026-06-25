import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { WorkflowStatus, WorkflowType } from '../data';
import { WorkflowNodeCredentialEntity } from './workflow-node-credential.entity';

@Entity('workflows')
export class WorkflowEntity {
  @PrimaryColumn('text')
  id: string;

  @Column('text')
  name: string;

  @Column('text')
  type: WorkflowType;

  @Column('text', { default: 'Draft' })
  status: WorkflowStatus;

  /** Status trước khi chạy job — dùng để restore khi hoàn thành */
  @Column('text', { nullable: true })
  statusBeforeRun: WorkflowStatus | null;

  @Column('int', { default: 0 })
  triggers: number;

  @Column('text', { default: '' })
  topic: string;

  @Column('boolean', { default: false })
  useProductionWebhook: boolean;

  @Column('text', { default: '' })
  webhookTestUrl: string;

  @Column('text', { default: '' })
  webhookProductionUrl: string;

  /** ID site từ Next.js — dùng để lookup credentials khi trigger */
  @Column('text', { unique: true, nullable: true })
  siteId: string | null;

  @OneToMany(() => WorkflowNodeCredentialEntity, (node) => node.workflow, {
    cascade: true,
    eager: true,
  })
  nodeCredentials: WorkflowNodeCredentialEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
