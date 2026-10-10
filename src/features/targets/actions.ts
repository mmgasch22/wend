"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SAVE_ERROR } from "@/lib/errors/userMessage";
import { todayIso } from "@/lib/date/dates";
import { macroGramsFromPercentages } from "@/lib/nutrition/macroGrams";

export type TargetActionState = { error: string } | undefined;

// Fija manualmente el objetivo de kcal y macros del usuario, sin pasar
// por el recálculo automático de updateProfile — incluso si el mismo
// día se recalcula desde /profile/edit después, esa es la fila que
// queda vigente: ambos escriben sobre effective_date = hoy, mismo
// modelo histórico que ya usa calorie_targets, sin lógica de prioridad
// nueva.
//
// Los macros se introducen como % de las kcal (deben sumar 100 entre
// los tres) en vez de gramos libres — así no puede haber un objetivo
// donde los macros no cuadren con las kcal, por construcción. Se
// validan aquí también (no solo en el cliente) porque un Server Action
// se puede invocar sin pasar por el formulario.
export async function updateTargetManually(
  _prevState: TargetActionState,
  formData: FormData,
): Promise<TargetActionState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const kcalTarget = Number(formData.get("kcal_target"));
  const proteinPct = Number(formData.get("protein_pct"));
  const carbsPct = Number(formData.get("carbs_pct"));
  const fatPct = Number(formData.get("fat_pct"));

  if (!Number.isFinite(kcalTarget) || kcalTarget < 0) {
    return { error: "Introduce un número válido (0 o más) de kcal." };
  }

  const percentages = [proteinPct, carbsPct, fatPct];
  if (percentages.some((pct) => !Number.isFinite(pct) || pct < 0 || pct > 100)) {
    return { error: "Cada macro debe ser un porcentaje entre 0 y 100." };
  }

  if (proteinPct + carbsPct + fatPct !== 100) {
    return { error: "Los porcentajes de proteína, carbohidratos y grasa deben sumar 100." };
  }

  const { proteinG, carbsG, fatG } = macroGramsFromPercentages(
    kcalTarget,
    proteinPct,
    carbsPct,
    fatPct,
  );

  const { error } = await supabase.from("calorie_targets").upsert(
    {
      user_id: user.id,
      effective_date: todayIso(),
      kcal_target: kcalTarget,
      protein_g: proteinG,
      carbs_g: carbsG,
      fat_g: fatG,
    },
    { onConflict: "user_id,effective_date" },
  );

  if (error) {
    return { error: SAVE_ERROR };
  }

  redirect("/dashboard");
}
