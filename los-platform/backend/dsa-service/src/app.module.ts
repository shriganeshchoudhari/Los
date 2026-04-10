import { Module } from '@nestjs/common';
import { DSAModule } from './src/dsa.module';

@Module({
  imports: [DSAModule],
})
export class AppModule {}
