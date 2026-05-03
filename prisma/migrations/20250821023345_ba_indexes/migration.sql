-- DropIndex
DROP INDEX "Session_userId_idx";

-- CreateIndex
CREATE INDEX "Session_userId_token_idx" ON "Session"("userId", "token");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");
