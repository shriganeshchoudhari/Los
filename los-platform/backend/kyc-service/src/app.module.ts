import { Module } from '@nestjs/common';
import { KYCModule } from './src/kyc.module';

@Module({
  imports: [KYCModule],
})
export class AppModule {}
