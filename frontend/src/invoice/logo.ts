/**
 * Leitura e redimensionamento da logo da empresa.
 *
 * Roda no navegador, como todo o resto da invoice. O arquivo original nao e
 * guardado: a imagem e reduzida antes de virar data URI, porque o
 * `localStorage` tem ~5 MB e uma foto de celular sozinha estoura isso.
 */

/** Maior lado da imagem guardada, em pixels. */
const MAX_LADO = 400

/** Teto do arquivo aceito, antes de reduzir. */
export const MAX_ARQUIVO = 2 * 1024 * 1024

export interface LogoLida {
  dataUri: string
  largura: number
  altura: number
}

/**
 * Converte para tons de cinza, na luminancia percebida.
 *
 * Nao e a media dos canais: o olho enxerga verde muito mais que azul, entao
 * (r+g+b)/3 achata cores distintas no mesmo cinza. Os pesos abaixo sao os da
 * recomendacao ITU-R BT.601, a mesma que TV usa ha decadas.
 *
 * O canal alfa e preservado — logo com fundo transparente continua sem fundo.
 */
function paraCinza(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const cinza = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
    d[i] = cinza
    d[i + 1] = cinza
    d[i + 2] = cinza
  }
  ctx.putImageData(img, 0, 0)
}

export function lerLogo(arquivo: File, cinza = false): Promise<LogoLida> {
  return new Promise((ok, erro) => {
    if (!arquivo.type.startsWith('image/')) {
      erro(new Error('That file is not an image.'))
      return
    }
    if (arquivo.size > MAX_ARQUIVO) {
      erro(new Error('Image is too large — 2 MB maximum.'))
      return
    }

    const leitor = new FileReader()
    leitor.onerror = () => erro(new Error('Could not read the file.'))
    leitor.onload = () => {
      const img = new Image()
      img.onerror = () => erro(new Error('Could not read the image.'))
      img.onload = () => {
        // Reduz mantendo a proporcao: no PDF a logo ocupa ~35mm, entao
        // 400px de lado maior ja sobra para impressao.
        const escala = Math.min(1, MAX_LADO / Math.max(img.width, img.height))
        const largura = Math.round(img.width * escala)
        const altura = Math.round(img.height * escala)

        const canvas = document.createElement('canvas')
        canvas.width = largura
        canvas.height = altura
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          erro(new Error('Could not process the image.'))
          return
        }
        ctx.drawImage(img, 0, 0, largura, altura)
        if (cinza) paraCinza(ctx, largura, altura)

        // PNG preserva transparencia, que quase toda logo usa. JPEG poria
        // fundo preto onde deveria haver papel.
        ok({ dataUri: canvas.toDataURL('image/png'), largura, altura })
      }
      img.src = leitor.result as string
    }
    leitor.readAsDataURL(arquivo)
  })
}
