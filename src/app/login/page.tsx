import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { registered, error, reset } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">WEND</h1>
        <p className="mt-1 text-sm text-text-dim">Iniciar sesión</p>
      </div>

      {registered && (
        <p className="w-full max-w-sm rounded-card border border-green-200 bg-green-50 px-3 py-2 text-center text-sm text-green-700">
          Cuenta creada. Revisa tu email para confirmar tu cuenta antes de
          iniciar sesión.
        </p>
      )}
      {reset === "sent" && (
        <p className="w-full max-w-sm rounded-card border border-green-200 bg-green-50 px-3 py-2 text-center text-sm text-green-700">
          Si ese email tiene una cuenta, te hemos enviado un enlace para
          restablecer la contraseña.
        </p>
      )}
      {error === "confirmation_failed" && (
        <p className="w-full max-w-sm rounded-card border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-700">
          El enlace de confirmación no es válido o ha caducado. Regístrate de
          nuevo para recibir uno nuevo.
        </p>
      )}

      <LoginForm />
    </main>
  );
}
