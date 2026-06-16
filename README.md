# Firma Digital

Plataforma de **firma manuscrita digital** con rastro de evidencia. Un emisor sube
un PDF, invita a firmantes y cada uno firma con el dedo/lápiz sobre la pantalla. La
firma se incrusta en el PDF y se guarda con evidencia (quién, cuándo, IP, user-agent)
y un hash SHA-256 de integridad.

> Firma electrónica **simple** (art. 89 del Código de Comercio mexicano). No es la
> e.firma del SAT ni emite constancia NOM-151. Ver `Claude.md` (alcance legal).

## Stack

Next.js (App Router) · TypeScript · Tailwind · Prisma + **Postgres (Supabase)** ·
**Supabase Storage** (S3-compatible) · signature_pad · pdf-lib · Zod · nanoid.

## Puesta en marcha (Supabase)

1. Crea un proyecto en https://supabase.com (gratis).
2. **Connection string**: Project Settings → Database → *Connection string* →
   pestaña **URI**. Copia la versión del **Connection Pooler** (puerto `6543`)
   a `DATABASE_URL` y la **directa** (puerto `5432`) a `DIRECT_URL`.
3. **Storage**: Storage → *New bucket* → nombre `firmas`, **privado**.
4. **Service key**: Project Settings → API → copia `Project URL` a `SUPABASE_URL`
   y la `service_role` key a `SUPABASE_SERVICE_ROLE_KEY` (¡secreta, solo servidor!).
5. Rellena `.env` con esos valores y ejecuta:

```bash
npm install
npx prisma migrate dev --name init   # crea las tablas en Supabase
npm run dev                          # http://localhost:3000
```

> Para desarrollo offline puedes poner `STORAGE_DRIVER=local` (archivos en disco),
> pero la BD siempre es Postgres.

## Flujo

1. **/dashboard** — sube un PDF, define firmantes → estado `DRAFT`.
2. **Enviar** — genera un enlace único `/sign/{token}` por firmante → `SENT`.
3. **/sign/{token}** — el firmante ve el PDF, dibuja su firma y acepta.
4. Al firmar todos, se genera el PDF final, se calcula su SHA-256 → `COMPLETED`.
5. **Descargar firmado** desde el panel.

## Estructura

- `app/api` — rutas (orquestan; sin lógica de PDF/evidencia).
- `lib` — `pdf.ts`, `signature.ts`, `evidence.ts`, `storage.ts`, `db.ts`, `validation.ts`.
- `components` — `SignaturePad.tsx`, `PdfViewer.tsx`.
- `prisma/schema.prisma` — modelo de datos.
- `storage/` — archivos en disco (dev).

## Comandos

```bash
npm run dev          # desarrollo
npm run build        # build de producción
npm run start        # producción
npx prisma migrate dev
npx prisma studio
npm run lint
```
