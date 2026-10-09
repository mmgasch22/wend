"use client";

import { useEffect, useRef, useState } from "react";
import { parseBarcode } from "@/lib/food/barcode";
import {
  classifyCameraError,
  getCameraSupport,
  initialZoom,
  parseScannerProfile,
  readCameraCapabilities,
  scannerVideoConstraints,
  scanHint,
  zoomPresets,
  type CameraCapabilities,
  type CameraProblem,
} from "@/lib/food/scanner/camera";
import { GUIDE_INSET_X, GUIDE_INSET_Y } from "@/lib/food/scanner/analysis";
import { createBarcodeReader, type BarcodeReader } from "@/lib/food/scanner/detectors";
import { SCAN_VIEW_ASPECT_RATIO } from "@/lib/food/scanner/region";
import { createScanLoop, type ScanLoop } from "@/lib/food/scanner/scanLoop";

const ZOOM_STORAGE_KEY = "wend.scanner.zoom";

// Preferencia del propio móvil (no se envía a ningún sitio). Todo con
// try/catch: en modo privado o con el almacenamiento bloqueado puede fallar.
function readStoredZoom(): number | null {
  try {
    const value = Number(window.localStorage.getItem(ZOOM_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function storeZoom(value: number) {
  try {
    window.localStorage.setItem(ZOOM_STORAGE_KEY, String(value));
  } catch {
    // Sin almacenamiento: el zoom simplemente no se recuerda.
  }
}

async function applyZoom(track: MediaStreamTrack, value: number): Promise<boolean> {
  try {
    await track.applyConstraints({
      advanced: [{ zoom: value } as MediaTrackConstraintSet],
    });
    return true;
  } catch {
    return false;
  }
}

interface ZoomState {
  presets: number[];
  current: number;
}

// La cámara y la lectura. Existe solo mientras se está escaneando: al
// desmontarse (código leído, cancelar, cambiar de pantalla) libera la cámara.
export default function ScanCamera({
  onCode,
  onProblem,
}: {
  onCode: (code: string) => void;
  onProblem: (problem: CameraProblem) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState<ZoomState | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [diag, setDiag] = useState<string | null>(null);

  // Las funciones del padre cambian en cada render; se guardan en refs para
  // que la cámara no se reinicie cada vez que el padre se vuelve a pintar.
  const onCodeRef = useRef(onCode);
  const onProblemRef = useRef(onProblem);
  useEffect(() => {
    onCodeRef.current = onCode;
    onProblemRef.current = onProblem;
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const support = getCameraSupport({
      isSecureContext: window.isSecureContext,
      mediaDevices: navigator.mediaDevices,
    });
    if (support !== "ok") {
      onProblemRef.current(support);
      return;
    }

    // `?scanner=anterior` y `?diag=1` en la dirección: para comparar con la
    // versión anterior y ver datos técnicos de la cámara al probar en un móvil.
    const query = new URLSearchParams(window.location.search);
    const profile = parseScannerProfile(query.get("scanner"));
    const diagnostics = query.get("diag") === "1";

    let cancelled = false;
    let stream: MediaStream | null = null;
    let reader: BarcodeReader | null = null;
    let loop: ScanLoop | null = null;
    let ticker: ReturnType<typeof setInterval> | null = null;
    let capabilities: CameraCapabilities | null = null;
    let attempts = 0;

    function release() {
      if (ticker) clearInterval(ticker);
      loop?.stop();
      reader?.dispose();
      stream?.getTracks().forEach((track) => track.stop());
      trackRef.current = null;
      if (video) video.srcObject = null;
    }

    function describe(startedAt: number): string {
      const track = trackRef.current;
      const settings = (track?.getSettings?.() ?? {}) as MediaTrackSettings & { zoom?: number };
      const stats = reader?.stats();
      const elapsed = Math.round((performance.now() - startedAt) / 100) / 10;
      const zoomRange = capabilities?.zoom;
      return [
        `perfil: ${profile}`,
        `lector: ${reader?.kind ?? "-"}`,
        `cámara: ${track?.label || "(sin nombre)"}`,
        `flujo: ${settings.width ?? "?"}x${settings.height ?? "?"} a ${Math.round(settings.frameRate ?? 0)} fps`,
        `zoom: ${settings.zoom ?? "no disponible"}${zoomRange ? ` (rango ${zoomRange.min}-${zoomRange.max})` : ""}`,
        `enfoque continuo: ${capabilities?.focusContinuous ? "sí" : "no"} · linterna: ${capabilities?.torch ? "sí" : "no"}`,
        `análisis: ${stats ? `${stats.pass} -> ${stats.analyzedWidth}x${stats.analyzedHeight}, ${stats.lastMs.toFixed(0)} ms` : "-"}`,
        `intentos: ${attempts} en ${elapsed} s`,
      ].join("\n");
    }

    async function start() {
      // El lector empieza a cargarse mientras el navegador pide el permiso.
      const readerPromise = createBarcodeReader(profile);
      readerPromise.catch(() => {});

      try {
        stream = await navigator.mediaDevices.getUserMedia(scannerVideoConstraints(profile));
      } catch (error) {
        if (!cancelled) onProblemRef.current(classifyCameraError(error));
        return;
      }
      if (cancelled) {
        release();
        return;
      }

      const track = stream.getVideoTracks()[0];
      trackRef.current = track ?? null;
      track?.addEventListener("ended", () => {
        if (!cancelled) onProblemRef.current("interrupted");
      });

      // Capacidades reales de ESTA cámara: solo se usa lo que existe.
      capabilities = track ? readCameraCapabilities(track) : null;
      if (track && profile === "estandar" && capabilities) {
        if (capabilities.focusContinuous) {
          track
            .applyConstraints({
              advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
            })
            .catch(() => {});
        }
        const startZoom = initialZoom(capabilities.zoom, readStoredZoom());
        if (startZoom !== null && (await applyZoom(track, startZoom)) && !cancelled) {
          setZoom({ presets: zoomPresets(capabilities.zoom), current: startZoom });
        }
      }

      video!.srcObject = stream;
      try {
        await video!.play();
      } catch {
        // Algunos navegadores rechazan play() si el usuario ya cerró la vista.
      }

      try {
        reader = await readerPromise;
      } catch {
        if (!cancelled) onProblemRef.current("reader_failed");
        release();
        return;
      }
      if (cancelled) {
        release();
        return;
      }

      loop = createScanLoop({
        detect: (attempt) => {
          attempts = attempt + 1;
          return reader!.detect(video!, attempt);
        },
        isAcceptable: (raw) => parseBarcode(raw).ok,
        onCode: (raw) => {
          const parsed = parseBarcode(raw);
          if (!parsed.ok || cancelled) return;
          navigator.vibrate?.(40);
          onCodeRef.current(parsed.code);
        },
      });
      loop.start();
      setReady(true);

      const startedAt = performance.now();
      const hasZoom = zoomPresets(capabilities?.zoom ?? null).length > 0;
      ticker = setInterval(() => {
        if (cancelled) return;
        setHint(scanHint(performance.now() - startedAt, hasZoom));
        if (diagnostics) setDiag(describe(startedAt));
      }, 700);
    }

    void start();

    return () => {
      cancelled = true;
      release();
    };
  }, []);

  async function chooseZoom(value: number) {
    const track = trackRef.current;
    if (!track || !(await applyZoom(track, value))) return;
    storeZoom(value);
    setZoom((current) => (current ? { ...current, current: value } : current));
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative w-full overflow-hidden rounded-card bg-black"
        style={{ aspectRatio: SCAN_VIEW_ASPECT_RATIO }}
      >
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          autoPlay
          muted
          playsInline
        />
        {/* Marco guía: la lectura analiza la franja central a todo lo ancho; el
            recuadro ayuda a centrar y a sostener el código en horizontal. */}
        <div
          className="pointer-events-none absolute rounded-lg border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
          style={{
            left: `${GUIDE_INSET_X * 100}%`,
            right: `${GUIDE_INSET_X * 100}%`,
            top: `${GUIDE_INSET_Y * 100}%`,
            bottom: `${GUIDE_INSET_Y * 100}%`,
          }}
        />
        <p
          aria-live="polite"
          className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs font-medium text-white"
        >
          {ready ? "Buscando código…" : "Iniciando cámara…"}
        </p>
      </div>

      {zoom && (
        <div className="flex items-center gap-2" role="group" aria-label="Zoom de la cámara">
          <span className="text-xs text-text-dim">Zoom</span>
          {zoom.presets.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={zoom.current === preset}
              onClick={() => void chooseZoom(preset)}
              className={`min-w-11 rounded-button px-3 py-1.5 text-sm font-semibold ${
                zoom.current === preset
                  ? "bg-primary text-white"
                  : "border border-border text-foreground"
              }`}
            >
              {preset}×
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-text-dim">
        {hint ?? "Coloca el código de barras dentro del recuadro, con buena luz y a unos 20 cm."}
      </p>

      {diag && (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-card border border-border bg-surface p-2 font-mono text-[11px] leading-snug text-text-dim">
          {diag}
        </pre>
      )}
    </div>
  );
}
