"use client";

import { useActionState } from "react";
import { updateProfile } from "@/features/profile/actions";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

const inputClass =
  "rounded-button border border-border bg-surface px-3 py-2 text-sm text-foreground";

interface ProfileEditFormProps {
  defaults: {
    name: string;
    birthDate: string;
    sex: string;
    heightCm: number;
    activityLevel: string;
    goal: string;
    dailyStepsGoal: number;
    dailyWaterGoalMl: number;
  };
}

export default function ProfileEditForm({ defaults }: ProfileEditFormProps) {
  const [state, action, pending] = useActionState(updateProfile, undefined);

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={defaults.name}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="birth_date" className="text-sm font-medium">
          Fecha de nacimiento
        </label>
        <input
          id="birth_date"
          name="birth_date"
          type="date"
          required
          defaultValue={defaults.birthDate}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="sex" className="text-sm font-medium">
          Sexo
        </label>
        <Select id="sex" name="sex" required defaultValue={defaults.sex}>
          <option value="male">Hombre</option>
          <option value="female">Mujer</option>
          <option value="other">Otro</option>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="height_cm" className="text-sm font-medium">
          Altura (cm)
        </label>
        <input
          id="height_cm"
          name="height_cm"
          type="number"
          step="0.1"
          min="1"
          required
          defaultValue={defaults.heightCm}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="activity_level" className="text-sm font-medium">
          Nivel de actividad
        </label>
        <Select
          id="activity_level"
          name="activity_level"
          required
          defaultValue={defaults.activityLevel}
        >
          <option value="sedentary">Sedentario</option>
          <option value="light">Ligero</option>
          <option value="moderate">Moderado</option>
          <option value="very_active">Muy activo</option>
          <option value="extra_active">Extra activo</option>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="goal" className="text-sm font-medium">
          Objetivo
        </label>
        <Select id="goal" name="goal" required defaultValue={defaults.goal}>
          <option value="lose">Perder grasa</option>
          <option value="maintain">Mantener</option>
          <option value="gain">Ganar masa</option>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="daily_steps_goal" className="text-sm font-medium">
          Objetivo diario de pasos
        </label>
        <input
          id="daily_steps_goal"
          name="daily_steps_goal"
          type="number"
          step="1"
          min="1"
          required
          defaultValue={defaults.dailyStepsGoal}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="daily_water_goal_ml" className="text-sm font-medium">
          Objetivo diario de agua (ml)
        </label>
        <input
          id="daily_water_goal_ml"
          name="daily_water_goal_ml"
          type="number"
          step="1"
          min="1"
          required
          defaultValue={defaults.dailyWaterGoalMl}
          className={inputClass}
        />
      </div>

      <p className="text-xs text-text-dim">
        El objetivo calórico y de macros se recalcula automáticamente con
        estos datos y tu peso más reciente al guardar.
      </p>

      {state?.error && (
        <p className="rounded-card border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
