-- CreateTable
CREATE TABLE "FormAsset" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormAsset_formId_idx" ON "FormAsset"("formId");

-- AddForeignKey
ALTER TABLE "FormAsset" ADD CONSTRAINT "FormAsset_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
