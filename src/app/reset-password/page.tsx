"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Status = "checking" | "ready" | "invalid" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // El cliente ya procesó el token del fragmento de la URL al crearse
    // (detectSessionInUrl) — mismo mecanismo que /auth/confirm. Si hay
    // sesión, es una sesión de recuperación temporal válida para cambiar
    // la contraseña.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? "ready" : "invalid");
    });
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    setPending(false);

    if (error) {
      setError(error.message);
      return;
    }

    setStatus("done");
    window.setTimeout(() => router.push("/dashboard"), 1200);
  }

  if (status === "checking") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-6">
        <p className="text-sm text-text-dim">Comprobando el enlace...</p>
      </main>
    );
  }

  if (status === "invalid") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 py-6 text-center">
        <p className="text-sm text-text-dim">
          Este enlace no es válido o ha caducado.
        </p>
        <Link href="/forgot-password" className="text-sm font-medium text-primary">
          Solicitar uno nuevo
        </Link>
      </main>
    );
  }

  if (status === "done") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-6">
        <p className="text-sm text-text-dim">Contraseña actualizada. Entrando...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-6">
      <h1 className="text-2xl font-semibold text-foreground">Nueva contraseña</h1>
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium">
            Nueva contraseña
          </label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p className="rounded-card border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar contraseña"}
        </Button>
      </form>
    </main>
  );
}
