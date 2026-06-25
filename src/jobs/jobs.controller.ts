import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { N8nCallbackDto } from './dto/n8n-callback.dto';
import { N8nErrorDto } from './dto/n8n-error.dto';
import { N8nSuccessDto } from './dto/n8n-success.dto';
import { RunJobDto } from './dto/run-job.dto';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post('run')
  run(@Body() body: RunJobDto) {
    return this.jobsService.run(body);
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }
}
