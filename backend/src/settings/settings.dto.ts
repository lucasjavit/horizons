import { ApiProvider } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class SetTokenDto {
  @IsEnum(ApiProvider)
  provider!: ApiProvider;

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
