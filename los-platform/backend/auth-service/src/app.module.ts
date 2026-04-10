import { Module } from '@nestjs/common';
import { AuthModule } from './src/auth.module';

@Module({
  imports: [AuthModule],
})
export class AppModule {}
