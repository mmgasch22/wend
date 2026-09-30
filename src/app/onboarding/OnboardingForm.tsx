"use client";

import { useActionState } from "react";
import { completeOnboarding } from "@/features/onboarding/actions";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function OnboardingForm() {
  const [state, action, pending] = useActionState(completeOnboarding, undefined);

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Nombre
        </label>
        <Input id="name" name="name" type="text" required />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="birth_date" className="text-sm font-medium">
          Fecha de nacimiento
        </label>
        <Input id="birth_date" name="birth_date" type="date" required />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="sex" className="text-sm font-medium">
          Sexo
        </label>
        <Select id="sex" name="sex" required>
          <option value="">Selecciona...</option>
          <option value="male">Hombre</option>
          <option value="female">Mujer</option>
          <option value="other">Otro</option>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="height_cm" className="text-sm font-medium">
          Altura (cm)
        </label>
        <Input id="height_cm" name="height_cm" type="number" step="0.1" min="1" required />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="weight_kg" className="text-sm font-medium">
          Peso actual (kg)
        </label>
        <Input id="weight_kg" name="weight_kg" type="number" step="0.01" min="1" required />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="activity_level" className="text-sm font-medium">
          Nivel de actividad
        </label>
        <Select id="activity_level" name="activity_level" required>
          <option value="">Selecciona...</option>
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
        <Select id="goal" name="goal" required>
          <option value="">Selecciona...</option>
          <option value="lose">Perder grasa</option>
          <option value="maintain">Mantener</option>
          <option value="gain">Ganar masa</option>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="daily_steps_goal" className="text-sm font-medium">
          Objetivo diario de pasos
        </label>
        <Input
          id="daily_steps_goal"
          name="daily_steps_goal"
          type="number"
          step="1"
          min="1"
          required
        />
      </div>

      {state?.error && (
        <p className="rounded-card border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Completar perfil"}
      </Button>
    </form>
  );
}
