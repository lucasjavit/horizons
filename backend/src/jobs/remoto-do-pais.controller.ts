import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user';
import type { AuthUser } from '../auth/current-user';
import { RemotoDoPaisService } from './remoto-do-pais.service';
import { VerificarRemotoDto, type RemotoDoPaisDto } from './remoto-do-pais.dto';

/**
 * A IA verifica as vagas da pagina visivel (JOB-55).
 *
 * Sem `@Public()` nem `@SessaoOpcional()`: anonimo nao tem a verificacao —
 * ela gasta, e depende do pais do perfil. `POST` porque gasta: ate 25
 * chamadas de IA na primeira vez que uma pagina e vista.
 */
@Controller('jobs/remote-check')
export class RemotoDoPaisController {
  constructor(private readonly remoto: RemotoDoPaisService) {}

  @Post()
  verificar(
    @CurrentUser() usuario: AuthUser,
    @Body() corpo: VerificarRemotoDto,
  ): Promise<RemotoDoPaisDto> {
    return this.remoto.verificar(usuario.id, corpo.ids);
  }
}
