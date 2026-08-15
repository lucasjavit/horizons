-- CreateTable
CREATE TABLE "job_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cvProfile" JSONB,
    "filtros" JSONB NOT NULL,
    "grupo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_profiles_userId_key" ON "job_profiles"("userId");

-- CreateIndex
CREATE INDEX "job_profiles_ativo_grupo_idx" ON "job_profiles"("ativo", "grupo");

-- AddForeignKey
ALTER TABLE "job_profiles" ADD CONSTRAINT "job_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
