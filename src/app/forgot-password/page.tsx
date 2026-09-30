import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">
          Restablecer contraseña
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-text-dim">
          Escribe el email de tu cuenta y te enviaremos un enlace para elegir
          una contraseña nueva.
        </p>
      </div>
      <ForgotPasswordForm />
    </main>
  );
}
