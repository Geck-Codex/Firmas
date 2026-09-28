import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-[380px]">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold tracking-ajustado">Firma Digital</h1>
          <p className="mt-1.5 text-sm text-tinta-suave">
            Panel interno. Entra para gestionar contratos y enlaces de firma.
          </p>
        </div>

        <div className="rounded-lg border border-borde bg-panel p-6 shadow-sutil">
          <LoginForm />
        </div>

        <p className="mt-5 font-mono text-[11px] leading-relaxed text-tinta-tenue">
          Firma electrónica simple, art. 89 del Código de Comercio
        </p>
      </div>
    </main>
  );
}
