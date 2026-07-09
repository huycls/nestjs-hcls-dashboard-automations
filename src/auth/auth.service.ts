import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import {
  getJwtAccessExpiresIn,
  getJwtAccessSecret,
  getJwtRefreshExpiresIn,
  getJwtRefreshSecret,
} from '../config/env';
import type { AuthTokens, JwtPayload, PublicUser } from './auth.types';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { User, UserDocument } from './schemas/user.schema';

const BCRYPT_ROUNDS = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const email = dto.email?.trim().toLowerCase();
    const password = dto.password?.trim();
    const name = dto.name?.trim();

    this.assertRegisterInput(email, password, name);

    const existing = await this.userModel.findOne({ email }).exec();

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await this.userModel.create({
      email,
      passwordHash,
      name,
    });

    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const email = dto.email?.trim().toLowerCase();
    const password = dto.password?.trim();

    if (!email || !password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const user = await this.userModel
      .findOne({ email })
      .select('+passwordHash +refreshTokenHash')
      .exec();

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const token = refreshToken?.trim();

    if (!token) {
      throw new UnauthorizedException('Refresh token is required');
    }

    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret: getJwtRefreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userModel
      .findById(payload.sub)
      .select('+refreshTokenHash')
      .exec();

    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenMatches = await bcrypt.compare(token, user.refreshTokenHash);

    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<{ ok: true }> {
    await this.userModel
      .updateOne({ _id: userId }, { $set: { refreshTokenHash: null } })
      .exec();

    return { ok: true };
  }

  async upsertAdmin(dto: RegisterDto): Promise<PublicUser> {
    const email = dto.email?.trim().toLowerCase();
    const password = dto.password?.trim();
    const name = dto.name?.trim();

    this.assertRegisterInput(email, password, name);

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const existing = await this.userModel.findOne({ email }).exec();

    if (existing) {
      existing.name = name;
      existing.passwordHash = passwordHash;
      existing.role = 'admin';
      existing.emailVerified = true;
      await existing.save();
      return this.toPublicUser(existing);
    }

    const user = await this.userModel.create({
      email,
      passwordHash,
      name,
      role: 'admin',
      emailVerified: true,
    });

    return this.toPublicUser(user);
  }

  toPublicUser(user: UserDocument): PublicUser {
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private assertRegisterInput(
    email: string,
    password: string,
    name: string,
  ): void {
    if (!email || !EMAIL_PATTERN.test(email)) {
      throw new BadRequestException('A valid email is required');
    }

    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    if (!name) {
      throw new BadRequestException('Name is required');
    }
  }

  private async issueTokens(user: UserDocument): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: getJwtAccessSecret(),
      expiresIn: getJwtAccessExpiresIn() as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: getJwtRefreshSecret(),
      expiresIn: getJwtRefreshExpiresIn() as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    user.refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    await user.save();

    return {
      accessToken,
      refreshToken,
      user: this.toPublicUser(user),
    };
  }
}
