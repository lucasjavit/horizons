import { ApiProvider } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class SetTokenDto {
  @IsEnum(ApiProvider)
  provider!: ApiProvider;

  // **O `trim` vem ANTES do `MinLength`.** Medido pelo QA em 25/08: onze
  // espacos passavam no `MinLength(8)` e gravavam uma linha com `hint` vazio.
  // A cadeia nao era envenenada — o servico apara na leitura e o provedor
  // voltava como `sem_chave` —, mas a pessoa via "salvei" e a tela continuava
  // dizendo "No key", sem explicacao nenhuma. Colar uma chave com espaco em
  // volta e engano comum, e agora funciona em vez de falhar em silencio.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  token!: string;
}

/**
 * Resposta de token. O valor NUNCA sai daqui — so o final, para a pessoa
 * reconhecer qual chave esta guardada.
 */
export interface ApiTokenDto {
  provider: ApiProvider;
  hint: string;
  updatedAt: string;
}
