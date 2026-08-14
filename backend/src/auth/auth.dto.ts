import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginGoogleDto {
  @IsString()
  @MinLength(20)
  // Um ID token do Google tem ~1KB; o teto evita corpo absurdo chegar ao
  // verificador.
  @MaxLength(4096)
  idToken!: string;
}

/**
 * O que `GET /auth/config` devolve.
 *
 * `authDisabled` faz parte do contrato: o front decide por ele se mostra a
 * tela de login, e o roteiro de verificacao do deploy (docs/DEPLOY.md) le
 * este campo para conferir que o servidor subiu com o login exigido.
 */
export interface AuthConfigDto {
  googleClientId: string | null;
  enabled: boolean;
  authDisabled: boolean;
}
