Plataforma de Firma Manuscrita Digital

Guía para trabajar en este repositorio. Léela antes de escribir código.

1. Qué es este proyecto

Una aplicación web donde un emisor sube un documento (PDF), invita a uno o varios
firmantes, y cada firmante firma con el dedo o lápiz óptico sobre la pantalla
(firma manuscrita digital). La firma se incrusta en el PDF y la plataforma guarda
el documento firmado junto con un rastro de evidencia (quién, cuándo, desde dónde,
y un hash de integridad).

Caso de uso original: firmar contratos de desarrollo de software entre un proveedor
y sus clientes, sin tener que imprimir ni juntarse físicamente.

2. Alcance legal (LEER — define qué construimos y qué NO)

Esta plataforma implementa firma electrónica simple en términos del
artículo 89 del Código de Comercio mexicano: datos en forma electrónica que el
firmante usa para manifestar su consentimiento, con elementos que permiten
atribuírsela (nombre, correo, hora, IP) y verificar la integridad del
documento (hash).

Lo que esta plataforma NO hace (por ahora):


NO usa la e.firma del SAT (firma electrónica avanzada, art. 97). Eso requiere
manejar certificados X.509 y validación contra el SAT. Queda en el roadmap.
NO emite constancia NOM-151 de conservación. Esa constancia solo la puede
emitir un PSC (Prestador de Servicios de Certificación) acreditado, vía su API.
Queda en el roadmap como integración externa.


Implicación: la firma manuscrita digital es válida pero es la modalidad más débil
ante un repudio ("yo no firmé"). El valor probatorio se refuerza con el rastro de
evidencia y el hash. No exagerar las afirmaciones legales en la UI: di "firma
electrónica simple con rastro de evidencia", no "firma con validez NOM-151".

3. Stack tecnológico


Next.js (App Router) + TypeScript — full-stack (UI + API routes).
Tailwind CSS — estilos.
signature_pad — captura de firma manuscrita en <canvas> (con el dedo/stylus).
pdf-lib — incrustar la imagen de la firma en el PDF.
Prisma + SQLite en desarrollo; PostgreSQL en producción.
Almacenamiento de archivos: disco local en dev; S3-compatible (R2/S3) en prod.
crypto nativo de Node — hash SHA-256 del PDF final.
Zod — validación de entradas.
nanoid — IDs y tokens de enlaces de firma.


No agregues dependencias pesadas sin justificarlo. Mantén el proyecto simple.

4. Modelo de datos (Prisma)

Document
  id            String   @id
  title         String
  originalPath  String   // PDF subido
  signedPath    String?  // PDF final firmado
  status        String   // DRAFT | SENT | COMPLETED | CANCELLED
  finalHash     String?  // SHA-256 del PDF firmado
  createdAt     DateTime
  signers       Signer[]

Signer
  id            String   @id
  documentId    String
  name          String
  email         String
  order         Int      // orden de firma (opcional)
  status        String   // PENDING | SIGNED
  signToken     String   @unique  // enlace único de firma
  signatureImg  String?  // PNG base64 o ruta del trazo
  signedAt      DateTime?
  evidence      Json?    // ver sección 6
  document      Document @relation(...)

5. Flujos principales


Crear documento: el emisor sube un PDF y define los firmantes (nombre + correo).
Estado DRAFT.
Enviar: se genera un signToken por firmante y un enlace único
/sign/{signToken}. Estado SENT. (Envío de correo: opcional al inicio; puedes
solo mostrar/copiar el enlace.)
Firmar: el firmante abre su enlace, ve el PDF, dibuja su firma en el canvas
(signature_pad), confirma, y se registra su evidencia.
Incrustar: cuando un firmante firma, se renderiza su firma (PNG) en la posición
acordada del PDF con pdf-lib.
Finalizar: cuando todos firmaron, se genera el PDF final, se calcula su
SHA-256, se guarda en finalHash y el documento pasa a COMPLETED.
Descargar: el emisor descarga el PDF firmado + un resumen de evidencia.


6. Rastro de evidencia (capturar SIEMPRE al firmar)

Guardar en Signer.evidence:


signedAt (timestamp del servidor, no del cliente).
ip (de la request).
userAgent.
documentHashAtSigning (hash del PDF en el momento de firmar).
Opcional: geolocalización aproximada por IP, y confirmación explícita de
consentimiento ("Acepto firmar este documento", checkbox marcado).


Este rastro es lo que da fuerza probatoria a una firma simple. No lo omitas.

7. Estructura del proyecto

/app
  /api
    /documents        # crear, listar, finalizar
    /sign/[token]     # obtener doc para firmar, enviar firma
  /sign/[token]       # página pública de firma (canvas)
  /dashboard          # panel del emisor
/lib
  pdf.ts              # incrustar firma, hashear PDF (pdf-lib + crypto)
  signature.ts        # utilidades de signature_pad → PNG
  evidence.ts         # construir el objeto de evidencia
  db.ts               # cliente Prisma
/prisma
  schema.prisma
/components
  SignaturePad.tsx    # wrapper de signature_pad
  PdfViewer.tsx

8. Comandos

bashnpm run dev          # desarrollo
npm run build        # build de producción
npm run start        # producción
npx prisma migrate dev   # migraciones
npx prisma studio        # inspeccionar la BD
npm run lint

9. Convenciones de código


TypeScript estricto. Nada de any salvo justificación.
Validar TODA entrada de API con Zod antes de tocar la BD.
Lógica de PDF y de evidencia vive en /lib, no dentro de los componentes ni de las
rutas. Las rutas solo orquestan.
Componentes de UI pequeños y enfocados.
Mensajes y textos de cara al usuario en español.


10. Requisitos de seguridad (no negociables)


HTTPS obligatorio en producción.
Los signToken son aleatorios (nanoid, mínimo 21 chars) y de un solo uso por estado;
no exponer IDs internos en las URLs públicas.
El hash del PDF se calcula en el servidor, nunca confiar en el cliente.
Nunca registrar el PDF completo ni datos personales en logs.
Validar que un firmante solo pueda firmar su propio documento (token → signer).
Tras COMPLETED, el PDF firmado es inmutable; cualquier cambio invalida el hash.
Sanitizar el PDF subido (verificar que sea PDF real, límite de tamaño).


11. Variables de entorno

DATABASE_URL=
STORAGE_DRIVER=local|s3
S3_BUCKET=
S3_REGION=
S3_ACCESS_KEY=
S3_SECRET_KEY=
APP_URL=            # para construir los enlaces de firma

12. Roadmap (no implementar salvo que se pida)


Integración con PSC vía API para emitir constancia NOM-151 (fecha cierta).
Soporte de e.firma del SAT (firma avanzada, art. 97): carga de .cer/.key del lado
del cliente, firma PAdES, validación de certificado.
Envío de correos transaccionales y recordatorios.
Verificación de identidad del firmante (SMS/biométrico).


13. Qué NO hacer


No afirmar en la UI ni en el código que la firma cumple NOM-151 o que es e.firma:
todavía no lo es.
No guardar llaves privadas ni contraseñas de firmantes (no aplican en firma simple).
No procesar el hash ni la firma del lado del cliente como fuente de verdad.
No agregar pasarelas de pago, e-commerce ni features fuera del flujo de firma.
No introducir librerías nuevas sin necesidad clara