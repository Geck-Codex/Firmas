"use client";

import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePadLib(canvas, {
      backgroundColor: "rgba(255,255,255,1)",
      penColor: "rgb(15,23,42)",
    });
    padRef.current = pad;

    function resize() {
      if (!canvas) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const { width } = canvas.getBoundingClientRect();
      canvas.width = width * ratio;
      canvas.height = 200 * ratio;
      const ctx = canvas.getContext("2d");
      ctx?.scale(ratio, ratio);
      pad.clear(); // evita trazos deformados tras redimensionar
    }

    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      pad.off();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    isEmpty: () => padRef.current?.isEmpty() ?? true,
    clear: () => padRef.current?.clear(),
    toDataURL: () => padRef.current?.toDataURL("image/png") ?? "",
  }));

  return (
    <canvas
      ref={canvasRef}
      className="h-[200px] w-full touch-none rounded-lg border border-slate-300 bg-white"
    />
  );
});
