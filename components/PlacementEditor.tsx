"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

// pdf.js solo existe en el navegador: nunca debe ejecutarse en el servidor.
const PdfCanvas = dynamic(
  () => import("@/components/PdfCanvas").then((m) => m.PdfCanvas),
  {
    ssr: false,
    loading: () => (
      <p className="py-8 text-center text-sm text-slate-500">Cargando visor…</p>
    ),
  },
);

export interface EditorSigner {
  id: string;
  name: string;
  email: string;
}

/** Recuadro en fracciones 0..1, origen ABAJO-IZQUIERDA (igual que el PDF). */
interface Box {
  signerId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "SIGNATURE" | "INITIAL";
}

const COLORS = [
  { ring: "#2563eb", bg: "rgba(37,99,235,0.15)" },
  { ring: "#16a34a", bg: "rgba(22,163,74,0.15)" },
  { ring: "#d97706", bg: "rgba(217,119,6,0.15)" },
  { ring: "#db2777", bg: "rgba(219,39,119,0.15)" },
  { ring: "#7c3aed", bg: "rgba(124,58,237,0.15)" },
];

// Tamaño por defecto al dar un solo clic, como fracción de la página.
const DEFAULT_W = 0.28;
const DEFAULT_H = 0.07;
const MIN_W = 0.04;
const MIN_H = 0.02;

type DragState =
  | { mode: "create"; startX: number; startY: number; current: Box }
  | { mode: "move"; index: number; grabDx: number; grabDy: number }
  | { mode: "resize"; index: number }
  | null;

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

