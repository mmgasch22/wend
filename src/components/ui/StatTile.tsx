import { ProgressBar } from "./ProgressBar";

interface StatTileProps {
  label: string;
  value: number;
  unit: string;
  color?: string;
  /** 0–100. Si se omite, no se muestra barra de progreso. */
  progress?: number;
}

export function StatTile({
  label,
  value,
  unit,
  color = "var(--primary)",
  progress,
}: StatTileProps) {
  return (
    <div className="shadow-card rounded-card border border-border bg-surface p-4">
      <span
        className="block font-mono text-2xl font-semibold tabular-nums"
        style={{ color }}
      >
        {value}
        <span className="text-xs font-medium opacity-70"> {unit}</span>
      </span>
      <span
        className="mt-1.5 block text-[11px] font-medium uppercase tracking-wide opacity-85"
        style={{ color }}
      >
        {label}
      </span>
      {progress !== undefined && (
        <div className="mt-2.5">
          <ProgressBar value={progress} color={color} />
        </div>
      )}
    </div>
  );
}
