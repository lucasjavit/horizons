import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Cifragem simetrica do que e guardado no banco: tokens de API, e os
 * documentos do perfil (PLT-10).
 *
 * AES-256-GCM: alem de cifrar, autentica — um valor adulterado no banco falha
 * ao decifrar em vez de devolver lixo silenciosamente.
 *
 * A chave vem de ENCRYPTION_KEY. Sem ela o modulo nao sobe, de proposito:
 * guardar token em texto claro por descuido de configuracao seria pior que
 * nao ter a funcionalidade.
 */

const ALGORITMO = 'aes-256-gcm';

/**
 * Os dominios de cifragem, e por que sao mais de um.
 *
 * Cada salt deriva uma chave DIFERENTE da mesma `ENCRYPTION_KEY`. Entao quem
 * quebrar os tokens de IA nao ganha nada contra os documentos, e vice-versa —
 * e a razao de o PLT-09 exigir salt proprio para o documento.
 *
 * A funcao recebe o salt em vez de o arquivo ser duplicado: duas copias do
 * mesmo AES-GCM divergem com o tempo, e um conserto de seguranca teria de ser
 * aplicado duas vezes.
 *
 * ⚠️ **Trocar o valor de um salt torna ilegivel tudo o que ja foi gravado com
 * ele.** Estas strings sao permanentes.
 */
export const SALT_TOKENS = 'horizons.api-tokens';
export const SALT_DOCUMENTOS = 'horizons.documentos-pessoais';

function chave(salt: string): Buffer {
  const bruta = process.env.ENCRYPTION_KEY;
  if (!bruta || bruta.length < 16) {
    throw new Error(
      'ENCRYPTION_KEY nao definida (ou curta demais) — veja backend/.env.example',
    );
  }
  // scrypt deriva 32 bytes de qualquer texto, entao a chave do .env pode ser
  // uma frase legivel em vez de hex.
  return scryptSync(bruta, salt, 32);
}

/**
 * Formato guardado: iv:tag:conteudo, tudo em base64url.
 *
 * O `salt` e obrigatorio de proposito — sem default, quem acrescentar um dado
 * cifrado novo precisa decidir a qual dominio ele pertence, em vez de cair no
 * dos tokens por omissao.
 */
export function cifrar(texto: string, salt: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITMO, chave(salt), iv);
  const conteudo = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, conteudo].map((b) => b.toString('base64url')).join(':');
}

/**
 * Decifra o que `cifrar` gravou com o MESMO salt.
 *
 * Salt errado nao devolve lixo: o GCM autentica, entao a tag nao confere e o
 * `final()` lanca. E o comportamento desejado — falhar alto e melhor que
 * devolver um documento corrompido para dentro de uma nota fiscal.
 */
export function decifrar(guardado: string, salt: string): string {
  const partes = guardado.split(':');
  if (partes.length !== 3) throw new Error('Valor guardado em formato invalido');
  const [iv, tag, conteudo] = partes.map((p) => Buffer.from(p, 'base64url'));
  const decipher = createDecipheriv(ALGORITMO, chave(salt), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(conteudo), decipher.final()]).toString('utf8');
}
