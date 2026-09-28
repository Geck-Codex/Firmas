"use client";

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import SignaturePadLib from "signature_pad";

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  clear: () => void;
  toDataURL: () => string;
}

/** Wrapper de signature_pad sobre un <canvas> con manejo de DPI/resize. */
export const SignaturePad = forwardRef<SignaturePadHandle>(function SignaturePad(
  _props,
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePadLib(canvas, {
      backgroundColor: "rgba(255,255,255,1)",
      penColor: "rgb(15,23,42)",
    });
    padRef.current = pad;

    const onEnd = () => setEmpty(pad.isEmpty());
    pad.addEventListener("endStroke", onEnd);

    function resize() {
      if (!canvas) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const { width } = canvas.getBoundingClientRect();
      canvas.width = width * ratio;
      canvas.height = 200 * ratio;
      const ctx = canvas.getContext("2d");
      ctx?.scale(ratio, ratio);
      pad.clear();
      setEmpty(true);
    }

    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      pad.removeEventListener("endStroke", onEnd);
      pad.off();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    isEmpty: () => padRef.current?.isEmpty() ?? true,
    clear: () => {
      padRef.current?.clear();
      setEmpty(true);
    },
    toDataURL: () => padRef.current?.toDataURL("image/png") ?? "",
  }));

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="h-[200px] w-full touch-none rounded-lg border-2 border-dashed border-slate-400 bg-white"
      />
      {empty && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-8">
          <p className="mb-3 text-sm text-slate-400 select-none">
            ✍️ Firma aquí con el dedo o lápiz
          </p>
          <div className="w-2/3 border-b-2 border-slate-300" />
        </div>
      )}
    </div>
  );
});
