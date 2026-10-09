"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { logFood } from "@/features/food/actions";
import {
  formatMacroGrams,
  joinLabels,
  missingMacroLabels,
  scaleNutrients,
} from "@/lib/food/portion";
import type { FoodSearchResponse, FoodSearchResult } from "@/lib/food/types";
import BarcodeScanPanel from "./BarcodeScanPanel";

type Tab = "search" | "manual";

interface ActiveFood {
  name: string;
  kcal100g: number;
  protein100g: number | null;
  carbs100g: number | null;
  fat100g: number | null;
  incomplete: boolean;
}

const inputClass =
  "rounded-button border border-border bg-surface px-3 py-2 text-sm text-foreground";

// Por 100 g con un decimal como máximo; "sin dato" si no está registrado.
function per100g(value: number | null): string {
  return value === null ? "sin dato" : `${Math.round(value * 10) / 10} g`;
}

export default function FoodSearchForm({
  mealSlotId,
  date,
}: {
  mealSlotId: string;
  date: string;
}) {
  const [state, action, pending] = useActionState(logFood, undefined);

  const [tab, setTab] = useState<Tab>("search");

  // Búsqueda
  const [query, setQuery] = useState("");
  const [yourFoods, setYourFoods] = useState<FoodSearchResult[]>([]);
  const [openFoodFacts, setOpenFoodFacts] = useState<FoodSearchResult[]>([]);
  const [offUnavailable, setOffUnavailable] = useState(false);
  const [searching, setSearching] = useState(false);
  const [lastSearchedQuery, setLastSearchedQuery] = useState<string | null>(null);
  const [selected, setSelected] = useState<FoodSearchResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Escáner de códigos de barras
  const [scanOpen, setScanOpen] = useState(false);
  const [selectedFromScan, setSelectedFromScan] = useState(false);

  // Alimento manual
  const [manualName, setManualName] = useState("");
  const [manualKcal, setManualKcal] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [manualFat, setManualFat] = useState("");
  // Código de barras que se asociará al alimento manual (si viene del escáner).
  const [manualBarcode, setManualBarcode] = useState("");

  const [grams, setGrams] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        setYourFoods([]);
        setOpenFoodFacts([]);
        setOffUnavailable(false);
        setLastSearchedQuery(null);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);

      fetch(`/api/food-search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data: Partial<FoodSearchResponse>) => {
          setYourFoods(data.yourFoods ?? []);
          setOpenFoodFacts(data.openFoodFacts ?? []);
          setOffUnavailable(data.openFoodFactsUnavailable ?? false);
          setLastSearchedQuery(trimmed);
        })
        .catch(() => {
          // Búsqueda cancelada por una nueva pulsación, o fallo de red: se
          // ignora, el usuario ya está viendo una búsqueda más reciente.
        })
        .finally(() => setSearching(false));
    }, 400);

    return () => clearTimeout(timeout);
  }, [query]);

  const trimmedQuery = query.trim();
  const searchSettled =
    !searching && lastSearchedQuery === trimmedQuery && trimmedQuery.length >= 2;
  const noResults =
    searchSettled &&
    !offUnavailable &&
    yourFoods.length === 0 &&
    openFoodFacts.length === 0;
  const offUnavailableNotice =
    searchSettled && offUnavailable && openFoodFacts.length === 0;

  const manualKcalNum = parseFloat(manualKcal);
  const manualProteinNum = parseFloat(manualProtein);
  const manualCarbsNum = parseFloat(manualCarbs);
  const manualFatNum = parseFloat(manualFat);
  const manualValid =
    manualName.trim() !== "" &&
    Number.isFinite(manualKcalNum) &&
    Number.isFinite(manualProteinNum) &&
    Number.isFinite(manualCarbsNum) &&
    Number.isFinite(manualFatNum);

  const activeFood: ActiveFood | null =
    tab === "search"
      ? selected
        ? {
            name: selected.name,
            kcal100g: selected.kcal100g,
            protein100g: selected.protein100g,
            carbs100g: selected.carbs100g,
            fat100g: selected.fat100g,
            incomplete: selected.incomplete,
          }
        : null
      : manualValid
        ? {
            name: manualName,
            kcal100g: manualKcalNum,
            protein100g: manualProteinNum,
            carbs100g: manualCarbsNum,
            fat100g: manualFatNum,
            incomplete: false,
          }
        : null;

  const readyToLog = tab === "manual" || selected !== null;
  const gramsNum = parseFloat(grams);
  const portion = activeFood ? scaleNutrients(activeFood, gramsNum) : null;

  function chooseTab(next: Tab) {
    setScanOpen(false);
    if (next === "manual" && tab !== "manual") setManualBarcode("");
    setTab(next);
  }

  function selectFromSearch(result: FoodSearchResult) {
    setSelected(result);
    setSelectedFromScan(false);
  }

  function clearSelection() {
    setSelected(null);
    setSelectedFromScan(false);
  }

  function startManualFromQuery() {
    setManualName(trimmedQuery);
    setManualBarcode("");
    setTab("manual");
  }

  // El escáner encontró un producto: se muestra para confirmarlo. No se
  // registra nada hasta que el usuario elige la cantidad y pulsa "Registrar".
  function handleScanFound(food: FoodSearchResult) {
    setSelected(food);
    setSelectedFromScan(true);
    setGrams("");
    setScanOpen(false);
  }

  function handleScanCreateManual(init: { name: string | null; barcode: string }) {
    setManualName(init.name ?? "");
    setManualBarcode(init.barcode);
    setScanOpen(false);
    setTab("manual");
  }

  const missingMacros = selected ? missingMacroLabels(selected) : [];

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => chooseTab("search")}
          className={`rounded-button px-4 py-2 text-sm font-semibold ${
            tab === "search"
              ? "bg-primary text-white"
              : "border border-border text-foreground"
          }`}
        >
          Buscar
        </button>
        <button
          type="button"
          onClick={() => chooseTab("manual")}
          className={`rounded-button px-4 py-2 text-sm font-semibold ${
            tab === "manual"
              ? "bg-primary text-white"
              : "border border-border text-foreground"
          }`}
        >
          Crear manual
        </button>
      </div>

      <input type="hidden" name="source" value={tab} />
      <input type="hidden" name="meal_slot_id" value={mealSlotId} />
      <input type="hidden" name="date" value={date} />

      {tab === "search" && !selected && scanOpen && (
        <BarcodeScanPanel
          onFound={handleScanFound}
          onCreateManual={handleScanCreateManual}
          onClose={() => setScanOpen(false)}
        />
      )}

      {tab === "search" && !selected && !scanOpen && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="query" className="text-sm font-medium">
              Buscar alimento
            </label>
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-button border border-border px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-background"
            >
              <BarcodeIcon />
              Escanear código
            </button>
          </div>
          <input
            id="query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ej. yogur natural"
            className={inputClass}
            autoFocus
          />
          {searching && <p className="text-xs text-text-dim">Buscando...</p>}

          {!searching && yourFoods.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-dim">
                Tus alimentos
              </p>
              <ul className="flex flex-col gap-1">
                {yourFoods.map((result) => (
                  <FoodResultRow
                    key={`local-${result.id}`}
                    result={result}
                    onSelect={() => selectFromSearch(result)}
                  />
                ))}
              </ul>
            </div>
          )}

          {!searching && openFoodFacts.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-dim">
                OpenFoodFacts
              </p>
              <ul className="flex flex-col gap-1">
                {openFoodFacts.map((result) => (
                  <FoodResultRow
                    key={`off-${result.barcode}-${result.name}`}
                    result={result}
                    onSelect={() => selectFromSearch(result)}
                  />
                ))}
              </ul>
            </div>
          )}

          {offUnavailableNotice && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface px-3 py-3">
              <p className="text-sm text-text-dim">
                No se ha podido consultar OpenFoodFacts ahora mismo. Inténtalo de
                nuevo en unos segundos o crea el alimento a mano.
              </p>
              <button
                type="button"
                onClick={startManualFromQuery}
                className="text-sm font-semibold text-primary"
              >
                + Crear &quot;{trimmedQuery}&quot; manualmente
              </button>
            </div>
          )}

          {noResults && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface px-3 py-3">
              <p className="text-sm text-text-dim">
                No hemos encontrado este alimento.
              </p>
              <button
                type="button"
                onClick={startManualFromQuery}
                className="text-sm font-semibold text-primary"
              >
                + Crear &quot;{trimmedQuery}&quot; manualmente
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "search" && selected && (
        <div className="flex items-start justify-between gap-3 rounded-card border border-border bg-surface px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">{selected.name}</p>
            <p className="mt-0.5 font-mono text-xs text-text-dim">
              {Math.round(selected.kcal100g)} kcal · prot. {per100g(selected.protein100g)} ·
              carb. {per100g(selected.carbs100g)} · grasa {per100g(selected.fat100g)}
              <span className="font-sans"> por 100 g</span>
            </p>
            {missingMacros.length > 0 && (
              <p className="mt-1 text-xs text-text-dim">
                Faltan datos de {joinLabels(missingMacros)}: no se sumarán a tus macros.
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs font-semibold text-primary"
            >
              Cambiar
            </button>
            {selectedFromScan && (
              <button
                type="button"
                onClick={() => {
                  clearSelection();
                  setScanOpen(true);
                }}
                className="text-xs font-semibold text-primary"
              >
                Escanear otro
              </button>
            )}
          </div>
        </div>
      )}

      {tab === "search" && selected && (
        <>
          <input type="hidden" name="food_id" value={selected.id ?? ""} />
          <input type="hidden" name="barcode" value={selected.barcode ?? ""} />
          <input type="hidden" name="name" value={selected.name} />
          <input type="hidden" name="kcal_100g" value={selected.kcal100g} />
          <input
            type="hidden"
            name="protein_100g"
            value={selected.protein100g ?? ""}
          />
          <input type="hidden" name="carbs_100g" value={selected.carbs100g ?? ""} />
          <input type="hidden" name="fat_100g" value={selected.fat100g ?? ""} />
          <input type="hidden" name="fiber_100g" value={selected.fiber100g ?? ""} />
          <input type="hidden" name="sugar_100g" value={selected.sugar100g ?? ""} />
          <input type="hidden" name="salt_100g" value={selected.salt100g ?? ""} />
        </>
      )}

      {tab === "manual" && (
        <div className="flex flex-col gap-3">
          {manualBarcode && (
            <div className="flex items-start justify-between gap-3 rounded-card border border-border bg-surface px-3 py-2">
              <p className="text-xs text-text-dim">
                Código de barras <span className="font-mono">{manualBarcode}</span>: se
                asociará a este alimento para reconocerlo la próxima vez que lo escanees.
              </p>
              <button
                type="button"
                onClick={() => setManualBarcode("")}
                className="shrink-0 text-xs font-semibold text-primary"
              >
                Quitar
              </button>
            </div>
          )}
          <input type="hidden" name="barcode" value={manualBarcode} />
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-sm font-medium">
              Nombre
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="kcal_100g" className="text-sm font-medium">
                kcal/100g
              </label>
              <input
                id="kcal_100g"
                name="kcal_100g"
                type="number"
                step="0.1"
                min="0"
                required
                value={manualKcal}
                onChange={(e) => setManualKcal(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="protein_100g" className="text-sm font-medium">
                Proteína/100g
              </label>
              <input
                id="protein_100g"
                name="protein_100g"
                type="number"
                step="0.1"
                min="0"
                required
                value={manualProtein}
                onChange={(e) => setManualProtein(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="carbs_100g" className="text-sm font-medium">
                Carbs/100g
              </label>
              <input
                id="carbs_100g"
                name="carbs_100g"
                type="number"
                step="0.1"
                min="0"
                required
                value={manualCarbs}
                onChange={(e) => setManualCarbs(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="fat_100g" className="text-sm font-medium">
                Grasa/100g
              </label>
              <input
                id="fat_100g"
                name="fat_100g"
                type="number"
                step="0.1"
                min="0"
                required
                value={manualFat}
                onChange={(e) => setManualFat(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      )}

      {readyToLog && (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="grams" className="text-sm font-medium">
              Cantidad (g)
            </label>
            <input
              id="grams"
              name="grams"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0.1"
              required
              // Tras escanear, lo siguiente que hace falta es la cantidad:
              // el cursor ya está en ella.
              autoFocus={selectedFromScan}
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              className={inputClass}
            />
          </div>

          {portion && activeFood && (
            <div className="rounded-card border border-border bg-surface px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-text-dim">
                Para {grams} g
              </p>
              <p
                className="mt-1 font-mono text-2xl font-semibold tabular-nums"
                style={{ color: "var(--primary)" }}
              >
                {portion.kcal}
                <span className="ml-1 text-sm font-medium opacity-70">kcal</span>
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="font-mono">{formatMacroGrams(portion.protein)}</p>
                  <p className="text-xs text-text-dim">Proteína</p>
                </div>
                <div>
                  <p className="font-mono">{formatMacroGrams(portion.carbs)}</p>
                  <p className="text-xs text-text-dim">Carbohidratos</p>
                </div>
                <div>
                  <p className="font-mono">{formatMacroGrams(portion.fat)}</p>
                  <p className="text-xs text-text-dim">Grasa</p>
                </div>
              </div>
              {activeFood.incomplete && (
                <p className="mt-2 text-xs italic text-text-dim">
                  * Este alimento no tiene todos los macros registrados — se
                  guardará igual, pero no sumará en los que falten.
                </p>
              )}
            </div>
          )}

          {state?.error && (
            <p className="rounded-card border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="rounded-button bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Registrando..." : "Registrar"}
          </button>
        </div>
      )}
    </form>
  );
}

function BarcodeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
      <path d="M8 8v8M11 8v8M14 8v8M17 8v8" />
    </svg>
  );
}

function FoodResultRow({
  result,
  onSelect,
}: {
  result: FoodSearchResult;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="w-full rounded-button border border-border bg-surface px-3 py-2 text-left text-sm hover:bg-background"
      >
        <span className="font-medium">{result.name}</span>
        <span className="ml-2 font-mono text-xs text-text-dim">
          {Math.round(result.kcal100g)} kcal/100g
        </span>
        {result.incomplete && (
          <span className="ml-2 text-xs text-text-dim">· datos incompletos</span>
        )}
      </button>
    </li>
  );
}
