"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { FileDropzone } from "@/components/FileDropzone";

// El editor arrastra pdf.js consigo: se carga solo cuando se abre.
const PlacementEditor = dynamic(
  () => import("@/components/PlacementEditor").then((m) => m.PlacementEditor),
  { ssr: false },
);

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
  /** true cuando todos los firmantes ya tienen su recuadro de firma. */
  placementsReady: boolean;
}

interface SignerForm {
  name: string;
  email: string;
}

/** Cada estado tiene su franja: el color del canto dice en qué va el expediente. */
const ESTADO: Record<
  string,
  { etiqueta: string; franja: string; texto: string }
> = {
  DRAFT: { etiqueta: "Borrador", franja: "bg-tinta-tenue", texto: "text-tinta-suave" },
  SENT: { etiqueta: "Esperando firma", franja: "bg-estado-espera", texto: "text-estado-espera" },
  COMPLETED: { etiqueta: "Firmado", franja: "bg-estado-firmado", texto: "text-estado-firmado" },
  CANCELLED: { etiqueta: "Cancelado", franja: "bg-estado-anulado", texto: "text-tinta-tenue" },
};

const GRUPOS: { status: string; titulo: string; nota: string }[] = [
  { status: "SENT", titulo: "Esperando firma", nota: "Enviados, falta que firmen" },
  { status: "DRAFT", titulo: "Borradores", nota: "Todavía no salen" },
  { status: "COMPLETED", titulo: "Firmados", nota: "Completos, con hash de integridad" },
  { status: "CANCELLED", titulo: "Cancelados", nota: "Sus enlaces ya no sirven" },
];

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
  });
}

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Copia al portapapeles y confirma en el mismo botón. */
function Copiar({ value, label = "Copiar" }: { value: string; label?: string }) {
  const [listo, setListo] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Sin permiso de portapapeles (o sin HTTPS): respaldo manual.
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setListo(true);
    setTimeout(() => setListo(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className={`flex-shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
        listo
          ? "bg-estado-firmado/10 text-estado-firmado"
          : "text-acento hover:bg-acento/10"
      }`}
    >
      {listo ? "Copiado" : label}
    </button>
  );
}

/** Avance de firmas: una casilla por persona, rellena cuando ya firmó. */
function Casillas({ signers }: { signers: Signer[] }) {
  const firmados = signers.filter((s) => s.status === "SIGNED").length;
  const visibles = signers.slice(0, 8);

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1" aria-hidden>
        {visibles.map((s) => (
          <span
            key={s.id}
            title={`${s.name}: ${s.status === "SIGNED" ? "firmó" : "pendiente"}`}
            className={`h-3 w-3 rounded-[2px] border ${
              s.status === "SIGNED"
                ? "border-estado-firmado bg-estado-firmado"
                : "border-borde bg-panel"
            }`}
          />
        ))}
        {signers.length > visibles.length && (
          <span className="ml-0.5 text-xs text-tinta-tenue">
            +{signers.length - visibles.length}
          </span>
        )}
      </div>
      <span className="text-xs text-tinta-suave">
        {firmados} de {signers.length} {signers.length === 1 ? "firmó" : "firmaron"}
      </span>
    </div>
  );
}

