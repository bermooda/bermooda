-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "netTermsDays" INTEGER NOT NULL DEFAULT 30,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CompanyMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'buyer',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanyMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanyMember_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteNumber" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "notes" TEXT,
    "orderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "titleSnapshot" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "addressJson" TEXT,
    "allowsPickup" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Location" ("active", "addressJson", "code", "createdAt", "id", "isDefault", "name", "updatedAt") SELECT "active", "addressJson", "code", "createdAt", "id", "isDefault", "name", "updatedAt" FROM "Location";
DROP TABLE "Location";
ALTER TABLE "new_Location" RENAME TO "Location";
CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "salesChannelId" TEXT,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currency" TEXT NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "shippingCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "storeCreditCents" INTEGER NOT NULL DEFAULT 0,
    "giftCardCents" INTEGER NOT NULL DEFAULT 0,
    "loyaltyPointsCents" INTEGER NOT NULL DEFAULT 0,
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
    "pickupLocationId" TEXT,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("billingAddressJson", "couponCode", "createdAt", "currency", "customerId", "discountCents", "email", "giftCardCents", "id", "loyaltyPointsCents", "notes", "orderNumber", "paymentIntentId", "paymentProvider", "salesChannelId", "shippingAddressJson", "shippingCents", "status", "storeCreditCents", "subtotalCents", "taxCents", "taxExempt", "totalCents", "updatedAt", "vatId") SELECT "billingAddressJson", "couponCode", "createdAt", "currency", "customerId", "discountCents", "email", "giftCardCents", "id", "loyaltyPointsCents", "notes", "orderNumber", "paymentIntentId", "paymentProvider", "salesChannelId", "shippingAddressJson", "shippingCents", "status", "storeCreditCents", "subtotalCents", "taxCents", "taxExempt", "totalCents", "updatedAt", "vatId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX "Order_pickupLocationId_idx" ON "Order"("pickupLocationId");
CREATE INDEX "Order_salesChannelId_idx" ON "Order"("salesChannelId");
CREATE INDEX "Order_orderNumber_idx" ON "Order"("orderNumber");
CREATE INDEX "Order_status_idx" ON "Order"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "Company"("name");

-- CreateIndex
CREATE INDEX "CompanyMember_customerId_idx" ON "CompanyMember"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMember_companyId_customerId_key" ON "CompanyMember"("companyId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_orderId_key" ON "Quote"("orderId");

-- CreateIndex
CREATE INDEX "Quote_companyId_idx" ON "Quote"("companyId");

-- CreateIndex
CREATE INDEX "Quote_customerId_idx" ON "Quote"("customerId");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

-- CreateIndex
CREATE INDEX "QuoteLine_quoteId_idx" ON "QuoteLine"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteLine_variantId_idx" ON "QuoteLine"("variantId");
