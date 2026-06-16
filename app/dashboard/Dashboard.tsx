"use client";

import { useCallback, useEffect, useState } from "react";

interface Signer {
  id: string;
  name: string;
  email: string;
  status: string;
  signToken: string;
  signedAt: string | null;
  evidence: Record<string, unknown> | null;
}

interface Document {
  id: string;
  title: string;
  status: string;
  finalHash: string | null;
  createdAt: string;
  signers: Signer[];
}

interface SignerForm {
  name: string;
  email: string;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviado",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SENT: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-600",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function Dashboard() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [annexFiles, setAnnexFiles] = useState<File[]>([]);
  const [signers, setSigners] = useState<SignerForm[]>([{ name: "", email: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<Record<string, { name: string; url: string }[]>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/documents");
    const data = await res.json();
    setDocuments(data.documents ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function updateSigner(i: number, field: keyof SignerForm, value: string) {
    setSigners((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)),
    );
  }

  async function createDocument(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Selecciona un PDF.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title);
      fd.append("signers", JSON.stringify(signers));
      for (const annex of annexFiles) fd.append("annexes", annex);
      const res = await fetch("/api/documents", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al crear el documento.");
      setTitle("");
      setFile(null);
      setAnnexFiles([]);
      setSigners([{ name: "", email: "" }]);
      (document.getElementById("pdf-input") as HTMLInputElement | null)?.value &&
        ((document.getElementById("pdf-input") as HTMLInputElement).value = "");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setBusy(false);
    }
  }

  async function send(id: string) {
    const res = await fetch(`/api/documents/${id}/send`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setLinks((prev) => ({ ...prev, [id]: data.links }));
      await load();
    } else {
      setError(data.error ?? "Error al enviar.");
    }
  }

  async function cancel(id: string) {
    if (!confirm("¿Cancelar este documento? Los enlaces de firma dejarán de funcionar.")) return;
    const res = await fetch(`/api/documents/${id}/cancel`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      await load();
    } else {
      setError(data.error ?? "Error al cancelar.");
    }
  }

  return (
    <div className="space-y-10">
      {/* Crear documento */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Nuevo documento</h2>
        <form onSubmit={createDocument} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Contrato de desarrollo de software"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">PDF</label>
            <input
              id="pdf-input"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">
              Anexos <span className="text-slate-400 font-normal">(opcional, PDF)</span>
            </label>
            <input
              id="annex-input"
              type="file"
              accept="application/pdf"
              multiple
              onChange={(e) => setAnnexFiles(Array.from(e.target.files ?? []))}
              className="mt-1 w-full text-sm"
            />
            {annexFiles.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                {annexFiles.map((f, i) => (
                  <li key={i}>📎 {f.name}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">Firmantes</label>
            {signers.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={s.name}
                  onChange={(e) => updateSigner(i, "name", e.target.value)}
                  placeholder="Nombre"
                  className="w-1/2 rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
                <input
                  value={s.email}
                  onChange={(e) => updateSigner(i, "email", e.target.value)}
                  placeholder="correo@ejemplo.com"
                  type="email"
                  className="w-1/2 rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
                {signers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSigners((p) => p.filter((_, idx) => idx !== i))}
                    className="rounded-lg px-2 text-slate-400 hover:text-red-600"
                    aria-label="Quitar firmante"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSigners((p) => [...p, { name: "", email: "" }])}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              + Agregar firmante
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy ? "Creando…" : "Crear documento"}
          </button>
        </form>
      </section>

      {/* Listado */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Documentos</h2>
        {documents.length === 0 && (
          <p className="text-sm text-slate-500">Aún no hay documentos.</p>
        )}
        {documents.map((doc) => {
          const signed = doc.signers.filter((s) => s.status === "SIGNED").length;
          const total = doc.signers.length;
          return (
            <article
              key={doc.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              {/* Cabecera */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{doc.title}</h3>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_COLOR[doc.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {STATUS_LABEL[doc.status] ?? doc.status}
                    </span>
                    <span>Creado {formatDate(doc.createdAt)}</span>
                    {doc.status === "SENT" && (
                      <span>{signed}/{total} firmaron</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  {doc.status === "DRAFT" && (
                    <button
                      onClick={() => send(doc.id)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
                    >
                      Enviar
                    </button>
                  )}
                  {doc.status === "COMPLETED" && (
                    <a
                      href={`/api/documents/${doc.id}/download`}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500"
                    >
                      Descargar firmado
                    </a>
                  )}
                  {(doc.status === "DRAFT" || doc.status === "SENT") && (
                    <button
                      onClick={() => cancel(doc.id)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              {/* Firmantes */}
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {doc.signers.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-1.5">
                    <div>
                      <span className="font-medium">{s.name}</span>
                      <span className="ml-1 text-slate-400">&lt;{s.email}&gt;</span>
                    </div>
                    <div className="text-right">
                      {s.status === "SIGNED" ? (
                        <span className="text-green-600">
                          Firmó {s.signedAt ? formatDateTime(s.signedAt) : ""}
                        </span>
                      ) : (
                        <span className="text-amber-500">Pendiente</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {/* Enlaces tras enviar */}
              {links[doc.id] && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs">
                  <p className="mb-1 font-medium text-slate-600">
                    Enlaces de firma enviados por correo:
                  </p>
                  {links[doc.id].map((l) => (
                    <div key={l.url} className="truncate py-0.5">
                      <span className="font-medium">{l.name}:</span>{" "}
                      <a className="text-blue-600 underline" href={l.url}>
                        {l.url}
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {/* Hash final */}
              {doc.finalHash && (
                <p className="mt-3 break-all text-xs text-slate-400">
                  SHA-256: {doc.finalHash}
                </p>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
