-- CreateTable
CREATE TABLE "ResponseDraft" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "history" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponseDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResponseDraft_formId_idx" ON "ResponseDraft"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseDraft_formId_ownerKey_key" ON "ResponseDraft"("formId", "ownerKey");

-- AddForeignKey
ALTER TABLE "ResponseDraft" ADD CONSTRAINT "ResponseDraft_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
