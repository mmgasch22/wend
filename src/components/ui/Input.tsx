import { type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

// Mismo criterio que Select: fondo/borde/texto explícitos de Clarity, para
// que ningún input nuevo se quede en el estilo por defecto del navegador.
export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`rounded-button border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-text-dim ${className}`}
      {...props}
    />
  );
}
