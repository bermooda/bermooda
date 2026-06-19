-- CreateTable
CREATE TABLE "TaxClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "rate" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CartDiscount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cartId" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "code" TEXT,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CartDiscount_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CartDiscount_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderDiscount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "code" TEXT,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderDiscount_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderDiscount_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CheckoutSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cartId" TEXT NOT NULL,
    "customerId" TEXT,
    "email" TEXT,
    "step" TEXT NOT NULL DEFAULT 'address',
    "shippingAddressJson" TEXT,
    "billingAddressJson" TEXT,
    "shippingOptionJson" TEXT,
    "paymentIntentId" TEXT,
    "paymentProvider" TEXT,
    "couponCode" TEXT,
    "vatId" TEXT,
    "taxExempt" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CheckoutSession_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CheckoutSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CheckoutSession" ("billingAddressJson", "cartId", "couponCode", "createdAt", "customerId", "email", "expiresAt", "id", "paymentIntentId", "paymentProvider", "shippingAddressJson", "shippingOptionJson", "step", "updatedAt") SELECT "billingAddressJson", "cartId", "couponCode", "createdAt", "customerId", "email", "expiresAt", "id", "paymentIntentId", "paymentProvider", "shippingAddressJson", "shippingOptionJson", "step", "updatedAt" FROM "CheckoutSession";
DROP TABLE "CheckoutSession";
ALTER TABLE "new_CheckoutSession" RENAME TO "CheckoutSession";
CREATE INDEX "CheckoutSession_cartId_idx" ON "CheckoutSession"("cartId");
CREATE INDEX "CheckoutSession_customerId_idx" ON "CheckoutSession"("customerId");
CREATE TABLE "new_Discount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "appliesTo" TEXT NOT NULL DEFAULT 'order',
    "minSubtotalCents" INTEGER,
    "minQuantity" INTEGER,
    "maxUsesCount" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT,
    "startsAt" DATETIME,
    "expiresAt" DATETIME,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "customerGroupId" TEXT,
    "rulesJson" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Discount" ("active", "code", "createdAt", "currency", "expiresAt", "id", "maxUsesCount", "minSubtotalCents", "type", "updatedAt", "usedCount", "value") SELECT "active", "code", "createdAt", "currency", "expiresAt", "id", "maxUsesCount", "minSubtotalCents", "type", "updatedAt", "usedCount", "value" FROM "Discount";
DROP TABLE "Discount";
ALTER TABLE "new_Discount" RENAME TO "Discount";
CREATE UNIQUE INDEX "Discount_code_key" ON "Discount"("code");
CREATE INDEX "Discount_automatic_active_idx" ON "Discount"("automatic", "active");
CREATE INDEX "Discount_customerGroupId_idx" ON "Discount"("customerGroupId");
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
INSERT INTO "new_Order" ("billingAddressJson", "couponCode", "createdAt", "currency", "customerId", "discountCents", "email", "id", "notes", "orderNumber", "paymentIntentId", "paymentProvider", "shippingAddressJson", "shippingCents", "status", "subtotalCents", "taxCents", "totalCents", "updatedAt") SELECT "billingAddressJson", "couponCode", "createdAt", "currency", "customerId", "discountCents", "email", "id", "notes", "orderNumber", "paymentIntentId", "paymentProvider", "shippingAddressJson", "shippingCents", "status", "subtotalCents", "taxCents", "totalCents", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX "Order_orderNumber_idx" ON "Order"("orderNumber");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE TABLE "new_ProductVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "sku" TEXT,
    "inventoryCount" INTEGER NOT NULL DEFAULT 0,
    "inventoryTracked" BOOLEAN NOT NULL DEFAULT true,
    "taxClassId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductVariant_taxClassId_fkey" FOREIGN KEY ("taxClassId") REFERENCES "TaxClass" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProductVariant" ("createdAt", "id", "inventoryCount", "inventoryTracked", "position", "productId", "sku", "updatedAt") SELECT "createdAt", "id", "inventoryCount", "inventoryTracked", "position", "productId", "sku", "updatedAt" FROM "ProductVariant";
DROP TABLE "ProductVariant";
ALTER TABLE "new_ProductVariant" RENAME TO "ProductVariant";
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_sku_idx" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_taxClassId_idx" ON "ProductVariant"("taxClassId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TaxClass_code_key" ON "TaxClass"("code");

-- CreateIndex
CREATE INDEX "CartDiscount_cartId_idx" ON "CartDiscount"("cartId");

-- CreateIndex
CREATE INDEX "CartDiscount_discountId_idx" ON "CartDiscount"("discountId");

-- CreateIndex
CREATE UNIQUE INDEX "CartDiscount_cartId_discountId_key" ON "CartDiscount"("cartId", "discountId");

-- CreateIndex
CREATE INDEX "OrderDiscount_orderId_idx" ON "OrderDiscount"("orderId");

-- CreateIndex
CREATE INDEX "OrderDiscount_discountId_idx" ON "OrderDiscount"("discountId");
