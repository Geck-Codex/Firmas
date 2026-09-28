"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const PdfCanvas = dynamic(
  () => import("@/components/PdfCanvas").then((m) => m.PdfCanvas),
  {
    ssr: false,
    loading: () => (
      <p className="py-8 text-center text-sm text-slate-500">Cargando documento…</p>
    ),
  },
);

export interface HighlightBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: string;
}

/**
 * Muestra el PDF marcándole al firmante dónde quedará su firma.
 *
 * Abre directamente en la página de su firma: en un contrato de 14 hojas,
 * obligarlo a buscarla sería justo la confusión que este cambio elimina.
 */
export function PdfWithHighlight({
  src,
  boxes,
}: {
  src: string;
  boxes: HighlightBox[];
}) {
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [jumped, setJumped] = useState(false);

  // Saltar una sola vez a la hoja donde va la firma.
  useEffect(() => {
    if (jumped || boxes.length === 0) return;
    const main = boxes.find((b) => b.kind === "SIGNATURE") ?? boxes[0];
    setPage(main.page);
    setJumped(true);
  }, [boxes, jumped]);

  const visibles = boxes.filter((b) => b.page === page);

  return (
    <div>
      <div className="mb-2 flex items-center justify-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="rounded border border-slate-300 bg-white px-2 py-1 disabled:opacity-40"
          aria-label="Página anterior"
        >
          ‹
        </button>
        <span className="text-slate-600">
          Página {page + 1}
          {pageCount > 0 && ` de ${pageCount}`}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          disabled={pageCount === 0 || page >= pageCount - 1}
          className="rounded border border-slate-300 bg-white px-2 py-1 disabled:opacity-40"
          aria-label="Página siguiente"
        >
          ›
        </button>
      </div>

      <div className="max-h-[60vh] overflow-auto rounded-lg bg-slate-100 p-3">
        <PdfCanvas src={src} pageIndex={page} onPageCount={setPageCount}>
          {visibles.map((b, i) => (
            <div
              key={i}
              className="absolute flex items-center justify-center rounded border-2 border-dashed border-blue-600 bg-blue-500/10"
              style={{
                left: `${b.x * 100}%`,
                top: `${(1 - b.y - b.height) * 100}%`,
                width: `${b.width * 100}%`,
                height: `${b.height * 100}%`,
              }}
            >
              <span className="select-none truncate px-1 text-[10px] font-medium text-blue-700">
                {b.kind === "INITIAL" ? "Tu rúbrica" : "Aquí va tu firma"}
              </span>
            </div>
          ))}
        </PdfCanvas>
      </div>
    </div>
  );
}
