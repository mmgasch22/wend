import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Cliente de Supabase falso: devuelve las filas de `fixtures` por tabla y
// respeta .range(), igual que PostgREST.
type Fixtures = Record<string, Record<string, unknown>[]>;
let fixtures: Fixtures = {};
let user: { id: string; email: string } | null = null;
const selects: Record<string, string> = {};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: (table: string) => ({
      select: (columns: string) => {
        selects[table] = columns;
        const chain = {
          eq: () => chain,
          order: () => chain,
          range: async (from: number, to: number) => ({
            data: (fixtures[table] ?? []).slice(from, to + 1),
            error: null,
          }),
        };
        return chain;
      },
    }),
  }),
}));

import { GET } from "./route";

const req = (qs = "") => new NextRequest(`http://localhost/api/export${qs}`);

beforeEach(() => {
  user = { id: "u1", email: "yo@example.com" };
  fixtures = {
    profiles: [{ name: "Ana", birth_date: "1990-01-01", sex: "female", height_cm: 165 }],
    weight_logs: [{ date: "2026-10-01", weight_kg: 60.5 }],
    food_logs: [
      {
        date: "2026-10-02",
        grams: 150,
        meal_slot_id: "s1",
        meal_slots: { name: "Comida" },
        foods: { name: "=SUMA(1;1)", barcode: null, kcal_100g: 130 },
      },
      { date: "2026-10-02", grams: 30, meal_slot_id: null, meal_slots: null, foods: { name: "Pan, integral", barcode: "123", kcal_100g: 250 } },
    ],
  };
});

describe("GET /api/export", () => {
  it("sin sesión responde 401 y no consulta nada", async () => {
    user = null;
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "No has iniciado sesión." });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("JSON: contiene todas las secciones, la cuenta y es descargable", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment; filename="wend-datos-\d{4}-\d{2}-\d{2}\.json"/);
    const body = JSON.parse(await res.text());
    expect(body.cuenta).toEqual({ id: "u1", email: "yo@example.com" });
    expect(Object.keys(body.datos).sort()).toEqual(
      ["agua", "comidas", "comidas_nombres", "objetivos", "pasos", "peso", "perfil"].sort(),
    );
    expect(body.datos.perfil[0].name).toBe("Ana");
    expect(body.datos.peso).toEqual([{ date: "2026-10-01", weight_kg: 60.5 }]);
    expect(body.datos.comidas).toHaveLength(2);
  });

  it("nunca pide created_by ni columnas de otros usuarios", async () => {
    await GET(req());
    for (const columns of Object.values(selects)) expect(columns).not.toContain("created_by");
  });

  it("CSV de comidas: cabecera, nombre del tramo, comas escapadas y fórmulas neutralizadas", async () => {
    const res = await GET(req("?formato=csv&tabla=comidas"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    const text = await res.text();
    const lines = text.replace("﻿", "").trim().split("\r\n");
    expect(lines[0]).toBe(
      "date,meal_name,grams,food_name,barcode,kcal_100g,protein_100g,carbs_100g,fat_100g,fiber_100g,sugar_100g,salt_100g",
    );
    expect(lines[1]).toBe("2026-10-02,Comida,150,'=SUMA(1;1),,130,,,,,,");
    expect(lines[2]).toBe('2026-10-02,,30,"Pan, integral",123,250,,,,,,');
  });

  it("tabla desconocida o formato inválido: 400", async () => {
    expect((await GET(req("?formato=csv&tabla=otra"))).status).toBe(400);
    expect((await GET(req("?formato=xml"))).status).toBe(400);
  });
});
