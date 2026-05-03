/*
  Warnings:

  - You are about to drop the `Password` table. If the table is not empty, all the data it contains will be lost.

*/

-- AlterTable
ALTER TABLE "User" ADD COLUMN "password" TEXT;

-- Migrate password data from Password table to User table
UPDATE "User" 
SET "password" = (
  SELECT "hash" 
  FROM "Password" 
  WHERE "Password"."userId" = "User"."id"
);

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Password";
PRAGMA foreign_keys=on;
