import { Module } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

// PrismaModule e @Global() — nao se importa aqui, so se injeta o servico.
@Module({
  controllers: [UsuariosController],
  providers: [UsuariosService],
})
export class UsuariosModule {}
