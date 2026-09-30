"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/features/auth/actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>

      {state?.error && (
        <p className="rounded-card border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Enviar enlace"}
      </Button>

      <p className="text-center text-sm text-text-dim">
        <Link href="/login" className="font-medium text-primary">
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}
