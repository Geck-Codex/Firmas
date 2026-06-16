import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Firma Digital — Firma electrónica simple",
  description:
    "Plataforma de firma manuscrita digital con rastro de evidencia (firma electrónica simple, art. 89 Cód. Comercio).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
