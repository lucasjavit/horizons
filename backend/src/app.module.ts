import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProgressModule } from './progress/progress.module';
import { JobsModule } from './jobs/jobs.module';
import { SettingsModule } from './settings/settings.module';
import { TracksModule } from './tracks/tracks.module';

@Module({
  imports: [
    // O agendador da busca em segundo plano (JOB-03). O job so roda se a
    // flag `jobs.buscaAgendada` estiver ligada — registrar o cron nao liga
    // nada sozinho.
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    TracksModule,
    ProgressModule,
    SettingsModule,
    JobsModule,
  ],
})
export class AppModule {}