export function Dashboard() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File[]>([]);
  const [annexFiles, setAnnexFiles] = useState<File[]>([]);
  const [signers, setSigners] = useState<SignerForm[]>([{ name: "", email: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [origin, setOrigin] = useState("");

  // El origen solo existe en el navegador; con él se arman los enlaces de firma.
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

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

  function signUrl(token: string) {
    return `${origin}/sign/${token}`;
  }

  async function createDocument(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (file.length === 0) {
      setError("Arrastra o elige el PDF del contrato.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file[0]);
      fd.append("title", title);
      fd.append("signers", JSON.stringify(signers));
      for (const annex of annexFiles) fd.append("annexes", annex);
      const res = await fetch("/api/documents", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear el documento.");
      setTitle("");
      setFile([]);
      setAnnexFiles([]);
      setSigners([{ name: "", email: "" }]);
      setShowForm(false);
      await load();
      // Pasa directo a colocar las firmas: sin eso no se puede enviar.
      setEditing(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo falló al crear.");
    } finally {
      setBusy(false);
    }
  }

  async function send(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/documents/${id}/send`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error ?? `No se pudo enviar (error ${res.status} del servidor).`,
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar.");
    }
  }

  async function cancel(id: string) {
    if (!confirm("¿Cancelar este documento? Los enlaces de firma dejarán de funcionar."))
      return;
    setError(null);
    try {
      const res = await fetch(`/api/documents/${id}/cancel`, { method: "POST" });
      // Un 500 puede devolver HTML, no JSON: leerlo a ciegas ocultaba el fallo.
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error ?? `No se pudo cancelar (error ${res.status} del servidor).`,
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cancelar.");
    }
  }

  // --- Filtrado y agrupación ----------------------------------------------
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: documents.length };
    for (const d of documents) c[d.status] = (c[d.status] ?? 0) + 1;
    return c;
  }, [documents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((d) => {
      if (statusFilter !== "ALL" && d.status !== statusFilter) return false;
      if (!q) return true;
      // Busca por título y por quién firma: así es como uno los recuerda.
      return (
        d.title.toLowerCase().includes(q) ||
        d.signers.some(
          (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
        )
      );
    });
  }, [documents, query, statusFilter]);

  const grupos = useMemo(
    () =>
      GRUPOS.map((g) => ({
        ...g,
        items: filtered.filter((d) => d.status === g.status),
      })).filter((g) => g.items.length > 0),
    [filtered],
  );

  const campo =
    "w-full rounded-md border border-borde bg-panel px-3 py-2 text-sm placeholder:text-tinta-tenue focus:border-acento";

  return (
    <div className="space-y-10">
      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-4 rounded-md border border-estado-espera/30 bg-estado-espera/10 px-4 py-3"
        >
          <p className="text-sm leading-relaxed text-estado-espera">{error}</p>
          <button
            onClick={() => setError(null)}
            className="flex-shrink-0 text-sm text-estado-espera/70 hover:text-estado-espera"
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {/* ---------- Crear documento ---------- */}
      <section className="overflow-hidden rounded-md border border-borde bg-panel shadow-sutil">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-4 text-left"
          aria-expanded={showForm}
        >
          <span className="text-lg font-semibold tracking-ajustado">Nuevo documento</span>
          <span className="text-sm text-tinta-suave">
            {showForm ? "Ocultar" : "Abrir"}
          </span>
        </button>

        {showForm && (
          <form onSubmit={createDocument} className="space-y-6 border-t border-borde p-6">
            <div className="max-w-xl">
              <label htmlFor="titulo" className="block text-sm font-medium">
                Título
              </label>
              <input
                id="titulo"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`mt-1.5 ${campo}`}
                placeholder="Contrato de desarrollo de software"
                required
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <FileDropzone label="Contrato (PDF)" files={file} onChange={setFile} />
              <FileDropzone
                label="Anexos"
                hint="(opcional, se agregan al final)"
                multiple
                files={annexFiles}
                onChange={setAnnexFiles}
              />
            </div>

            <div className="max-w-xl space-y-2">
              <span className="block text-sm font-medium">Firmantes</span>
              {signers.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={s.name}
                    onChange={(e) => updateSigner(i, "name", e.target.value)}
                    placeholder="Nombre"
                    className={campo}
                    required
                  />
                  <input
                    value={s.email}
                    onChange={(e) => updateSigner(i, "email", e.target.value)}
                    placeholder="correo@ejemplo.com"
                    type="email"
                    className={campo}
                    required
                  />
                  {signers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSigners((p) => p.filter((_, idx) => idx !== i))}
                      className="flex-shrink-0 rounded-md px-2 text-tinta-tenue hover:text-estado-espera"
                      aria-label={`Quitar firmante ${i + 1}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSigners((p) => [...p, { name: "", email: "" }])}
                className="text-sm font-medium text-acento hover:underline"
              >
                Agregar otro firmante
              </button>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-tinta px-5 py-2.5 text-sm font-medium text-panel transition-colors hover:bg-acento disabled:opacity-50"
            >
              {busy ? "Creando" : "Crear y colocar firmas"}
            </button>
          </form>
        )}
      </section>

      {/* ---------- Buscador y filtros ---------- */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por contrato, firmante o correo"
              className={`${campo} pr-8`}
              aria-label="Buscar documentos"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-2 rounded px-1 text-tinta-tenue hover:text-tinta"
                aria-label="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {[
              { key: "ALL", label: "Todos" },
              { key: "SENT", label: "Esperando" },
              { key: "DRAFT", label: "Borradores" },
              { key: "COMPLETED", label: "Firmados" },
              { key: "CANCELLED", label: "Cancelados" },
            ].map((f) => {
              const activo = statusFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  aria-pressed={activo}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    activo
                      ? "bg-tinta text-panel"
                      : "text-tinta-suave hover:bg-panel hover:text-tinta"
                  }`}
                >
                  {f.label}
                  <span className={activo ? "ml-1.5 text-panel/60" : "ml-1.5 text-tinta-tenue"}>
                    {counts[f.key] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {documents.length === 0 && (
          <div className="rounded-md border border-dashed border-borde py-16 text-center">
            <p className="text-lg font-semibold tracking-ajustado">Todavía no hay contratos</p>
            <p className="mt-1 text-sm text-tinta-suave">
              Sube el primero y define quién lo firma.
            </p>
          </div>
        )}

        {documents.length > 0 && filtered.length === 0 && (
          <div className="rounded-md border border-dashed border-borde py-16 text-center">
            <p className="text-sm text-tinta-suave">
              Ningún contrato coincide con «{query}».
            </p>
          </div>
        )}

        {/* ---------- Grid de expedientes ---------- */}
        {grupos.map((grupo) => (
          <div key={grupo.status} className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-2 border-b border-borde pb-2">
              <h2 className="text-sm font-semibold tracking-ajustado">{grupo.titulo}</h2>
              <span className="text-sm text-tinta-tenue">{grupo.items.length}</span>
              <span className="text-xs text-tinta-tenue">{grupo.nota}</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {grupo.items.map((doc) => {
                const estado = ESTADO[doc.status] ?? ESTADO.DRAFT;
                const pendientes = doc.signers.filter((s) => s.status !== "SIGNED");
                const expandido = abierto === doc.id;

                return (
                  <article
                    key={doc.id}
                    className="relative flex flex-col overflow-hidden rounded-md border border-borde bg-panel pl-5 shadow-sutil transition-shadow hover:shadow-alzada"
                  >
                    {/* Franja del canto: el estado, como la pestaña de un archivero. */}
                    <span
                      className={`absolute left-0 top-0 h-full w-1.5 ${estado.franja}`}
                      aria-hidden
                    />

                    <div className="flex flex-1 flex-col p-4 pl-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`text-xs font-medium ${estado.texto}`}>
                          {estado.etiqueta}
                        </span>
                        <span className="text-xs text-tinta-tenue">
                          {fecha(doc.createdAt)}
                        </span>
                      </div>

                      <h3 className="mt-1.5 text-[17px] font-semibold leading-snug tracking-ajustado">
                        {doc.title}
                      </h3>

                      <div className="mt-3">
                        <Casillas signers={doc.signers} />
                      </div>

                      {doc.status === "DRAFT" && !doc.placementsReady && (
                        <p className="mt-3 text-xs leading-relaxed text-estado-espera">
                          Falta marcar dónde firma cada quien.
                        </p>
                      )}

                      {/* Firmantes y enlaces — se despliegan para no saturar la tarjeta. */}
                      <button
                        onClick={() => setAbierto(expandido ? null : doc.id)}
                        className="mt-3 self-start text-xs text-tinta-suave hover:text-acento"
                        aria-expanded={expandido}
                      >
                        {expandido ? "Ocultar firmantes" : `Ver ${doc.signers.length} firmante${doc.signers.length === 1 ? "" : "s"}`}
                      </button>

                      {expandido && (
                        <ul className="mt-2 space-y-2 border-t border-borde pt-2">
                          {doc.signers.map((s) => (
                            <li key={s.id} className="text-sm">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="min-w-0 truncate font-medium">
                                  {s.name}
                                </span>
                                <span
                                  className={`flex-shrink-0 text-xs ${
                                    s.status === "SIGNED"
                                      ? "text-estado-firmado"
                                      : "text-estado-espera"
                                  }`}
                                >
                                  {s.status === "SIGNED" && s.signedAt
                                    ? fechaHora(s.signedAt)
                                    : s.status === "SIGNED"
                                      ? "Firmó"
                                      : "Pendiente"}
                                </span>
                              </div>
                              <p className="truncate text-xs text-tinta-tenue">{s.email}</p>

                              {/* El enlace sigue a la mano aunque el correo se haya perdido. */}
                              {doc.status === "SENT" && s.status !== "SIGNED" && origin && (
                                <div className="mt-1 flex items-center gap-1">
                                  <code className="min-w-0 flex-1 truncate rounded-md border border-borde bg-lienzo px-2 py-1 font-mono text-xs text-tinta-suave">
                                    /sign/{s.signToken.slice(0, 10)}…
                                  </code>
                                  <Copiar value={signUrl(s.signToken)} label="Copiar" />
                                  <a
                                    href={signUrl(s.signToken)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex-shrink-0 rounded-md px-2 py-1 text-xs font-medium text-acento hover:bg-acento/10"
                                  >
                                    Abrir
                                  </a>
                                </div>
                              )}
                            </li>
                          ))}

                          {doc.status === "SENT" && pendientes.length > 1 && origin && (
                            <li>
                              <Copiar
                                label={`Copiar los ${pendientes.length} enlaces`}
                                value={pendientes
                                  .map((s) => `${s.name}: ${signUrl(s.signToken)}`)
                                  .join("\n")}
                              />
                            </li>
                          )}

                          {doc.finalHash && (
                            <li className="break-all font-mono text-[11px] leading-relaxed text-tinta-tenue">
                              SHA-256 {doc.finalHash.slice(0, 32)}…
                            </li>
                          )}
                        </ul>
                      )}

                      {/* Acciones, siempre al pie de la hoja. */}
                      <div className="mt-auto flex flex-wrap gap-2 pt-4">
                        {doc.status === "DRAFT" && (
                          <>
                            <button
                              onClick={() => setEditing(doc.id)}
                              className="rounded-md border border-borde px-3 py-1.5 text-sm font-medium transition-colors hover:border-acento hover:text-acento"
                            >
                              {doc.placementsReady ? "Editar firmas" : "Colocar firmas"}
                            </button>
                            <button
                              onClick={() => send(doc.id)}
                              disabled={!doc.placementsReady}
                              title={
                                doc.placementsReady
                                  ? undefined
                                  : "Primero marca dónde firma cada persona."
                              }
                              className="rounded-md bg-tinta px-3 py-1.5 text-sm font-medium text-panel transition-colors hover:bg-acento disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              Enviar
                            </button>
                          </>
                        )}
                        {doc.status === "COMPLETED" && (
                          <a
                            href={`/api/documents/${doc.id}/download`}
                            className="rounded-md bg-estado-firmado px-3 py-1.5 text-sm font-medium text-panel transition-opacity hover:opacity-90"
                          >
                            Descargar firmado
                          </a>
                        )}
                        {(doc.status === "DRAFT" || doc.status === "SENT") && (
                          <button
                            onClick={() => cancel(doc.id)}
                            className="rounded-md px-3 py-1.5 text-sm text-tinta-suave transition-colors hover:text-estado-espera"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {editing && (
        <PlacementEditor
          documentId={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}
