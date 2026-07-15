import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UserDocument } from '../auth/schemas/user.schema';
import { CreateJobDto } from './dto/create-job.dto';
import { N8nCallbackDto } from './dto/n8n-callback.dto';
import { N8nErrorDto } from './dto/n8n-error.dto';
import { N8nSuccessDto } from './dto/n8n-success.dto';
import { RunJobDto } from './dto/run-job.dto';
import { UpdateJobNodeConfigDto } from './dto/update-job-node-config.dto';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /** Tạo automation instance trong `automation_jobs` (ref workflow type) */
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: UserDocument, @Body() body: CreateJobDto) {
    return this.jobsService.create(body, user._id.toString());
  }

  @Post('run')
  @UseGuards(JwtAuthGuard)
  run(@CurrentUser() user: UserDocument, @Body() body: RunJobDto) {
    return this.jobsService.run(body, user._id.toString());
  }

  @Post('callback')
  callback(
    @Body() body: N8nCallbackDto,
    @Headers('x-n8n-callback-secret') secret?: string,
  ) {
    return this.jobsService.handleCallback(body, secret);
  }

  @Post('error')
  reportError(
    @Body() body: N8nErrorDto,
    @Headers('x-n8n-callback-secret') secret?: string,
  ) {
    return this.jobsService.handleError(body, secret);
  }

  /** n8n báo thành công — tăng triggers + restore workflow status */
  @Post('success')
  @Put('success')
  reportSuccess(
    @Body() body: N8nSuccessDto,
    @Headers('x-n8n-callback-secret') secret?: string,
  ) {
    return this.jobsService.handleSuccess(body, secret);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @CurrentUser() user: UserDocument,
    @Query('workflowId') workflowId?: string,
  ) {
    return this.jobsService.findAll(user._id.toString(), workflowId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.jobsService.findOne(id, user._id.toString());
  }

  /** Save node config + credentials trên job — không ghi vào workflows */
  @Patch(':id/node-config')
  @UseGuards(JwtAuthGuard)
  updateNodeConfig(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() body: UpdateJobNodeConfigDto,
  ) {
    return this.jobsService.updateNodeConfig(id, body, user._id.toString());
  }
}
