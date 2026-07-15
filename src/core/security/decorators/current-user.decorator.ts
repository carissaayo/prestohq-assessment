import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type JwtPayloadUser = {
  userId: string;
  email: string;
  username: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayloadUser | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtPayloadUser }>();
    return request.user;
  },
);
