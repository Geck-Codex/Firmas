"use client";

import { useRef, useState } from "react";

/**
 * Zona para soltar o elegir PDFs.
 *
 * Acepta arrastrar desde el explorador o hacer clic para abrir el selector
 * de siempre. Filtra lo que no sea PDF antes de entregarlo.
 */
export function FileDropzone({
  label,
  hint,
  multiple = false,
  files,
  onChange,
}: {
  label: string;
  hint?: string;
  multiple?: boolean;
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const [over, setOver] = useState(false);
  const [rejected, setRejected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function accept(list: FileList | null) {
    if (!list) return;
    const all = Array.from(list);
    const pdfs = all.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    setRejected(all.length - pdfs.length);
    onChange(multiple ? [...files, ...pdfs] : pdfs.slice(0, 1));
  }

  function remove(index: number) {
    onChange(files.filter((_, i) => i !== index));
    setRejected(0);
    // Permite volver a elegir el mismo archivo recién quitado.
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <label className="block text-sm font-medium">
        {label}
        {hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}
      </label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          accept(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        className={`mt-1 cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center transition ${
          over
            ? "border-blue-500 bg-blue-50"
            : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100"
        }`}
      >
        <p className="text-sm text-slate-600">
          {over ? (
            <span className="font-medium text-blue-700">Suelta aquí</span>
          ) : (
            <>
              Arrastra {multiple ? "los PDF" : "el PDF"} aquí o{" "}
              <span className="font-medium text-blue-600 underline">búscalo</span>
            </>
          )}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple={multiple}
          onChange={(e) => accept(e.target.files)}
          className="hidden"
        />
      </div>

      {rejected > 0 && (
        <p className="mt-1 text-xs text-amber-600">
          Se ignoraron {rejected} archivo(s) que no eran PDF.
        </p>
      )}

      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">
                📄 {f.name}
                <span className="ml-2 text-xs text-slate-400">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(i);
                }}
                className="flex-shrink-0 rounded px-1.5 text-slate-400 hover:text-red-600"
                aria-label={`Quitar ${f.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
