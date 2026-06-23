import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { getSocketCorsOptions } from '../config/cors';
import type { JobStatus } from './jobs.constants';

export type JobStatusEvent = {
  id: string;
  siteId: string | null;
  workflowId: string;
  topic: string;
  status: JobStatus;
  errorMessage?: string | null;
  n8n?: {
    ok: boolean;
    status: number;
    message: string;
    webhookUrl?: string;
  } | null;
  completedAt?: string | null;
  updatedAt: string;
};

@WebSocketGateway({
  namespace: '/jobs',
  cors: getSocketCorsOptions(),
})
export class JobsGateway {
  @WebSocketServer()
  server: Server;

  emitJobStatus(job: JobStatusEvent) {
    this.server.to(`job:${job.id}`).emit('job:status', job);

    if (job.siteId) {
      this.server.to(`site:${job.siteId}`).emit('job:status', job);
    }
  }

  @SubscribeMessage('subscribe:job')
  handleSubscribeJob(
    @ConnectedSocket() client: Socket,
    @MessageBody() jobId: string,
  ) {
    client.join(`job:${jobId}`);
    return { ok: true, room: `job:${jobId}` };
  }

  @SubscribeMessage('subscribe:site')
  handleSubscribeSite(
    @ConnectedSocket() client: Socket,
    @MessageBody() siteId: string,
  ) {
    client.join(`site:${siteId}`);
    return { ok: true, room: `site:${siteId}` };
  }
}
