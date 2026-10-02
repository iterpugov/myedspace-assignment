import { Logger, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { IdentityService } from './identity.service';
import { SESSION_ALGORITHM, SESSION_LIFETIME_SECONDS } from './session.constants';
import { SessionController } from './session.controller';
import { resolveSessionSecret } from './session-secret';
import { SessionService } from './session.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      // A factory, so the environment is read when the app starts, not when this file is imported.
      useFactory: () => {
        const configured = process.env.JWT_SECRET;
        if (!configured) {
          new Logger('IdentityModule').warn(
            'JWT_SECRET is not set: using a random signing secret, so sessions end when the API restarts',
          );
        }
        return {
          secret: resolveSessionSecret(configured),
          signOptions: { algorithm: SESSION_ALGORITHM, expiresIn: SESSION_LIFETIME_SECONDS },
          verifyOptions: { algorithms: [SESSION_ALGORITHM] },
        };
      },
    }),
  ],
  controllers: [SessionController],
  providers: [IdentityService, SessionService],
  // JwtModule stays private: only SessionService may sign or verify a token.
  exports: [IdentityService, SessionService],
})
export class IdentityModule {}
