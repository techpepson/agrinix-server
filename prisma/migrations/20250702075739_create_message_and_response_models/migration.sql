/*
  Warnings:

  - Added the required column `authorId` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `messageBody` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `messageTitle` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `messageUpdatedAt` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `notificationBody` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `notificationTitle` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `notificationType` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `notificationUpdatedAt` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `responseAuthorId` to the `Response` table without a default value. This is not possible if the table is not empty.
  - Added the required column `responseBody` to the `Response` table without a default value. This is not possible if the table is not empty.
  - Added the required column `responseUpdatedAt` to the `Response` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "authorId" INTEGER NOT NULL,
ADD COLUMN     "messageBody" TEXT NOT NULL,
ADD COLUMN     "messageCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "messageDislikes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "messageImage" TEXT,
ADD COLUMN     "messageLikes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "messageLink" TEXT,
ADD COLUMN     "messageRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "messageTitle" TEXT NOT NULL,
ADD COLUMN     "messageUpdatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "notificationBody" TEXT NOT NULL,
ADD COLUMN     "notificationCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "notificationImage" TEXT,
ADD COLUMN     "notificationLink" TEXT,
ADD COLUMN     "notificationRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notificationTitle" TEXT NOT NULL,
ADD COLUMN     "notificationType" TEXT NOT NULL,
ADD COLUMN     "notificationUpdatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "Response" ADD COLUMN     "messageId" INTEGER,
ADD COLUMN     "responseAuthorId" INTEGER NOT NULL,
ADD COLUMN     "responseBody" TEXT NOT NULL,
ADD COLUMN     "responseCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "responseDislikes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "responseLikes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "responseUpdatedAt" TIMESTAMP(3) NOT NULL;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_responseAuthorId_fkey" FOREIGN KEY ("responseAuthorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
