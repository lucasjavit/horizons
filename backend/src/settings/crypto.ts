import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Cifragem dos tokens de API guardados no banco.
 *
 * AES-256-GCM: alem de cifrar, autentica — um valor adulterado no banco falha
 * ao decifrar em vez de devolver lixo silenciosamente.
 *
 * A chave vem de ENCRYPTION_KEY. Sem ela o modulo nao sobe, de proposito:
 * guardar token em texto claro por descuido de configuracao seria pior que
 * nao ter a funcionalidade.
 */

const ALGORITMO = 'aes-256-gcm';

function chave(): Buffer {
  const bruta = process.env.ENCRYPTION_KEY;
  if (!bruta || bruta.length < 16) {
    throw new Error(
      'ENCRYPTION_KEY nao definida (ou curta demais) — veja backend/.env.example',
    );
  }
  // scrypt deriva 32 bytes de qualquer texto, entao a chave do .env pode ser
  // uma frase legivel em vez de hex.
  return scryptSync(bruta, 'horizons.api-tokens', 32);
}

/** Formato guardado: iv:tag:conteudo, tudo em base64url. */
export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITMO, chave(), iv);
  const conteudo = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, conteudo].map((b) => b.toString('base64url')).join(':');
}

export function decifrar(guardado: string): string {
  const partes = guardado.split(':');
  if (partes.length !== 3) throw new Error('Token guardado em formato invalido');
  const [iv, tag, conteudo] = partes.map((p) => Buffer.from(p, 'base64url'));
  const decipher = createDecipheriv(ALGORITMO, chave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(conteudo), decipher.final()]).toString('utf8');
}
