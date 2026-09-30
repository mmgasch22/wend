import RegisterForm from "./RegisterForm";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">WEND</h1>
        <p className="mt-1 text-sm text-text-dim">Crear cuenta</p>
      </div>
      <RegisterForm />
    </main>
  );
}
