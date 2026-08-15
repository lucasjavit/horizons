-- AlterTable
ALTER TABLE "found_jobs" ADD COLUMN     "anosExp" INTEGER,
ADD COLUMN     "area" TEXT,
ADD COLUMN     "benefits" TEXT[],
ADD COLUMN     "degree" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "paisIso" TEXT;
