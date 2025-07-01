/*
  Warnings:

  - Added the required column `diseaseId` to the `Crop` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Crop` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Crop` table without a default value. This is not possible if the table is not empty.
  - Added the required column `accuracy` to the `Disease` table without a default value. This is not possible if the table is not empty.
  - Added the required column `diseaseClass` to the `Disease` table without a default value. This is not possible if the table is not empty.
  - Added the required column `diseaseDescription` to the `Disease` table without a default value. This is not possible if the table is not empty.
  - Added the required column `diseasePredictionConfidence` to the `Disease` table without a default value. This is not possible if the table is not empty.
  - Added the required column `diseaseTop` to the `Disease` table without a default value. This is not possible if the table is not empty.
  - Added the required column `inferenceId` to the `Disease` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Disease` table without a default value. This is not possible if the table is not empty.
  - Added the required column `imageHeight` to the `Image` table without a default value. This is not possible if the table is not empty.
  - Added the required column `imageWidth` to the `Image` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Image` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Crop" ADD COLUMN     "diseaseId" INTEGER NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "userId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Disease" ADD COLUMN     "accuracy" INTEGER NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "diseaseCauses" TEXT[],
ADD COLUMN     "diseaseClass" TEXT NOT NULL,
ADD COLUMN     "diseaseDescription" TEXT NOT NULL,
ADD COLUMN     "diseasePredictionConfidence" INTEGER NOT NULL,
ADD COLUMN     "diseasePrevention" TEXT[],
ADD COLUMN     "diseaseSymptoms" TEXT[],
ADD COLUMN     "diseaseTop" TEXT NOT NULL,
ADD COLUMN     "inferenceId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Image" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "diseaseId" INTEGER,
ADD COLUMN     "imageHeight" INTEGER NOT NULL,
ADD COLUMN     "imageUrl" TEXT[],
ADD COLUMN     "imageWidth" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "Likes" (
    "id" INTEGER NOT NULL,

    CONSTRAINT "Likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Journal" (
    "id" INTEGER NOT NULL,

    CONSTRAINT "Journal_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Crop" ADD CONSTRAINT "Crop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crop" ADD CONSTRAINT "Crop_diseaseId_fkey" FOREIGN KEY ("diseaseId") REFERENCES "Disease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_diseaseId_fkey" FOREIGN KEY ("diseaseId") REFERENCES "Disease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
