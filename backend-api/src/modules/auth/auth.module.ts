import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { JwtStrategy } from '../../common/auth/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
	imports: [UsersModule, PassportModule, JwtModule.register({})],
	providers: [AuthService, JwtStrategy],
	controllers: [AuthController],
	exports: [AuthService, JwtModule],
})
export class AuthModule {}
