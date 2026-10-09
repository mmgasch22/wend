// Bucle de lectura del escáner: pide un intento de lectura tras otro (nunca
// dos a la vez) hasta conseguir UN código aceptable, y entonces se detiene.
//
// Una cámara enfocada al mismo código lo "ve" decenas de veces por segundo.
// Sin este control, cada lectura provocaría una consulta y un posible
// registro; aquí un código solo sale una vez, y lo que llegue después (un
// intento que ya estaba en curso al detenerlo, por ejemplo) se descarta.

export interface ScanLoopOptions {
  // Un intento de lectura: devuelve el texto leído o null si no hay nada.
  // Recibe el número de intento (0, 1, 2...) para poder alternar la forma de
  // analizar. Si lanza, se trata como "nada leído" y se sigue intentando.
  detect: (attempt: number) => Promise<string | null> | string | null;
  // Se llama como máximo una vez, con el primer código aceptado.
  onCode: (raw: string) => void;
  // Descarta lecturas dudosas (p. ej. dígito de control incorrecto) sin parar.
  isAcceptable?: (raw: string) => boolean;
  intervalMs?: number;
}

export interface ScanLoop {
  start(): void;
  stop(): void;
}

export function createScanLoop({
  detect,
  onCode,
  isAcceptable = () => true,
  intervalMs = 150,
}: ScanLoopOptions): ScanLoop {
  let running = false;
  let delivered = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function tick() {
    timer = null;
    if (!running) return;

    let raw: string | null = null;
    try {
      raw = await detect(attempt++);
    } catch {
      raw = null;
    }

    // Se detuvo mientras se leía: el resultado ya no interesa.
    if (!running) return;

    if (raw !== null && isAcceptable(raw) && !delivered) {
      delivered = true;
      running = false;
      onCode(raw);
      return;
    }

    timer = setTimeout(tick, intervalMs);
  }

  return {
    start() {
      if (running || delivered) return;
      running = true;
      timer = setTimeout(tick, 0);
    },
    stop() {
      running = false;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
