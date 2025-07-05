/*
  Warnings:

  - You are about to alter the column `accuracy` on the `Disease` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `diseasePredictionConfidence` on the `Disease` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.

*/
-- AlterTable
ALTER TABLE "Disease" ALTER COLUMN "accuracy" SET DATA TYPE INTEGER,
ALTER COLUMN "diseasePredictionConfidence" SET DATA TYPE INTEGER;
