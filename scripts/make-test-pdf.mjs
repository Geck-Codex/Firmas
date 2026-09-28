import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFileSync } from "fs";

// Genera un contrato de prueba con renglones de firma reales en la última
// página, para comprobar que la firma aterriza sobre el renglón y no al pie.

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);

const W = 612;
const H = 792;
const M = 72; // margen

function page() {
  return doc.addPage([W, H]);
}

function text(p, str, { x = M, y, size = 11, f = font, color = rgb(0.1, 0.1, 0.1) }) {
  p.drawText(str, { x, y, size, font: f, color });
}

const CLAUSULAS = [
  "PRIMERA. OBJETO. El PRESTADOR se obliga a desarrollar para el CLIENTE la",
  "plataforma informatica descrita en el Anexo A, conforme a las especificaciones",
  "tecnicas acordadas entre las partes.",
  "",
  "SEGUNDA. CONTRAPRESTACION. El CLIENTE pagara la cantidad pactada en tres",
  "exhibiciones: 40% a la firma del presente, 30% a la entrega del primer",
  "modulo funcional y 30% contra entrega final.",
  "",
  "TERCERA. PLAZO. El desarrollo se entregara en un plazo de noventa dias",
  "naturales contados a partir de la fecha de firma de este instrumento.",
  "",
  "CUARTA. PROPIEDAD INTELECTUAL. El codigo fuente sera propiedad del CLIENTE",
  "una vez liquidado el total de la contraprestacion pactada.",
  "",
  "QUINTA. CONFIDENCIALIDAD. Las partes se obligan a guardar reserva sobre la",
  "informacion tecnica y comercial a la que tengan acceso.",
];

// --- Página 1: portada + primeras cláusulas ---
const p1 = page();
text(p1, "CONTRATO DE PRESTACION DE SERVICIOS", { y: H - M, size: 16, f: bold });
text(p1, "DE DESARROLLO DE SOFTWARE", { y: H - M - 22, size: 16, f: bold });
text(p1, "Que celebran, por una parte, GECK CODEX como PRESTADOR, y por la otra,", {
  y: H - M - 60,
});
text(p1, "el CLIENTE, al tenor de las siguientes clausulas:", { y: H - M - 76 });

let y = H - M - 120;
for (const line of CLAUSULAS) {
  text(p1, line, { y });
  y -= 16;
}

// --- Página 2: relleno, para que la firma no quede en la página 1 ---
const p2 = page();
text(p2, "ANEXO A. ESPECIFICACIONES TECNICAS", { y: H - M, size: 13, f: bold });
y = H - M - 40;
for (let i = 1; i <= 18; i++) {
  text(p2, `${i}. Requerimiento funcional numero ${i} del sistema contratado.`, { y });
  y -= 18;
}

// --- Página 3: la hoja de firmas (el caso real) ---
const p3 = page();
text(p3, "SEXTA. JURISDICCION. Para la interpretacion y cumplimiento del presente", {
  y: H - M,
});
text(p3, "contrato, las partes se someten a los tribunales de la ciudad convenida.", {
  y: H - M - 16,
});
text(p3, "Leido que fue el presente y enteradas las partes de su contenido y alcance", {
  y: H - M - 48,
});
text(p3, "legal, lo firman de conformidad:", { y: H - M - 64 });

// Dos renglones de firma, lado a lado — a media página, NO al pie.
const lineY = 420;
const leftX = M;
const rightX = W / 2 + 20;
const lineW = 180;

for (const [x, rol, nombre] of [
  [leftX, "EL PRESTADOR", "GECK Codex"],
  [rightX, "EL CLIENTE", "Nombre y firma"],
]) {
  p3.drawLine({
    start: { x, y: lineY },
    end: { x: x + lineW, y: lineY },
    thickness: 1,
    color: rgb(0.2, 0.2, 0.2),
  });
  text(p3, rol, { x, y: lineY - 16, size: 9, f: bold });
  text(p3, nombre, { x, y: lineY - 30, size: 9 });
}

text(p3, "Fecha: ____ / ____ / ________", { y: lineY - 90, size: 10 });

const bytes = await doc.save();
const out = process.argv[2] ?? "contrato-prueba.pdf";
writeFileSync(out, bytes);
console.log(`PDF de prueba creado: ${out} (${doc.getPageCount()} paginas)`);
console.log(`Renglones de firma en la pagina 3, a y=${lineY} de ${H} (media hoja).`);
