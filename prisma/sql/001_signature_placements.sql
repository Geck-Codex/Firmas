-- CreateTable
CREATE TABLE "SignaturePlacement" (
    "id" TEXT NOT NULL,
    "signerId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SIGNATURE',

    CONSTRAINT "SignaturePlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignaturePlacement_signerId_idx" ON "SignaturePlacement"("signerId");

-- AddForeignKey
ALTER TABLE "SignaturePlacement" ADD CONSTRAINT "SignaturePlacement_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "Signer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
