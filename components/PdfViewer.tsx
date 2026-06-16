"use client";

/** Visor de PDF simple basado en el visor nativo del navegador (sin dependencias pesadas). */
export function PdfViewer({ src, title }: { src: string; title?: string }) {
  return (
    <object
      data={src}
      type="application/pdf"
      className="h-[60vh] w-full rounded-lg border border-slate-300 bg-white"
      aria-label={title ?? "Documento PDF"}
    >
      <div className="p-4 text-sm text-slate-600">
        Tu navegador no puede mostrar el PDF.{" "}
        <a className="text-blue-600 underline" href={src} target="_blank" rel="noreferrer">
          Ábrelo en una pestaña nueva.
        </a>
      </div>
    </object>
  );
}
