"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calculateAge } from "@/lib/nutrition/age";
import { calculateBmr } from "@/lib/nutrition/bmr";
import { calculateTdee } from "@/lib/nutrition/tdee";
import { calculateNutritionTargets } from "@/lib/nutrition/targets";
import type { ActivityLevel, Goal, Sex } from "@/lib/nutrition/types";

export type OnboardingActionState = { error: string } | undefined;

// Comidas habituales con las que arranca todo usuario nuevo — el usuario
// las puede renombrar, reordenar o borrar libremente desde el dashboard en
// cuanto quiera; esto solo evita que el primer día vea un dashboard vacío.
const DEFAULT_MEAL_SLOTS = ["Desayuno", "Comida", "Snack", "Cena"];

const DEFAULT_DAILY_WATER_GOAL_ML = 2000;

export async function completeOnboarding(
  _prevState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
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
  const weightKg = Number(formData.get("weight_kg"));

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    name,
    birth_date: birthDate,
    sex,
    height_cm: heightCm,
    activity_level: activityLevel,
    goal,
    daily_steps_goal: dailyStepsGoal,
    // El onboarding no pregunta por el agua (decisión de producto de Sprint 4),
    // pero sin objetivo la tarjeta de Agua queda "vacía" para todo usuario
    // nuevo. 2000 ml (~8 vasos) es un valor inicial, editable en Editar perfil.
    daily_water_goal_ml: DEFAULT_DAILY_WATER_GOAL_ML,
  });

  if (profileError) {
    return { error: profileError.message };
  }

  const today = new Date().toISOString().slice(0, 10);

  const { error: weightError } = await supabase.from("weight_logs").insert({
    user_id: user.id,
    date: today,
    weight_kg: weightKg,
  });

  if (weightError) {
    return { error: weightError.message };
  }

  const age = calculateAge(birthDate);
  const bmr = calculateBmr(sex, weightKg, heightCm, age);
  const tdee = calculateTdee(bmr, activityLevel);
  const targets = calculateNutritionTargets({ tdee, weightKg, goal });

  if (!targets.feasible) {
    return {
      error:
        targets.warning ??
        "No se ha podido calcular un objetivo nutricional viable con estos datos.",
    };
  }

  const { error: targetError } = await supabase
    .from("calorie_targets")
    .upsert(
      {
        user_id: user.id,
        effective_date: today,
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

  // Idempotente a propósito: si el formulario se reenvía tras un fallo a
  // mitad de camino, no se deben duplicar las comidas por defecto (a
  // diferencia de weight_logs, un duplicado aquí sí sería visible y molesto).
  const { data: existingMealSlots } = await supabase
    .from("meal_slots")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (!existingMealSlots || existingMealSlots.length === 0) {
    const { error: mealSlotsError } = await supabase.from("meal_slots").insert(
      DEFAULT_MEAL_SLOTS.map((name, index) => ({
        user_id: user.id,
        name,
        sort_order: index,
      })),
    );

    if (mealSlotsError) {
      return { error: mealSlotsError.message };
    }
  }

  redirect("/dashboard");
}
