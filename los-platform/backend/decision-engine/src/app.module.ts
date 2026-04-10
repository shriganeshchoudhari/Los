import { Module } from '@nestjs/common';
import { DecisionModule } from './src/decision.module';

@Module({
  imports: [DecisionModule],
})
export class AppModule {}
