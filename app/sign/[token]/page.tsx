import { SignForm } from "./SignForm";

export const dynamic = "force-dynamic";

export default function SignPage({ params }: { params: { token: string } }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <SignForm token={params.token} />
      <p className="mt-8 text-center text-xs text-slate-400">
        Firma electrónica simple con rastro de evidencia (art. 89 Cód. Comercio).
      </p>
    </main>
  );
}
