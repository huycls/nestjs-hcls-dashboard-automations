import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { N8nCallbackDto } from './dto/n8n-callback.dto';
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }
}
