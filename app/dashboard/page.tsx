import { Dashboard } from "./Dashboard";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Panel del emisor</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sube un PDF, define los firmantes y comparte sus enlaces de firma.
        </p>
      </header>
      <Dashboard />
    </main>
  );
}
