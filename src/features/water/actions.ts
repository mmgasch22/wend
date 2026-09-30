"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveRequestedDate } from "@/lib/date/dates";
import { dashboardUrl } from "@/lib/navigation/dashboardUrl";

// A diferencia de logSteps (que guarda el TOTAL enviado tal cual), el agua
// se registra a golpes rápidos ("+250 ml") — cada envío es un INCREMENTO,
// no un total nuevo. Por eso hace falta leer el valor actual del día antes
// del upsert. water_logs sigue teniendo UNIQUE(user_id, date), así que el
// upsert resuelve igualmente "crear si no existe, actualizar si existe".
export async function addWater(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const amount = Number(formData.get("amount_ml"));
  const date = resolveRequestedDate(formData.get("date") as string | null);

  if (Number.isFinite(amount) && amount > 0) {
    const { data: existing } = await supabase
      .from("water_logs")
      .select("value_ml")
      .eq("user_id", user.id)
      .eq("date", date)
      .maybeSingle();

    const { error } = await supabase.from("water_logs").upsert(
      { user_id: user.id, date, value_ml: (existing?.value_ml ?? 0) + amount },
      { onConflict: "user_id,date" },
    );

    if (error) {
      redirect(dashboardUrl(date, "No se pudo registrar el agua. Inténtalo de nuevo."));
    }
  }

  redirect(dashboardUrl(date));
}
