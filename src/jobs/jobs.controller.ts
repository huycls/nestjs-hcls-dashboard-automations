import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UserDocument } from '../auth/schemas/user.schema';
import { N8nCallbackDto } from './dto/n8n-callback.dto';
import { N8nErrorDto } from './dto/n8n-error.dto';
import { N8nSuccessDto } from './dto/n8n-success.dto';
import { RunJobDto } from './dto/run-job.dto';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

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
}
