// Fotogramas sintéticos para medir el lector SIN cámara. Solo se importa desde
// pruebas: no entra en el código que se envía al navegador.
//
// Todo es determinista (semilla fija) para que una medida se pueda repetir.
// Un fotograma es un array de luminancia (0-255), una posición por píxel.

const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

// Los 95 módulos (1 = barra, 0 = espacio) de un EAN-13.
export function ean13Modules(code: string): number[] {
  const d = [...code].map(Number);
  let bits = "101";
  for (let i = 0; i < 6; i++) bits += (PARITY[d[0]][i] === "L" ? L : G)[d[i + 1]];
  bits += "01010";
  for (let i = 0; i < 6; i++) bits += R[d[i + 7]];
  bits += "101";
  return [...bits].map(Number);
}

// Generador pseudoaleatorio con semilla (mulberry32).
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random: () => number): number {
  const u = Math.max(random(), 1e-12);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface FrameSpec {
  width: number;
  height: number;
  code: string;
  // Anchura en píxeles de UN módulo (la barra más fina). Admite decimales.
  modulePx: number;
  // Centro del código dentro del fotograma, en píxeles.
  centerX: number;
  centerY: number;
  // Altura del código en píxeles.
  codeHeightPx: number;
  // Desenfoque (desviación típica, en píxeles del fotograma).
  blurSigmaPx?: number;
  // Ruido del sensor (desviación típica, en niveles de gris).
  noiseSigma?: number;
  seed?: number;
}

const BACKGROUND = 225;
const INK = 35;
const QUIET_MODULES = 9;

export function renderFrame(spec: FrameSpec): Uint8ClampedArray {
  const { width, height, modulePx, blurSigmaPx = 0, noiseSigma = 0, seed = 1 } = spec;
  const modules = ean13Modules(spec.code);
  const totalModules = modules.length + QUIET_MODULES * 2;
  const x0 = spec.centerX - (totalModules * modulePx) / 2;

  // Cobertura de tinta de cada columna (integrando exactamente las barras).
  const coverage = new Float64Array(width);
  modules.forEach((on, i) => {
    if (!on) return;
    const start = x0 + (QUIET_MODULES + i) * modulePx;
    const end = start + modulePx;
    for (let px = Math.max(0, Math.floor(start)); px < Math.min(width, Math.ceil(end)); px++) {
      coverage[px] += Math.max(0, Math.min(end, px + 1) - Math.max(start, px));
    }
  });

  // Desenfoque horizontal (el de las barras verticales; el vertical no importa).
  let columns = coverage;
  if (blurSigmaPx > 0) {
    const radius = Math.ceil(blurSigmaPx * 3);
    const kernel: number[] = [];
    let sum = 0;
    for (let k = -radius; k <= radius; k++) {
      const w = Math.exp(-(k * k) / (2 * blurSigmaPx * blurSigmaPx));
      kernel.push(w);
      sum += w;
    }
    const blurred = new Float64Array(width);
    for (let px = 0; px < width; px++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const j = Math.min(width - 1, Math.max(0, px + k));
        acc += coverage[j] * kernel[k + radius];
      }
      blurred[px] = acc / sum;
    }
    columns = blurred;
  }

  const row = new Float64Array(width);
  for (let px = 0; px < width; px++) {
    row[px] = BACKGROUND + (INK - BACKGROUND) * Math.min(1, columns[px]);
  }

  const top = Math.round(spec.centerY - spec.codeHeightPx / 2);
  const bottom = Math.round(spec.centerY + spec.codeHeightPx / 2);
  const random = seededRandom(seed);
  const out = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    const inside = y >= top && y < bottom;
    for (let px = 0; px < width; px++) {
      const base = inside ? row[px] : BACKGROUND;
      out[y * width + px] = noiseSigma > 0 ? base + gaussian(random) * noiseSigma : base;
    }
  }
  return out;
}

// Recorta una región (en píxeles enteros).
export function cropLuminance(
  src: Uint8ClampedArray,
  srcWidth: number,
  region: { sx: number; sy: number; sw: number; sh: number },
): { data: Uint8ClampedArray; width: number; height: number } {
  const sx = Math.round(region.sx);
  const sy = Math.round(region.sy);
  const width = Math.round(region.sw);
  const height = Math.round(region.sh);
  const data = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    data.set(src.subarray((sy + y) * srcWidth + sx, (sy + y) * srcWidth + sx + width), y * width);
  }
  return { data, width, height };
}

// Reduce promediando el área cubierta por cada píxel nuevo, que es lo que hace
// (aproximadamente) un navegador al dibujar un vídeo grande en un canvas
// pequeño.
export function resizeLuminance(
  src: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
): Uint8ClampedArray {
  if (dstWidth === srcWidth && dstHeight === srcHeight) return src;
  const out = new Uint8ClampedArray(dstWidth * dstHeight);
  const xr = srcWidth / dstWidth;
  const yr = srcHeight / dstHeight;
  for (let y = 0; y < dstHeight; y++) {
    const y0 = y * yr;
    const y1 = (y + 1) * yr;
    for (let x = 0; x < dstWidth; x++) {
      const x0 = x * xr;
      const x1 = (x + 1) * xr;
      let acc = 0;
      let weight = 0;
      for (let sy = Math.floor(y0); sy < Math.min(srcHeight, Math.ceil(y1)); sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        for (let sx = Math.floor(x0); sx < Math.min(srcWidth, Math.ceil(x1)); sx++) {
          const wx = Math.min(x1, sx + 1) - Math.max(x0, sx);
          acc += src[sy * srcWidth + sx] * wx * wy;
          weight += wx * wy;
        }
      }
      out[y * dstWidth + x] = acc / weight;
    }
  }
  return out;
}
