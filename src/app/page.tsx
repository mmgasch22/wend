import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div>
        <h1 className="text-4xl font-semibold text-foreground">WEND</h1>
        <p className="mt-2 text-sm text-text-dim">
          Menos tiempo registrando. Más tiempo viviendo.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/login">
          <Button variant="primary">Iniciar sesión</Button>
        </Link>
        <Link href="/register">
          <Button variant="secondary">Crear cuenta</Button>
        </Link>
      </div>
    </main>
  );
}
