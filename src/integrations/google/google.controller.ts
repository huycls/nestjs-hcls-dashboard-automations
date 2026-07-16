import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Patch,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { UserDocument } from '../../auth/schemas/user.schema';
import { UpdateGoogleSpreadsheetDto } from './dto/update-google-spreadsheet.dto';
import { GoogleOAuthService } from './google-oauth.service';

@Controller('integrations/google')
export class GoogleIntegrationsController {
  private readonly logger = new Logger(GoogleIntegrationsController.name);

  constructor(private readonly googleOAuthService: GoogleOAuthService) {}

  @Get('auth-url')
  @UseGuards(JwtAuthGuard)
  getAuthUrl(
    @CurrentUser() user: UserDocument,
    @Query('returnUrl') returnUrl?: string,
  ) {
    return this.googleOAuthService.getAuthUrl(
      user._id.toString(),
      returnUrl ?? '',
    );
  }

  /** Browser redirect từ Google — không có JWT */
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    try {
      if (error) {
        this.logger.warn(`Google OAuth denied: ${error}`);
        const fallback = this.googleOAuthService.buildFrontendRedirect(
          '',
          'error',
        );
        return res.redirect(fallback);
      }

      const redirectUrl = await this.googleOAuthService.handleCallback(
        code,
        state,
      );
      return res.redirect(redirectUrl);
    } catch (callbackError) {
      this.logger.warn(
        `Google OAuth callback failed: ${
          callbackError instanceof Error
            ? callbackError.message
            : String(callbackError)
        }`,
      );

      const fallback = this.googleOAuthService.buildFrontendRedirect(
        '',
        'error',
      );
      return res.redirect(fallback);
    }
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  getStatus(@CurrentUser() user: UserDocument) {
    return this.googleOAuthService.getStatus(user._id.toString());
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  updateSpreadsheet(
    @CurrentUser() user: UserDocument,
    @Body() body: UpdateGoogleSpreadsheetDto,
  ) {
    if (!body?.spreadsheetId?.trim()) {
      throw new BadRequestException('spreadsheetId is required');
    }
    return this.googleOAuthService.updateSpreadsheetId(
      user._id.toString(),
      body.spreadsheetId,
    );
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  disconnect(@CurrentUser() user: UserDocument) {
    return this.googleOAuthService.disconnect(user._id.toString());
  }
}
