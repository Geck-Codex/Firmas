import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Firma Digital</h1>
      <p className="mt-4 text-lg text-slate-600">
        Sube un documento, invita a los firmantes y firma con el dedo o lápiz
        óptico. Firma electrónica simple con rastro de evidencia.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-block rounded-lg bg-slate-900 px-6 py-3 font-medium text-white hover:bg-slate-700"
      >
        Ir al panel
      </Link>
      <p className="mt-10 text-xs text-slate-400">
        Firma electrónica simple (art. 89 Cód. Comercio). No es e.firma del SAT
        ni constancia NOM-151.
      </p>
    </main>
  );
}
