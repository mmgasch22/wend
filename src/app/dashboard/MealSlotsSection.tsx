"use client";

import Link from "next/link";
import { useRef, useState, type PointerEvent } from "react";
import {
  createMealSlot,
  deleteMealSlot,
  reorderMealSlots,
  renameMealSlot,
} from "@/features/mealSlots/actions";
import {
  deleteFoodLog,
  moveFoodLog,
  updateFoodLogGrams,
} from "@/features/food/actions";

export interface FoodLogRow {
  id: string;
  grams: number;
  foods: { name: string; kcal_100g: number };
}

export interface MealSlotWithLogs {
  id: string;
  name: string;
  logs: FoodLogRow[];
}

interface MealSlotsSectionProps {
  mealSlots: MealSlotWithLogs[];
  unassignedLogs: FoodLogRow[];
  date: string;
}

const inputClass =
  "rounded-button border border-border bg-surface px-3 py-2 text-sm text-foreground";

// "Origen" especial para el arrastre: los alimentos sin comida asignada
// también se pueden arrastrar hacia una comida real. No es un id de
// meal_slots real, así que nunca puede coincidir con un `to` (siempre se
// considera un movimiento válido, nunca un no-op).
const UNASSIGNED = "unassigned";

export default function MealSlotsSection({
  mealSlots,
  unassignedLogs,
  date,
}: MealSlotsSectionProps) {
  const [items, setItems] = useState(mealSlots);
  // Detecta "llegaron datos nuevos del servidor" comparando la referencia
  // del array de props (patrón oficial de React para ajustar estado
  // derivado de props durante el render, sin useEffect): mealSlots solo
  // cambia de identidad cuando el Server Component padre se re-renderiza
  // (p.ej. tras un revalidatePath), nunca por los re-renders que provoca
  // el propio estado local de este componente.
  const [prevMealSlots, setPrevMealSlots] = useState(mealSlots);
  if (mealSlots !== prevMealSlots) {
    setPrevMealSlots(mealSlots);
    setItems(mealSlots);
  }
  const [unassigned, setUnassigned] = useState(unassignedLogs);
  const [prevUnassignedLogs, setPrevUnassignedLogs] = useState(unassignedLogs);
  if (unassignedLogs !== prevUnassignedLogs) {
    setPrevUnassignedLogs(unassignedLogs);
    setUnassigned(unassignedLogs);
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const draggingId = useRef<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());

  // Arrastre de alimentos entre comidas — sistema aparte del de reordenar
  // comidas de arriba: gestos, estado y algoritmo de destino distintos
  // (contención de rectángulo, no vecino más cercano), para que nunca se
  // interfieran entre sí. Reutiliza rowRefs (ya son los contenedores
  // completos de cada comida) para el test de contención.
  const draggingFoodId = useRef<string | null>(null);
  const sourceSlotId = useRef<string | null>(null);
  const [activeDragFoodId, setActiveDragFoodId] = useState<string | null>(null);
  const [hoverSlotId, setHoverSlotId] = useState<string | null>(null);

  function handleFoodPointerDown(
    e: PointerEvent<HTMLSpanElement>,
    logId: string,
    slotId: string,
  ) {
    draggingFoodId.current = logId;
    sourceSlotId.current = slotId;
    setActiveDragFoodId(logId);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleFoodPointerMove(e: PointerEvent<HTMLSpanElement>) {
    if (!draggingFoodId.current) return;

    const pointerY = e.clientY;
    let target: string | null = null;

    items.forEach((item) => {
      const el = rowRefs.current.get(item.id);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (pointerY >= rect.top && pointerY <= rect.bottom) {
        target = item.id;
      }
    });

    setHoverSlotId(target);
  }

  function handleFoodPointerUp() {
    const logId = draggingFoodId.current;
    const from = sourceSlotId.current;
    const to = hoverSlotId;

    if (logId && from && to && to !== from) {
      // Movimiento optimista local — se confirma solo al soltar, no en
      // cada pointermove, y revalidatePath lo terminará de sincronizar.
      // El origen puede ser una comida real o UNASSIGNED ("Sin comida
      // asignada"), el destino siempre es una comida real. `moved` se lee
      // del estado actual antes de tocar nada, para no depender de leer
      // una variable mutada dentro de un updater de setState.
      const moved =
        from === UNASSIGNED
          ? unassigned.find((log) => log.id === logId)
          : items
              .find((slot) => slot.id === from)
              ?.logs.find((log) => log.id === logId);

      if (moved) {
        if (from === UNASSIGNED) {
          setUnassigned((prev) => prev.filter((log) => log.id !== logId));
        } else {
          setItems((prev) =>
            prev.map((slot) =>
              slot.id === from
                ? { ...slot, logs: slot.logs.filter((log) => log.id !== logId) }
                : slot,
            ),
          );
        }

        setItems((prev) =>
          prev.map((slot) =>
            slot.id === to ? { ...slot, logs: [...slot.logs, moved] } : slot,
          ),
        );
        void moveFoodLog(logId, to);
      }
    }

    draggingFoodId.current = null;
    sourceSlotId.current = null;
    setActiveDragFoodId(null);
    setHoverSlotId(null);
  }

  function handlePointerDown(e: PointerEvent<HTMLSpanElement>, id: string) {
    draggingId.current = id;
    setActiveDragId(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent<HTMLSpanElement>) {
    const id = draggingId.current;
    if (!id) return;

    const pointerY = e.clientY;
    let closestIndex = 0;
    let closestDistance = Infinity;

    items.forEach((item, index) => {
      const el = rowRefs.current.get(item.id);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const distance = Math.abs(pointerY - centerY);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    const currentIndex = items.findIndex((item) => item.id === id);
    if (currentIndex !== -1 && currentIndex !== closestIndex) {
      setItems((prev) => {
        const next = [...prev];
        const [moved] = next.splice(currentIndex, 1);
        next.splice(closestIndex, 0, moved);
        return next;
      });
    }
  }

  function handlePointerUp() {
    if (draggingId.current) {
      void reorderMealSlots(items.map((item) => item.id));
    }
    draggingId.current = null;
    setActiveDragId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((slot) => (
        <div
          key={slot.id}
          ref={(el) => {
            if (el) rowRefs.current.set(slot.id, el);
            else rowRefs.current.delete(slot.id);
          }}
          className={`rounded-card border p-3 ${
            activeDragId === slot.id ? "opacity-60" : ""
          } ${
            activeDragFoodId && hoverSlotId === slot.id
              ? "border-primary bg-background"
              : "border-border bg-surface"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              onPointerDown={(e) => handlePointerDown(e, slot.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="cursor-grab select-none px-1 text-text-dim"
              style={{ touchAction: "none" }}
              aria-label="Arrastrar para reordenar"
            >
              ⠿
            </span>

            {editingId === slot.id ? (
              <form
                action={renameMealSlot}
                className="flex flex-1 items-center gap-2"
                onSubmit={() => setEditingId(null)}
              >
                <input type="hidden" name="id" value={slot.id} />
                <input type="hidden" name="date" value={date} />
                <input
                  name="name"
                  defaultValue={slot.name}
                  autoFocus
                  className={`flex-1 ${inputClass}`}
                />
                <button type="submit" className="text-xs font-semibold text-primary">
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="text-xs text-text-dim"
                >
                  Cancelar
                </button>
              </form>
            ) : (
              <>
                <p className="flex-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
                  {slot.name}
                </p>
                <button
                  type="button"
                  onClick={() => setEditingId(slot.id)}
                  className="text-xs text-text-dim"
                  aria-label={`Editar ${slot.name}`}
                >
                  ✎
                </button>
                <form
                  action={deleteMealSlot}
                  onSubmit={(e) => {
                    if (!window.confirm(`¿Eliminar "${slot.name}"?`)) {
                      e.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="id" value={slot.id} />
                  <input type="hidden" name="date" value={date} />
                  <button type="submit" className="text-xs text-text-dim">
                    Eliminar
                  </button>
                </form>
              </>
            )}
          </div>

          {slot.logs.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {slot.logs.map((log) => (
                <FoodLogItem
                  key={log.id}
                  log={log}
                  date={date}
                  isDragging={activeDragFoodId === log.id}
                  onDragStart={(e) => handleFoodPointerDown(e, log.id, slot.id)}
                  onDragMove={handleFoodPointerMove}
                  onDragEnd={handleFoodPointerUp}
                />
              ))}
            </ul>
          )}

          <Link
            href={`/food/new?meal=${slot.id}&date=${date}`}
            className="mt-2 inline-block text-xs font-semibold text-primary"
          >
            + Añadir alimento
          </Link>
        </div>
      ))}

      {unassigned.length > 0 && (
        <div className="rounded-card border border-dashed border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-dim">
            Sin comida asignada
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {unassigned.map((log) => (
              <FoodLogItem
                key={log.id}
                log={log}
                date={date}
                isDragging={activeDragFoodId === log.id}
                onDragStart={(e) => handleFoodPointerDown(e, log.id, UNASSIGNED)}
                onDragMove={handleFoodPointerMove}
                onDragEnd={handleFoodPointerUp}
              />
            ))}
          </ul>
        </div>
      )}

      <form action={createMealSlot} className="flex items-center gap-2">
        <input type="hidden" name="date" value={date} />
        <input
          name="name"
          placeholder="Nueva comida..."
          required
          className={`flex-1 ${inputClass}`}
        />
        <button type="submit" className="text-sm font-semibold text-primary">
          + Añadir comida
        </button>
      </form>
    </div>
  );
}

interface FoodLogItemProps {
  log: FoodLogRow;
  date: string;
  isDragging?: boolean;
  onDragStart?: (e: PointerEvent<HTMLSpanElement>) => void;
  onDragMove?: (e: PointerEvent<HTMLSpanElement>) => void;
  onDragEnd?: () => void;
}

function FoodLogItem({
  log,
  date,
  isDragging,
  onDragStart,
  onDragMove,
  onDragEnd,
}: FoodLogItemProps) {
  const draggable = Boolean(onDragStart);

  return (
    <li
      className={`flex items-center justify-between gap-2 rounded-button border border-border bg-background px-3 py-2 ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      {draggable && (
        <span
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          className="cursor-grab select-none px-1 text-xs text-text-dim"
          style={{ touchAction: "none" }}
          aria-label={`Arrastrar ${log.foods.name} a otra comida`}
        >
          ⠿
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{log.foods.name}</p>
        <p className="font-mono text-xs text-text-dim">
          {Math.round((log.foods.kcal_100g * log.grams) / 100)} kcal
        </p>
      </div>
      <UpdateGramsForm id={log.id} grams={log.grams} date={date} />
      <DeleteLogForm id={log.id} date={date} />
    </li>
  );
}

function UpdateGramsForm({
  id,
  grams,
  date,
}: {
  id: string;
  grams: number;
  date: string;
}) {
  return (
    <form action={updateFoodLogGrams} className="flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="date" value={date} />
      <input
        type="number"
        name="grams"
        step="0.1"
        min="0.1"
        defaultValue={grams}
        className="w-16 rounded-button border border-border bg-surface px-2 py-1 text-right font-mono text-xs"
      />
      <span className="text-xs text-text-dim">g</span>
      <button type="submit" className="text-xs font-semibold text-primary">
        Guardar
      </button>
    </form>
  );
}

function DeleteLogForm({ id, date }: { id: string; date: string }) {
  return (
    <form action={deleteFoodLog}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="date" value={date} />
      <button type="submit" className="text-xs font-semibold text-text-dim">
        Borrar
      </button>
    </form>
  );
}
