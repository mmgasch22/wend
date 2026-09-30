"use client";

import { useSyncExternalStore } from "react";

type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "wend-theme";

const OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
  { value: "light", label: "Claro", icon: "☀" },
  { value: "dark", label: "Oscuro", icon: "🌙" },
  { value: "system", label: "Sistema", icon: "🖥" },
];

function applyTheme(pref: ThemePreference) {
  if (pref === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.dataset.theme = pref;
  }
}

function readPref(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // localStorage puede no estar disponible (modo privado, etc.).
  }
  return "system";
}

function getServerSnapshot(): ThemePreference {
  return "system";
}

// "storage" solo dispara en OTRAS pestañas — choose() dispara el mismo
// evento a mano en esta pestaña para que useSyncExternalStore vuelva a
// leer el valor tras un clic.
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

// El script inline en layout.tsx ya aplica el tema guardado al <html>
// antes del primer pintado (evita el parpadeo). useSyncExternalStore deja
// que el propio texto/estado "pulsado" de los botones coincida entre
// servidor y cliente sin warnings de hidratación (a diferencia de leer
// localStorage en un efecto).
export function ThemeToggle() {
  const pref = useSyncExternalStore(subscribe, readPref, getServerSnapshot);

  function choose(next: ThemePreference) {
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // El tema igual se aplica para esta sesión, solo no se recuerda.
    }
    window.dispatchEvent(new Event("storage"));
  }

  return (
    <div
      className="flex shrink-0 gap-0.5 rounded-button bg-border p-0.5"
      role="group"
      aria-label="Tema"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => choose(opt.value)}
          aria-pressed={pref === opt.value}
          aria-label={opt.label}
          title={opt.label}
          className={`flex h-7 w-7 items-center justify-center rounded-[calc(var(--radius-button)-2px)] text-sm transition-colors ${
            pref === opt.value ? "bg-surface text-primary" : "text-text-dim"
          }`}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}
