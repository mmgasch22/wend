import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/export/csv";
import {
  TABLAS,
  fetchAll,
  flatten,
  type PageReader,
  type Row,
  type Tabla,
} from "@/lib/export/userData";

// Exportación de los datos de la propia persona (derecho de acceso y
// portabilidad, arts. 15 y 20 RGPD). Solo lee con la sesión del usuario: la
// RLS de la base de datos garantiza que únicamente salen filas suyas, y además
// se filtra por user_id explícitamente.
//
//   GET /api/export                      → JSON con todo
//   GET /api/export?formato=csv&tabla=X  → CSV de una tabla
//
// No se exportan columnas ajenas (p. ej. foods.created_by).

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401, headers: NO_STORE });
  }

  // Orden estable (columna + id) para que la paginación no repita ni pierda filas.
  const readPage: PageReader = (t: Tabla, from, to) =>
    supabase
      .from(t.from)
      .select(t.select)
      .eq(t.userColumn, user.id)
      .order(t.order, { ascending: true })
      .order("id", { ascending: true })
      .range(from, to) as unknown as ReturnType<PageReader>;

  const params = request.nextUrl.searchParams;
  const formato = params.get("formato") ?? "json";
  const hoy = new Date().toISOString().slice(0, 10);

  try {
    if (formato === "csv") {
      const t = TABLAS[params.get("tabla") ?? ""];
      if (!t) {
        return NextResponse.json(
          { error: `Indica tabla=${Object.keys(TABLAS).join("|")}.` },
          { status: 400, headers: NO_STORE },
        );
      }
      const rows = (await fetchAll(readPage, t)).map((r) => flatten(t, r));
      return new NextResponse(toCsv(t.csvColumns, rows), {
        headers: {
          ...NO_STORE,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="wend-${t.tabla}-${hoy}.csv"`,
        },
      });
    }

    if (formato !== "json") {
      return NextResponse.json({ error: "formato debe ser json o csv." }, { status: 400, headers: NO_STORE });
    }

    const datos: Record<string, Row[]> = {};
    for (const t of Object.values(TABLAS)) {
      datos[t.tabla] = await fetchAll(readPage, t);
    }
    const body = {
      exportado_el: new Date().toISOString(),
      aplicacion: "WEND",
      cuenta: { id: user.id, email: user.email ?? null },
      datos,
    };
    return new NextResponse(JSON.stringify(body, null, 2), {
      headers: {
        ...NO_STORE,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="wend-datos-${hoy}.json"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "No se han podido leer tus datos. Inténtalo de nuevo en un momento." },
      { status: 500, headers: NO_STORE },
    );
  }
}
