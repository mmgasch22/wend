"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calculateAge } from "@/lib/nutrition/age";
import { calculateBmr } from "@/lib/nutrition/bmr";
import { calculateTdee } from "@/lib/nutrition/tdee";
import { calculateNutritionTargets } from "@/lib/nutrition/targets";
import type { ActivityLevel, Goal, Sex } from "@/lib/nutrition/types";
import { todayIso } from "@/lib/date/dates";

export type ProfileActionState = { error: string } | undefined;

// Edita el perfil creado en el onboarding (todo salvo el peso, que ya
// tiene su propia card en el dashboard) y recalcula el objetivo calórico
// en el mismo paso, sin pedir confirmación aparte — mismo criterio que ya
// usa completeOnboarding: se calcula y se guarda directamente. Usa el
// peso más reciente ya registrado (no se vuelve a preguntar aquí).
export async function updateProfile(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name = formData.get("name") as string;
  const birthDate = formData.get("birth_date") as string;
  const sex = formData.get("sex") as Sex;
  const heightCm = Number(formData.get("height_cm"));
  const activityLevel = formData.get("activity_level") as ActivityLevel;
  const goal = formData.get("goal") as Goal;
  const dailyStepsGoal = Number(formData.get("daily_steps_goal"));
  const dailyWaterGoalMl = Number(formData.get("daily_water_goal_ml"));

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      name,
      birth_date: birthDate,
      sex,
      height_cm: heightCm,
      activity_level: activityLevel,
      goal,
      daily_steps_goal: dailyStepsGoal,
      daily_water_goal_ml: dailyWaterGoalMl,
    })
    .eq("id", user.id);

  if (profileError) {
    return { error: profileError.message };
  }

  const { data: latestWeight } = await supabase
    .from("weight_logs")
    .select("weight_kg")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // No debería pasar (el onboarding siempre crea un primer weight_log),
  // pero si no hay ningún peso registrado no hay con qué recalcular — el
  // perfil ya se ha guardado, simplemente no se toca el objetivo.
  if (!latestWeight) {
    redirect("/dashboard");
  }

  const age = calculateAge(birthDate);
  const bmr = calculateBmr(sex, latestWeight.weight_kg, heightCm, age);
  const tdee = calculateTdee(bmr, activityLevel);
  const targets = calculateNutritionTargets({
    tdee,
    weightKg: latestWeight.weight_kg,
    goal,
  });

  if (!targets.feasible) {
    return {
      error:
        (targets.warning ??
          "No se ha podido calcular un objetivo nutricional viable con estos datos.") +
        " El resto del perfil sí se ha guardado.",
    };
  }

  const { error: targetError } = await supabase.from("calorie_targets").upsert(
    {
      user_id: user.id,
      effective_date: todayIso(),
      kcal_target: targets.kcalTarget,
      protein_g: targets.proteinG,
      carbs_g: targets.carbsG,
      fat_g: targets.fatG,
    },
    { onConflict: "user_id,effective_date" },
  );

  if (targetError) {
    return { error: targetError.message };
  }

  redirect("/dashboard");
}
