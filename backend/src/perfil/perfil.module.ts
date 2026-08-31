import { Module } from '@nestjs/common';
import { PerfilController } from './perfil.controller';
import { PerfilService } from './perfil.service';

// PrismaModule e @Global() — nao se importa aqui, so se injeta o servico.
@Module({
  controllers: [PerfilController],
  providers: [PerfilService],
})
export class PerfilModule {}
