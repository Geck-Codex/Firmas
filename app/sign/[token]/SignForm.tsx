"use client";

import { useEffect, useRef, useState } from "react";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { PdfViewer } from "@/components/PdfViewer";

interface SignInfo {
  signerName: string;
  documentTitle: string;
  documentStatus: string;
  alreadySigned: boolean;
  canSign: boolean;
}

export function SignForm({ token }: { token: string }) {
  const [info, setInfo] = useState<SignInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    fetch(`/api/sign/${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Enlace inválido.");
        setInfo(data);
      })
      .catch((e) => setLoadError(e.message));
  }, [token]);

  async function submit() {
    setError(null);
    if (!padRef.current || padRef.current.isEmpty()) {
      setError("Dibuja tu firma antes de continuar.");
      return;
    }
    if (!consent) {
      setError("Debes aceptar firmar el documento.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureImg: padRef.current.toDataURL(),
          consent: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al firmar.");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
        {loadError}
      </div>
    );
  }
  if (!info) {
    return <p className="text-center text-slate-500">Cargando…</p>;
  }
  if (done || info.alreadySigned) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
        <h1 className="text-xl font-semibold text-green-800">¡Firma registrada!</h1>
        <p className="mt-2 text-sm text-green-700">
          Gracias, {info.signerName}. Tu firma de «{info.documentTitle}» quedó
          guardada con su rastro de evidencia.
        </p>
      </div>
    );
  }
  if (!info.canSign) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
        Este documento no está disponible para firma en este momento.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{info.documentTitle}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Hola {info.signerName}, revisa el documento y firma abajo.
        </p>
      </header>

      <PdfViewer src={`/api/sign/${token}/pdf`} title={info.documentTitle} />

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium">Tu firma</label>
          <button
            type="button"
            onClick={() => padRef.current?.clear()}
            className="text-sm text-slate-500 hover:underline"
          >
            Limpiar
          </button>
        </div>
        <SignaturePad ref={padRef} />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Acepto firmar este documento y manifiesto mi consentimiento de forma
          electrónica.
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {busy ? "Firmando…" : "Firmar documento"}
      </button>
    </div>
  );
}
