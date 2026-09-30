import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { todayIso } from "@/lib/date/dates";
import { KCAL_PER_G_PROTEIN, KCAL_PER_G_CARBS } from "@/lib/nutrition/constants";
import TargetEditForm from "./TargetEditForm";

export default async function TargetEditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: latestTarget } = await supabase
    .from("calorie_targets")
    .select("kcal_target, protein_g, carbs_g, fat_g")
    .eq("user_id", user.id)
    .lte("effective_date", todayIso())
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  // El objetivo guardado vive en gramos; el formulario trabaja en
  // porcentajes. Al precargar, proteína y carbohidratos se redondean de
  // forma independiente y la grasa se calcula como el resto hasta 100
  // (en vez de redondear los tres por separado) para que el formulario
  // siempre arranque con un 100% exacto, sin obligar al usuario a
  // corregir un desajuste de redondeo que no ha creado él.
  let defaults: {
    kcalTarget?: number;
    proteinPct?: number;
    carbsPct?: number;
    fatPct?: number;
  } = {};

  if (latestTarget && latestTarget.kcal_target > 0) {
    const proteinPct = Math.round(
      ((latestTarget.protein_g * KCAL_PER_G_PROTEIN) / latestTarget.kcal_target) * 100,
    );
    const carbsPct = Math.round(
      ((latestTarget.carbs_g * KCAL_PER_G_CARBS) / latestTarget.kcal_target) * 100,
    );
    defaults = {
      kcalTarget: latestTarget.kcal_target,
      proteinPct,
      carbsPct,
      fatPct: Math.max(0, 100 - proteinPct - carbsPct),
    };
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-md flex-col gap-5 md:max-w-2xl">
        <div>
          <Link href="/dashboard" className="text-xs font-medium text-primary">
            ‹ Volver
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">
            Editar objetivo
          </h1>
        </div>
        <Card>
          <TargetEditForm defaults={defaults} />
        </Card>
      </div>
    </main>
  );
}
