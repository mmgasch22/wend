"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseBarcode } from "@/lib/food/barcode";
import type { BarcodeLookupResult, FoodSearchResult } from "@/lib/food/types";
import {
  cameraProblemMessage,
  type CameraProblem,
} from "@/lib/food/scanner/camera";
import ScanCamera from "./ScanCamera";

// El servidor tarda como máximo ~16 s (dos intentos de 8 s); si pasa de aquí
// algo va mal y es mejor avisar que dejar el "Buscando…" indefinido.
const LOOKUP_TIMEOUT_MS = 20000;

const inputClass =
  "rounded-button border border-border bg-surface px-3 py-2 text-sm text-foreground";
const primaryButtonClass =
  "rounded-button bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover";
const secondaryButtonClass =
  "rounded-button border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-background";

type MessageResult = Extract<
  BarcodeLookupResult,
  { status: "not_found" | "insufficient_data" | "unavailable" | "invalid_code" }
>;

type Phase =
  | { kind: "camera"; session: number }
  | { kind: "lookup"; code: string }
  | { kind: "message"; result: MessageResult; code: string }
  | { kind: "camera_problem"; problem: CameraProblem };

export interface BarcodeScanPanelProps {
  // El producto encontrado: la pantalla lo muestra para que el usuario lo
  // compruebe y elija la cantidad. Aquí NO se registra nada.
  onFound: (food: FoodSearchResult) => void;
  // Crear a mano un alimento y asociarle este código para futuras lecturas.
  onCreateManual: (init: { name: string | null; barcode: string }) => void;
  // Cierra el escáner y vuelve a la búsqueda por nombre, sin perder la comida.
  onClose: () => void;
}

