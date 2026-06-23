import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { NodeTypeId } from '../data';
import { WorkflowEntity } from './workflow.entity';

@Entity('workflow_node_credentials')
@Index(['workflowId', 'nodeTypeId'], { unique: true })
export class WorkflowNodeCredentialEntity {
  @PrimaryColumn('text')
  id: string;

  @Column('text')
  workflowId: string;

  @ManyToOne(() => WorkflowEntity, (workflow) => workflow.nodeCredentials, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workflowId' })
  workflow: WorkflowEntity;

  @Column('text')
  nodeTypeId: NodeTypeId;

  @Column('text')
  credentialId: string;

  @Column('simple-json', { nullable: true })
  config: Record<string, string> | null;
}
