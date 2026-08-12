import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestWithUser } from './current-user';

/**
 * Autenticacao provisoria: app pessoal, sem login.
 * O usuario vem do header `x-user-email` ou, na falta dele, do usuario padrao
 * criado pelo seed (DEFAULT_USER_EMAIL). Toda a logica de identidade esta
 * confinada aqui — trocar por JWT depois nao toca em controller nenhum.
 */
@Injectable()
export class CurrentUserGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const headerEmail = request.headers['x-user-email'];
    const email =
      (typeof headerEmail === 'string' && headerEmail.trim()) ||
      process.env.DEFAULT_USER_EMAIL ||
      'eu@horizons.local';

    // upsert: um email novo no header cria a conta na hora, sem tela de cadastro.
    const user = await this.prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: email.split('@')[0] },
      select: { id: true, email: true, name: true },
    });

    request.user = user;
    return true;
  }
}
