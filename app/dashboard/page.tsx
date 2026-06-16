import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { Dashboard } from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel del emisor</h1>
          <p className="mt-1 text-sm text-slate-600">
            Sube un PDF, define los firmantes y comparte sus enlaces de firma.
          </p>
        </div>
        <LogoutButton />
      </header>
      <Dashboard />
    </main>
  );
}

function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="POST">
      <button
        type="submit"
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
      >
        Cerrar sesión
      </button>
    </form>
  );
}
