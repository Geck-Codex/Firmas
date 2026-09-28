import { copyFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// pdf.js carga su worker como archivo suelto, no como import del bundle.
// Lo copiamos a /public en cada install para que SIEMPRE coincida con la
// versión instalada de pdfjs-dist: un worker desfasado rompe el visor.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const to = join(root, "public", "pdf.worker.min.mjs");

try {
  mkdirSync(join(root, "public"), { recursive: true });
  copyFileSync(from, to);
  console.log("[pdf-worker] copiado a public/pdf.worker.min.mjs");
} catch (err) {
  console.error("[pdf-worker] no se pudo copiar:", err.message);
  process.exit(1);
}
