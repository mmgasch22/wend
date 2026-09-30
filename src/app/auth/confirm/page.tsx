"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ConfirmPage() {
  useEffect(() => {
    const supabase = createClient();

    // El cliente ya procesó el token del fragmento de la URL al crearse
    // (detectSessionInUrl, activado por defecto). Solo esperamos a que
    // la sesión quede disponible.
    supabase.auth.getSession().then(({ data: { session } }) => {
      window.location.assign(
        session ? "/dashboard" : "/login?error=confirmation_failed",
      );
    });
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-6">
      <p className="text-sm text-text-dim">Confirmando tu cuenta...</p>
    </main>
  );
}
