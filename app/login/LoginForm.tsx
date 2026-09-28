"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/dashboard");
      router.refresh();
    } catch (e: unknown) {
      // El mensaje de Supabase viene en inglés; aquí se dice qué hacer.
      setError(
        e instanceof Error && e.message.includes("Invalid login")
          ? "Ese correo y contraseña no coinciden. Revísalos e intenta otra vez."
          : e instanceof Error
            ? e.message
            : "No se pudo entrar. Intenta de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

  const campo =
    "mt-1.5 w-full rounded-md border border-borde2 bg-panel px-3 py-2 text-sm placeholder:text-tinta-tenue focus:border-acento";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="correo" className="block text-sm font-medium">
          Correo
        </label>
        <input
          id="correo"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          autoFocus
          placeholder="tu@correo.com"
          className={`${campo} font-mono`}
        />
      </div>

      <div>
        <label htmlFor="clave" className="block text-sm font-medium">
          Contraseña
        </label>
        <input
          id="clave"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className={campo}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md bg-estado-espera/10 px-3 py-2 text-sm leading-relaxed text-estado-espera"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-tinta px-5 py-2.5 text-sm font-medium text-panel transition-colors hover:bg-acento disabled:opacity-50"
      >
        {busy ? "Entrando" : "Entrar"}
      </button>
    </form>
  );
}
