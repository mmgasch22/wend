import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/features/auth/actions";
import { logWeight } from "@/features/weight/actions";
import { logSteps } from "@/features/steps/actions";
import { addWater } from "@/features/water/actions";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { macroColors } from "@/components/ui/tokens";
import { calculateDailyTotals } from "@/lib/food/dailyTotals";
import { addDays, resolveRequestedDate, todayIso } from "@/lib/date/dates";
import MealSlotsSection, {
  type FoodLogRow,
  type MealSlotWithLogs,
} from "./MealSlotsSection";

function progressPct(consumed: number, target: number): number {
  return target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
}

interface FoodLogQueryRow {
  id: string;
  grams: number;
  meal_slot_id: string | null;
  foods: FoodLogRow["foods"] & {
    protein_100g: number | null;
    carbs_100g: number | null;
    fat_100g: number | null;
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, daily_steps_goal, daily_water_goal_ml")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/onboarding");
  }

  const today = todayIso();
  // Nunca se confía en la fecha de la URL tal cual: resolveRequestedDate
  // cae a hoy si falta, tiene formato inválido, o pide un día futuro (no
  // hay navegación a futuro en V1).
  const { date: requestedDate, error: errorMessage } = await searchParams;
  const date = resolveRequestedDate(requestedDate);
  const isToday = date === today;
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const [
    { data: latestTarget },
    { data: weightOnDate },
    { data: stepsOnDate },
    { data: waterOnDate },
    { data: mealSlots },
    { data: dayLogsRaw },
  ] = await Promise.all([
    supabase
      .from("calorie_targets")
      .select("kcal_target, protein_g, carbs_g, fat_g, effective_date")
      .eq("user_id", user.id)
      .lte("effective_date", date)
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("weight_logs")
      .select("weight_kg, date")
      .eq("user_id", user.id)
      .lte("date", date)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // A diferencia de weight_logs (histórico, "vigente en la fecha"),
    // steps_logs es una fila por fecha exacta — sin arrastrar el valor de
    // un día anterior si no hay registro ese día concreto.
    supabase
      .from("steps_logs")
      .select("value")
      .eq("user_id", user.id)
      .eq("date", date)
      .maybeSingle(),
    // Igual que steps_logs: una fila por fecha exacta, sin arrastrar el
    // valor de un día anterior.
    supabase
      .from("water_logs")
      .select("value_ml")
      .eq("user_id", user.id)
      .eq("date", date)
      .maybeSingle(),
    supabase
      .from("meal_slots")
      .select("id, name")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("food_logs")
      .select(
        "id, grams, meal_slot_id, foods(name, kcal_100g, protein_100g, carbs_100g, fat_100g)",
      )
      .eq("user_id", user.id)
      .eq("date", date),
  ]);

  const dayLogs = (dayLogsRaw ?? []) as unknown as FoodLogQueryRow[];

  const totals = calculateDailyTotals(
    dayLogs.map((log) => ({ grams: log.grams, food: log.foods })),
  );

  const incompleteMacroNames = [
    totals.proteinIncomplete && "proteína",
    totals.carbsIncomplete && "carbohidratos",
    totals.fatIncomplete && "grasa",
  ].filter((name): name is string => Boolean(name));

  const mealSlotsWithLogs: MealSlotWithLogs[] = (mealSlots ?? []).map((slot) => ({
    id: slot.id,
    name: slot.name,
    logs: dayLogs
      .filter((log) => log.meal_slot_id === slot.id)
      .map((log) => ({ id: log.id, grams: log.grams, foods: log.foods })),
  }));

  const unassignedLogs: FoodLogRow[] = dayLogs
    .filter((log) => log.meal_slot_id === null)
    .map((log) => ({ id: log.id, grams: log.grams, foods: log.foods }));

  // Solo precarga el campo si el peso mostrado es literalmente el de este
  // día (no uno heredado de una fecha anterior) — si no, el formulario
  // debe verse como "registrar", no como "editar" un valor de otro día.
  const weightForSelectedDate =
    weightOnDate?.date === date ? weightOnDate.weight_kg : undefined;

  // steps_logs ya se consultó por fecha exacta — a diferencia del peso, si
  // no hay fila ese día no hay nada que "precargar" de un día anterior.
  const stepsForSelectedDate = stepsOnDate ? stepsOnDate.value : undefined;

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-md flex-col gap-5 md:max-w-2xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-text-dim">Hola,</p>
            <h1 className="text-2xl font-semibold text-foreground">
              {profile.name ?? user.email}
            </h1>
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
              <Link
                href="/profile/edit"
                className="text-xs font-medium text-primary"
              >
                Editar perfil
              </Link>
              <Link
                href="/target/edit"
                className="text-xs font-medium text-primary"
              >
                Editar objetivo
              </Link>
              <Link
                href="/stats"
                className="text-xs font-medium text-primary"
              >
                Ver estadísticas
              </Link>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <ThemeToggle />
            <form action={signOut}>
              <Button variant="secondary" className="text-sm">
                Cerrar sesión
              </Button>
            </form>
          </div>
        </header>

        {errorMessage && (
          <div className="rounded-card border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 rounded-card border border-border bg-surface px-2 py-2">
          <Link
            href={`/dashboard?date=${addDays(date, -1)}`}
            aria-label="Día anterior"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-button text-xl font-semibold text-foreground active:bg-background"
          >
            ‹
          </Link>
          <p className="flex-1 truncate text-center text-sm font-semibold capitalize text-foreground">
            {dateLabel}
          </p>
          {isToday ? (
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-button text-xl text-border"
            >
              ›
            </span>
          ) : (
            <Link
              href={`/dashboard?date=${addDays(date, 1)}`}
              aria-label="Día siguiente"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-button text-xl font-semibold text-foreground active:bg-background"
            >
              ›
            </Link>
          )}
        </div>

        {/* Saltar directamente a una fecha, sin tener que ir día a día con
            ‹ › — formulario GET normal, sin JavaScript de cliente. */}
        <form
          action="/dashboard"
          method="get"
          className="flex items-center justify-center gap-2"
        >
          <input
            type="date"
            name="date"
            defaultValue={date}
            max={today}
            aria-label="Ir a una fecha concreta"
            className="rounded-button border border-border bg-surface px-2 py-1.5 text-xs text-foreground"
          />
          <button
            type="submit"
            className="text-xs font-semibold text-primary"
          >
            Ir a esa fecha
          </button>
        </form>

        {latestTarget ? (
          <>
            <Card>
              <p className="text-xs font-medium uppercase tracking-wide text-text-dim">
                Objetivo calórico
              </p>
              <p
                className="mt-2 font-mono text-4xl font-semibold tabular-nums"
                style={{ color: macroColors.kcal }}
              >
                {totals.kcal}
                <span className="ml-1 text-base font-medium opacity-70">
                  / {latestTarget.kcal_target} kcal
                </span>
              </p>
              <div className="mt-2">
                <ProgressBar
                  value={progressPct(totals.kcal, latestTarget.kcal_target)}
                  color={macroColors.kcal}
                />
              </div>
              <p className="mt-2 text-xs text-text-dim">
                Objetivo vigente desde el{" "}
                {new Date(`${latestTarget.effective_date}T00:00:00`).toLocaleDateString(
                  "es-ES",
                )}
              </p>
            </Card>

            <div className="grid grid-cols-3 gap-3">
              <StatTile
                label={totals.proteinIncomplete ? "Proteína*" : "Proteína"}
                value={totals.proteinG}
                unit={`/${latestTarget.protein_g}g`}
                color={macroColors.protein}
                progress={progressPct(totals.proteinG, latestTarget.protein_g)}
              />
              <StatTile
                label={totals.carbsIncomplete ? "Carbohidratos*" : "Carbohidratos"}
                value={totals.carbsG}
                unit={`/${latestTarget.carbs_g}g`}
                color={macroColors.carbs}
                progress={progressPct(totals.carbsG, latestTarget.carbs_g)}
              />
              <StatTile
                label={totals.fatIncomplete ? "Grasa*" : "Grasa"}
                value={totals.fatG}
                unit={`/${latestTarget.fat_g}g`}
                color={macroColors.fat}
                progress={progressPct(totals.fatG, latestTarget.fat_g)}
              />
            </div>
            {incompleteMacroNames.length > 0 && (
              <p className="text-xs text-text-dim">
                * Macros incompletos: {incompleteMacroNames.join(", ")} — falta
                información nutricional en algún alimento registrado.
              </p>
            )}
          </>
        ) : (
          <Card>
            <p className="text-sm text-text-dim">
              Todavía no había un objetivo calórico calculado en esta fecha.
            </p>
          </Card>
        )}

        <MealSlotsSection
          mealSlots={mealSlotsWithLogs}
          unassignedLogs={unassignedLogs}
          date={date}
        />

        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-text-dim">
            {isToday ? "Peso actual" : "Peso"}
          </p>
          {weightOnDate ? (
            <>
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-foreground">
                {weightOnDate.weight_kg}
                <span className="ml-1 text-base font-medium opacity-70">
                  kg
                </span>
              </p>
              <p className="mt-1 text-xs text-text-dim">
                Registrado el{" "}
                {new Date(`${weightOnDate.date}T00:00:00`).toLocaleDateString(
                  "es-ES",
                )}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-text-dim">
              Todavía no hay ningún peso registrado.
            </p>
          )}

          <form action={logWeight} className="mt-3 flex items-center gap-2">
            <input type="hidden" name="date" value={date} />
            <input
              type="number"
              name="weight_kg"
              step="0.01"
              min="0.1"
              required
              defaultValue={weightForSelectedDate}
              placeholder={weightForSelectedDate === undefined ? "Nuevo peso (kg)" : undefined}
              className="w-full rounded-button border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
            <Button type="submit" variant="secondary" className="shrink-0 text-sm">
              {weightForSelectedDate === undefined ? "Registrar" : "Actualizar"}
            </Button>
          </form>
        </Card>

        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-text-dim">
            Pasos
          </p>
          {profile.daily_steps_goal ? (
            <>
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-foreground">
                {stepsOnDate?.value ?? 0}
                <span className="ml-1 text-base font-medium opacity-70">
                  / {profile.daily_steps_goal}
                </span>
              </p>
              <div className="mt-2">
                <ProgressBar
                  value={progressPct(stepsOnDate?.value ?? 0, profile.daily_steps_goal)}
                  color={macroColors.kcal}
                />
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-text-dim">
              Todavía no hay un objetivo de pasos definido.
            </p>
          )}

          <form action={logSteps} className="mt-3 flex items-center gap-2">
            <input type="hidden" name="date" value={date} />
            <input
              type="number"
              name="value"
              step="1"
              min="0"
              required
              defaultValue={stepsForSelectedDate}
              placeholder={stepsForSelectedDate === undefined ? "Pasos del día" : undefined}
              className="w-full rounded-button border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
            <Button type="submit" variant="secondary" className="shrink-0 text-sm">
              {stepsForSelectedDate === undefined ? "Registrar" : "Actualizar"}
            </Button>
          </form>
        </Card>

        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-text-dim">
            Agua
          </p>
          {profile.daily_water_goal_ml ? (
            <>
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-foreground">
                {waterOnDate?.value_ml ?? 0}
                <span className="ml-1 text-base font-medium opacity-70">
                  / {profile.daily_water_goal_ml} ml
                </span>
              </p>
              <div className="mt-2">
                <ProgressBar
                  value={progressPct(waterOnDate?.value_ml ?? 0, profile.daily_water_goal_ml)}
                  color={macroColors.kcal}
                />
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-text-dim">
              Todavía no hay un objetivo de agua definido.
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {[250, 500].map((amount) => (
              <form key={amount} action={addWater}>
                <input type="hidden" name="date" value={date} />
                <input type="hidden" name="amount_ml" value={amount} />
                <Button type="submit" variant="secondary" className="text-sm">
                  +{amount} ml
                </Button>
              </form>
            ))}
            <form action={addWater} className="flex flex-1 min-w-[9rem] items-center gap-2">
              <input type="hidden" name="date" value={date} />
              <input
                type="number"
                name="amount_ml"
                step="1"
                min="1"
                placeholder="Otra cantidad"
                aria-label="Otra cantidad de agua en ml"
                className="w-full min-w-0 rounded-button border border-border bg-surface px-3 py-2 text-sm text-foreground"
              />
              <Button type="submit" variant="secondary" className="shrink-0 text-sm">
                Añadir
              </Button>
            </form>
          </div>
          <p className="mt-2 text-[11px] text-text-dim">1 vaso ≈ 200–250 ml</p>
        </Card>
      </div>
    </main>
  );
}
