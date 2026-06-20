-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currency" TEXT NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "shippingCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "storeCreditCents" INTEGER NOT NULL DEFAULT 0,
    "giftCardCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "shippingAddressJson" TEXT NOT NULL,
    "billingAddressJson" TEXT,
    "paymentProvider" TEXT,
    "paymentIntentId" TEXT,
    "couponCode" TEXT,
    "vatId" TEXT,
    "taxExempt" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("billingAddressJson", "couponCode", "createdAt", "currency", "customerId", "discountCents", "email", "id", "notes", "orderNumber", "paymentIntentId", "paymentProvider", "shippingAddressJson", "shippingCents", "status", "subtotalCents", "taxCents", "taxExempt", "totalCents", "updatedAt", "vatId") SELECT "billingAddressJson", "couponCode", "createdAt", "currency", "customerId", "discountCents", "email", "id", "notes", "orderNumber", "paymentIntentId", "paymentProvider", "shippingAddressJson", "shippingCents", "status", "subtotalCents", "taxCents", "taxExempt", "totalCents", "updatedAt", "vatId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX "Order_orderNumber_idx" ON "Order"("orderNumber");
CREATE INDEX "Order_status_idx" ON "Order"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