export function PlacementEditor({
  documentId,
  onClose,
  onSaved,
}: {
  documentId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [signers, setSigners] = useState<EditorSigner[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [activeSigner, setActiveSigner] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [drag, setDrag] = useState<DragState>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const layerRef = useRef<HTMLDivElement>(null);

  // Carga de firmantes y recuadros ya guardados.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/documents/${documentId}/placements`);
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "No se pudo cargar el documento.");
        setSigners(data.signers);
        setActiveSigner(data.signers[0]?.id ?? null);
        setBoxes(
          data.signers.flatMap(
            (s: EditorSigner & { boxes: Omit<Box, "signerId">[] }) =>
              s.boxes.map((b) => ({ ...b, signerId: s.id })),
          ),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar.");
      }
    })();
  }, [documentId]);

  const colorOf = useCallback(
    (signerId: string) => {
      const i = signers.findIndex((s) => s.id === signerId);
      return COLORS[(i < 0 ? 0 : i) % COLORS.length];
    },
    [signers],
  );

  // --- Conversión px del canvas <-> fracciones del PDF ----------------------
  // El canvas tiene el origen arriba-izquierda; el PDF, abajo-izquierda.
  function toFrac(px: number, py: number) {
    const r = layerRef.current?.getBoundingClientRect();
    if (!r) return { fx: 0, fy: 0 };
    return { fx: (px - r.left) / r.width, fy: (py - r.top) / r.height };
  }

  /** Estilo CSS de un recuadro (convierte Y de abajo-arriba a arriba-abajo). */
  function styleOf(b: Box): React.CSSProperties {
    return {
      left: `${b.x * 100}%`,
      top: `${(1 - b.y - b.height) * 100}%`,
      width: `${b.width * 100}%`,
      height: `${b.height * 100}%`,
    };
  }

  // --- Interacción ---------------------------------------------------------
  function onPointerDownLayer(e: React.PointerEvent) {
    if (!activeSigner || e.target !== e.currentTarget) return;
    const { fx, fy } = toFrac(e.clientX, e.clientY);
    setDrag({
      mode: "create",
      startX: fx,
      startY: fy,
      current: {
        signerId: activeSigner,
        page,
        x: fx,
        y: 1 - fy,
        width: 0,
        height: 0,
        kind: "SIGNATURE",
      },
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const { fx, fy } = toFrac(e.clientX, e.clientY);

    if (drag.mode === "create") {
      const x = Math.min(drag.startX, fx);
      const right = Math.max(drag.startX, fx);
      const topY = Math.min(drag.startY, fy);
      const bottomY = Math.max(drag.startY, fy);
      setDrag({
        ...drag,
        current: {
          ...drag.current,
          x: clamp01(x),
          y: clamp01(1 - bottomY),
          width: clamp01(right - x),
          height: clamp01(bottomY - topY),
        },
      });
      return;
    }

    if (drag.mode === "move") {
      setBoxes((prev) =>
        prev.map((b, i) =>
          i === drag.index
            ? {
                ...b,
                x: clamp01(Math.min(fx - drag.grabDx, 1 - b.width)),
                y: clamp01(Math.min(1 - fy - drag.grabDy, 1 - b.height)),
              }
            : b,
        ),
      );
      return;
    }

    if (drag.mode === "resize") {
      setBoxes((prev) =>
        prev.map((b, i) => {
          if (i !== drag.index) return b;
          // El borde superior queda fijo; la esquina inferior derecha sigue al dedo.
          const topY = 1 - b.y - b.height;
          const width = Math.min(Math.max(MIN_W, fx - b.x), 1 - b.x);
          const height = Math.min(Math.max(MIN_H, fy - topY), 1 - topY);
          return { ...b, width, height, y: clamp01(1 - topY - height) };
        }),
      );
    }
  }

  function onPointerUp() {
    if (drag?.mode === "create") {
      const c = drag.current;
      // Un clic simple (sin arrastrar) crea un recuadro de tamaño estándar.
      const tiny = c.width < MIN_W || c.height < MIN_H;
      const box: Box = tiny
        ? {
            ...c,
            x: clamp01(Math.min(c.x, 1 - DEFAULT_W)),
            y: clamp01(Math.min(c.y, 1 - DEFAULT_H)),
            width: DEFAULT_W,
            height: DEFAULT_H,
          }
        : c;
      setBoxes((prev) => [...prev, box]);
    }
    setDrag(null);
  }

  function startMove(e: React.PointerEvent, index: number) {
    e.stopPropagation();
    const b = boxes[index];
    const { fx, fy } = toFrac(e.clientX, e.clientY);
    setDrag({ mode: "move", index, grabDx: fx - b.x, grabDy: 1 - fy - b.y });
    layerRef.current?.setPointerCapture(e.pointerId);
  }

  function startResize(e: React.PointerEvent, index: number) {
    e.stopPropagation();
    setDrag({ mode: "resize", index });
    layerRef.current?.setPointerCapture(e.pointerId);
  }

  function removeBox(index: number) {
    setBoxes((prev) => prev.filter((_, i) => i !== index));
  }

  /** Repite el recuadro del firmante activo en cada hoja, como rúbrica. */
  function rubricarTodas() {
    if (!activeSigner || pageCount === 0) return;
    const base =
      boxes.find((b) => b.signerId === activeSigner && b.page === page) ??
      boxes.find((b) => b.signerId === activeSigner);
    if (!base) {
      setError("Primero coloca un recuadro para este firmante.");
      return;
    }
    setError(null);
    // La rúbrica es más chica que la firma completa.
    const initial = {
      ...base,
      width: base.width / 2,
      height: base.height / 2,
      kind: "INITIAL" as const,
    };
    setBoxes((prev) => {
      const sinRubricas = prev.filter(
        (b) => !(b.signerId === activeSigner && b.kind === "INITIAL"),
      );
      const nuevas: Box[] = [];
      for (let p = 0; p < pageCount; p++) {
        // En la hoja donde ya firma completo no se agrega rúbrica.
        const yaFirma = sinRubricas.some(
          (b) => b.signerId === activeSigner && b.page === p && b.kind === "SIGNATURE",
        );
        if (!yaFirma) nuevas.push({ ...initial, page: p });
      }
      return [...sinRubricas, ...nuevas];
    });
  }

  const faltantes = signers.filter(
    (s) => !boxes.some((b) => b.signerId === s.id && b.kind === "SIGNATURE"),
  );

  async function guardar() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        placements: signers.map((s) => ({
          signerId: s.id,
          boxes: boxes
            .filter((b) => b.signerId === s.id)
            .map(({ page, x, y, width, height, kind }) => ({
              page,
              x,
              y,
              width,
              height,
              kind,
            })),
        })),
      };
      const r = await fetch(`/api/documents/${documentId}/placements`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "No se pudo guardar.");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  const visibles = boxes
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.page === page);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 p-4">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="font-semibold">Colocar firmas</h2>
            <p className="text-xs text-slate-500">
              Arrastra sobre el renglón donde debe ir cada firma.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Panel lateral */}
          <aside className="w-64 flex-shrink-0 space-y-4 overflow-y-auto border-r border-slate-200 p-4">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Firmante
              </h3>
              <ul className="space-y-1">
                {signers.map((s) => {
                  const c = colorOf(s.id);
                  const n = boxes.filter((b) => b.signerId === s.id).length;
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => setActiveSigner(s.id)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                          activeSigner === s.id
                            ? "bg-slate-100 font-medium"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className="h-3 w-3 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: c.ring }}
                        />
                        <span className="min-w-0 flex-1 truncate">{s.name}</span>
                        <span className="text-xs text-slate-400">{n}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <button
              onClick={rubricarTodas}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              Rubricar todas las hojas
            </button>

            {faltantes.length > 0 && (
              <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                Falta colocar la firma de:{" "}
                <strong>{faltantes.map((s) => s.name).join(", ")}</strong>
              </p>
            )}
            {error && (
              <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>
            )}
            <p className="text-xs text-slate-400">
              Clic simple para un recuadro estándar. Arrastra la esquina para
              ajustarlo y usa ✕ para borrarlo.
            </p>
          </aside>

          {/* Área del documento */}
          <main className="min-w-0 flex-1 overflow-auto bg-slate-100 p-4">
            <div className="mb-3 flex items-center justify-center gap-3 text-sm">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded border border-slate-300 bg-white px-2 py-1 disabled:opacity-40"
              >
                ‹
              </button>
              <span className="text-slate-600">
                Página {page + 1}
                {pageCount > 0 && ` de ${pageCount}`}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={pageCount === 0 || page >= pageCount - 1}
                className="rounded border border-slate-300 bg-white px-2 py-1 disabled:opacity-40"
              >
                ›
              </button>
            </div>

            <PdfCanvas
              src={`/api/documents/${documentId}/pdf`}
              pageIndex={page}
              onPageCount={setPageCount}
            >
              <div
                ref={layerRef}
                className="absolute inset-0 cursor-crosshair touch-none"
                onPointerDown={onPointerDownLayer}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              >
                {visibles.map(({ b, i }) => {
                  const c = colorOf(b.signerId);
                  const signer = signers.find((s) => s.id === b.signerId);
                  return (
                    <div
                      key={i}
                      className="absolute flex items-center justify-center rounded"
                      style={{
                        ...styleOf(b),
                        border: `2px ${b.kind === "INITIAL" ? "dashed" : "solid"} ${c.ring}`,
                        backgroundColor: c.bg,
                      }}
                      onPointerDown={(e) => startMove(e, i)}
                    >
                      <span
                        className="pointer-events-none select-none truncate px-1 text-[10px] font-medium"
                        style={{ color: c.ring }}
                      >
                        {b.kind === "INITIAL" ? "Rúbrica" : signer?.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBox(i);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-white text-xs leading-none shadow ring-1 ring-slate-300"
                        aria-label="Quitar recuadro"
                      >
                        ✕
                      </button>
                      <span
                        onPointerDown={(e) => startResize(e, i)}
                        className="absolute -bottom-1 -right-1 h-3 w-3 cursor-se-resize rounded-sm bg-white ring-1 ring-slate-400"
                      />
                    </div>
                  );
                })}

                {/* Recuadro que se está dibujando */}
                {drag?.mode === "create" && drag.current.width > 0 && (
                  <div
                    className="pointer-events-none absolute rounded border-2 border-dashed border-slate-500 bg-slate-500/10"
                    style={styleOf(drag.current)}
                  />
                )}
              </div>
            </PdfCanvas>
          </main>
        </div>
      </div>
    </div>
  );
}
