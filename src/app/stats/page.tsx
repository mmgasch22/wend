import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { WeightChart } from "@/components/ui/WeightChart";
import { AdherenceChart } from "@/components/ui/AdherenceChart";
import { sumKcalByDate, type DateFoodLogEntry } from "@/lib/food/dailyKcalSeries";
import { buildWeightChartData } from "@/lib/weight/chartPoints";
import { buildAdherenceSeries } from "@/lib/adherence/chartData";
import { addDays, todayIso } from "@/lib/date/dates";

const WEIGHT_CHART_DAYS = 30;
const ADHERENCE_CHART_DAYS = 30;

interface AdherenceFoodLogQueryRow {
  date: string;
  grams: number;
  foods: {
    kcal_100g: number;
    protein_100g: number | null;
    carbs_100g: number | null;
    fat_100g: number | null;
  };
}

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const today = todayIso();

  const [
    { data: weightHistoryRaw },
    { data: adherenceFoodLogsRaw },
    { data: targetHistoryRaw },
  ] = await Promise.all([
    // Igual que en el dashboard: independiente del día que se esté
    // viendo en él, siempre son los últimos 30 días contados desde hoy.
    supabase
      .from("weight_logs")
      .select("weight_kg, date, created_at")
      .eq("user_id", user.id)
      .gte("date", addDays(today, -(WEIGHT_CHART_DAYS - 1)))
      .order("date", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("food_logs")
      .select("date, grams, foods(kcal_100g, protein_100g, carbs_100g, fat_100g)")
      .eq("user_id", user.id)
      .gte("date", addDays(today, -(ADHERENCE_CHART_DAYS - 1))),
    // Historial completo de objetivos, no solo el vigente hoy — cada día
    // del rango necesita el objetivo que tocaba ese día concreto. Es una
    // app personal: pocas filas, no hace falta acotar por fecha.
    supabase
      .from("calorie_targets")
      .select("effective_date, kcal_target")
      .eq("user_id", user.id),
  ]);

  const weightChartData = buildWeightChartData(
    (weightHistoryRaw ?? []).map((w) => ({ date: w.date, weightKg: w.weight_kg })),
  );

  const adherenceFoodLogs = (adherenceFoodLogsRaw ?? []) as unknown as AdherenceFoodLogQueryRow[];
  const dailyKcal = sumKcalByDate(
    adherenceFoodLogs.map((log): DateFoodLogEntry => ({
      date: log.date,
      grams: log.grams,
      food: log.foods,
    })),
  );
  const targetHistory = (targetHistoryRaw ?? []).map((t) => ({
    effectiveDate: t.effective_date,
    kcalTarget: t.kcal_target,
  }));
  const adherenceDates = Array.from({ length: ADHERENCE_CHART_DAYS }, (_, i) =>
    addDays(today, -(ADHERENCE_CHART_DAYS - 1 - i)),
  );
  const adherenceSeries = buildAdherenceSeries(adherenceDates, dailyKcal, targetHistory);

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-md flex-col gap-5 md:max-w-2xl">
        <div>
          <Link href="/dashboard" className="text-xs font-medium text-primary">
            ‹ Volver
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">
            Estadísticas
          </h1>
        </div>

        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-text-dim">
            Peso — últimos {WEIGHT_CHART_DAYS} días
          </p>
          {weightChartData.points.length === 0 ? (
            <p className="mt-2 text-sm text-text-dim">
              Registra tu peso para ver su evolución.
            </p>
          ) : (
            <div className="mt-2">
              <WeightChart data={weightChartData} />
            </div>
          )}
        </Card>

        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-text-dim">
            Adherencia — últimos {ADHERENCE_CHART_DAYS} días
          </p>
          <div className="mt-2">
            <AdherenceChart days={adherenceSeries} />
          </div>
        </Card>
      </div>
    </main>
  );
}
