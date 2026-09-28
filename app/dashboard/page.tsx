import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { Dashboard } from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-borde pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-ajustado">Contratos</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            Sube el PDF, marca dónde firma cada quien y comparte su enlace.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden font-mono text-xs text-tinta-tenue sm:inline">{user.email}</span>
          <LogoutButton />
        </div>
      </header>
      <main>
        <Dashboard />
      </main>
    </div>
  );
}

function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="POST">
      <button
        type="submit"
        className="rounded-md border border-borde bg-panel px-3 py-1.5 text-sm text-tinta-suave transition-colors hover:text-tinta"
      >
        Cerrar sesión
      </button>
    </form>
  );
}
