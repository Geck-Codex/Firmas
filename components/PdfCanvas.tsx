"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Renderiza UNA página del PDF a un <canvas> y deja una capa encima donde se
 * pueden posicionar recuadros.
 *
 * El <object> nativo de PdfViewer.tsx no sirve para esto: no permite dibujar
 * encima ni capturar clics. Por eso aquí se usa pdf.js, que pinta la página a
 * un canvas propio y nos da su tamaño exacto en píxeles.
 *
 * Debe montarse solo en el cliente (next/dynamic con ssr:false).
 */

/**
 * Tipos mínimos de pdf.js que usamos aquí. La librería no exporta tipos
 * cómodos para este caso, y el Claude.md pide evitar `any`.
 */
interface PdfViewportLike {
  width: number;
  height: number;
}

interface PdfRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

interface PdfPageLike {
  getViewport(opts: { scale: number }): PdfViewportLike;
  render(opts: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewportLike;
  }): PdfRenderTask;
}

interface PdfDocumentLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike>;
  destroy(): void;
}

export interface PdfCanvasProps {
  src: string;
  /** Página a mostrar, 0-based. */
  pageIndex: number;
  /** Se llama una vez cuando se conoce el total de páginas. */
  onPageCount?: (count: number) => void;
  /** Capa superpuesta, dimensionada exactamente como la página. */
  children?: ReactNode;
  className?: string;
}

interface PageSize {
  width: number;
  height: number;
}

export function PdfCanvas({
  src,
  pageIndex,
  onPageCount,
  children,
  className,
}: PdfCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PdfDocumentLike | null>(null);
  const [size, setSize] = useState<PageSize | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  // Señal de "documento listo": dispara el primer render de página.
  const [loadedAt, setLoadedAt] = useState(0);

  // Ancho disponible — el PDF se escala para ocupar el contenedor.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Carga del documento (una sola vez por src).
  useEffect(() => {
    let cancelled = false;
    docRef.current = null;
    setSize(null);
    setError(null);

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = (await pdfjs.getDocument({ url: src }).promise) as unknown as PdfDocumentLike;
        if (cancelled) {
          doc.destroy();
          return;
        }
        docRef.current = doc;
        onPageCount?.(doc.numPages);
        setError(null);
        setLoadedAt(Date.now());
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "No se pudo cargar el PDF.");
        }
      }
    })();

    return () => {
      cancelled = true;
      docRef.current?.destroy();
      docRef.current = null;
    };
    // onPageCount se omite a propósito: solo debe recargarse si cambia el PDF.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Render de la página actual.
  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || containerWidth === 0) return;

    let renderTask: PdfRenderTask | null = null;
    let cancelled = false;

    (async () => {
      try {
        const page = await doc.getPage(pageIndex + 1);
        if (cancelled) return;

        const base = page.getViewport({ scale: 1 });
        const scale = containerWidth / base.width;
        const viewport = page.getViewport({ scale });

        // Nitidez en pantallas de alta densidad sin deformar el layout.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
        if (!cancelled) {
          setSize({ width: viewport.width, height: viewport.height });
        }
      } catch (e) {
        // Cancelar un render en curso es normal al cambiar de página.
        const name = (e as { name?: string })?.name;
        if (!cancelled && name !== "RenderingCancelledException") {
          setError(e instanceof Error ? e.message : "No se pudo dibujar la página.");
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pageIndex, containerWidth, loadedAt]);

  return (
    <div ref={wrapRef} className={className}>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div
        className="relative mx-auto"
        style={size ? { width: size.width, height: size.height } : undefined}
      >
        <canvas ref={canvasRef} className="block rounded-lg border border-slate-300 shadow-sm" />
        {/* Capa de recuadros: cubre exactamente la página dibujada. */}
        {size && <div className="absolute inset-0">{children}</div>}
      </div>
      {!size && !error && (
        <p className="py-8 text-center text-sm text-slate-500">Cargando documento…</p>
      )}
    </div>
  );
}
