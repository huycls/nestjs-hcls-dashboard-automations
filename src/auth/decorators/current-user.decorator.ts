import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserDocument } from '../schemas/user.schema';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserDocument => {
    const request = ctx.switchToHttp().getRequest<{ user: UserDocument }>();
    return request.user;
  },
);