export default function BarcodeScanPanel({
  onFound,
  onCreateManual,
  onClose,
}: BarcodeScanPanelProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "camera", session: 0 });
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const lookupInFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const userCancelledRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  function restartCamera() {
    setManualError(null);
    setPhase((current) => ({
      kind: "camera",
      session: current.kind === "camera" ? current.session + 1 : Date.now(),
    }));
  }

  async function lookup(rawCode: string) {
    // Un solo intento a la vez: una lectura (o un doble toque) nunca puede
    // lanzar dos consultas.
    if (lookupInFlightRef.current) return;

    const parsed = parseBarcode(rawCode);
    if (!parsed.ok) {
      setManualError(
        parsed.reason === "format"
          ? "Un código de barras tiene 8 o 13 números. Revisa que no falte ninguno."
          : "Ese código no parece correcto: algún número está mal. Compruébalo.",
      );
      return;
    }

    setManualError(null);
    lookupInFlightRef.current = true;
    userCancelledRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
    setPhase({ kind: "lookup", code: parsed.code });

    let result: BarcodeLookupResult;
    try {
      const response = await fetch(
        `/api/food-barcode?code=${encodeURIComponent(parsed.code)}`,
        { signal: controller.signal },
      );
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      result = (await response.json()) as BarcodeLookupResult;
    } catch {
      result = { status: "unavailable" };
    } finally {
      clearTimeout(timeout);
      lookupInFlightRef.current = false;
    }

    if (!mountedRef.current) return;
    if (userCancelledRef.current) return;

    if (result.status === "found") {
      onFound(result.food);
      return;
    }
    setPhase({ kind: "message", result, code: parsed.code });
  }

  function cancelLookup() {
    userCancelledRef.current = true;
    abortRef.current?.abort();
    lookupInFlightRef.current = false;
    restartCamera();
  }

  const showManualEntry = phase.kind === "camera" || phase.kind === "camera_problem";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Escanear código de barras</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-primary"
        >
          Cancelar
        </button>
      </div>

      {phase.kind === "camera" && (
        <ScanCamera
          key={phase.session}
          onCode={(code) => void lookup(code)}
          onProblem={(problem) => setPhase({ kind: "camera_problem", problem })}
        />
      )}

      {phase.kind === "lookup" && (
        <div
          role="status"
          className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface px-3 py-4"
        >
          <p className="animate-pulse text-sm font-medium">Buscando producto…</p>
          <p className="font-mono text-xs text-text-dim">{phase.code}</p>
          <button
            type="button"
            onClick={cancelLookup}
            className="text-xs font-semibold text-primary"
          >
            Cancelar y volver a escanear
          </button>
        </div>
      )}

      {phase.kind === "camera_problem" && (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-card border border-border bg-surface px-3 py-3"
        >
          <p className="text-sm text-text-dim">{cameraProblemMessage(phase.problem)}</p>
          <div className="flex flex-wrap gap-2">
            {phase.problem !== "no_camera" &&
              phase.problem !== "unsupported" &&
              phase.problem !== "insecure" && (
                <button type="button" onClick={restartCamera} className={primaryButtonClass}>
                  Reintentar
                </button>
              )}
            <button type="button" onClick={onClose} className={secondaryButtonClass}>
              Buscar por nombre
            </button>
          </div>
        </div>
      )}

      {phase.kind === "message" && (
        <ResultMessage
          result={phase.result}
          code={phase.code}
          onRescan={restartCamera}
          onRetry={() => void lookup(phase.code)}
          onSearchByName={onClose}
          onCreateManual={(name) => onCreateManual({ name, barcode: phase.code })}
        />
      )}

      {showManualEntry && (
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <label htmlFor="barcode-manual" className="text-xs font-medium text-text-dim">
            ¿No lo lee? Escribe el código
          </label>
          <div className="flex gap-2">
            <input
              id="barcode-manual"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Los números bajo las barras"
              value={manualCode}
              onChange={(e) => {
                setManualCode(e.target.value);
                setManualError(null);
              }}
              onKeyDown={(e) => {
                // Dentro del formulario de alimentos: Enter no debe enviarlo.
                if (e.key === "Enter") {
                  e.preventDefault();
                  void lookup(manualCode);
                }
              }}
              className={`min-w-0 flex-1 ${inputClass}`}
            />
            <button
              type="button"
              onClick={() => void lookup(manualCode)}
              disabled={manualCode.trim() === ""}
              className={`${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Buscar
            </button>
          </div>
          {manualError && (
            <p role="alert" className="text-xs text-text-dim">
              {manualError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ResultMessage({
  result,
  code,
  onRescan,
  onRetry,
  onSearchByName,
  onCreateManual,
}: {
  result: MessageResult;
  code: string;
  onRescan: () => void;
  onRetry: () => void;
  onSearchByName: () => void;
  onCreateManual: (name: string | null) => void;
}) {
  let title: string;
  let body: string;
  let name: string | null = null;
  let canCreate = true;
  let canRetry = false;

  switch (result.status) {
    case "not_found":
      title = "Producto no encontrado";
      body = `El código ${code} no está en OpenFoodFacts. Puedes crearlo tú una vez y la próxima vez se reconocerá.`;
      break;
    case "insufficient_data":
      name = result.name;
      title = "Faltan datos del producto";
      body = result.name
        ? `Hemos encontrado «${result.name}», pero no tiene calorías registradas y no podemos calcular lo que aporta. Puedes crearlo con los valores de su etiqueta.`
        : "Hemos encontrado el código, pero el producto no tiene nombre ni calorías registradas. Puedes crearlo con los valores de su etiqueta.";
      break;
    case "unavailable":
      title = "No hemos podido consultar el producto";
      body =
        "OpenFoodFacts no responde ahora mismo, así que no sabemos si el producto existe. Inténtalo de nuevo en unos segundos.";
      // No se ofrece "crear": al no saber si el producto existe, crearlo a
      // ciegas podría duplicarlo. Se puede reintentar o buscar por nombre.
      canCreate = false;
      canRetry = true;
      break;
    case "invalid_code":
      title = "Código no válido";
      body = "Ese código no parece correcto. Vuelve a escanearlo o escríbelo de nuevo.";
      canCreate = false;
      break;
  }

  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-card border border-border bg-surface px-3 py-3"
    >
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm text-text-dim">{body}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {canRetry ? (
          <button type="button" onClick={onRetry} className={primaryButtonClass}>
            Reintentar
          </button>
        ) : (
          <button type="button" onClick={onRescan} className={primaryButtonClass}>
            Volver a escanear
          </button>
        )}
        {canCreate && (
          <button
            type="button"
            onClick={() => onCreateManual(name)}
            className={secondaryButtonClass}
          >
            Crear con este código
          </button>
        )}
        {canRetry && (
          <button type="button" onClick={onRescan} className={secondaryButtonClass}>
            Volver a escanear
          </button>
        )}
        <button type="button" onClick={onSearchByName} className={secondaryButtonClass}>
          Buscar por nombre
        </button>
      </div>
    </div>
  );
}
