import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginGoogleDto {
  @IsString()
  @MinLength(20)
  // Um ID token do Google tem ~1KB; o teto evita corpo absurdo chegar ao
  // verificador.
  @MaxLength(4096)
  idToken!: string;
}
