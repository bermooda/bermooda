-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralCode_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "referralCodeId" TEXT NOT NULL,
    "referredCustomerId" TEXT NOT NULL,
    "firstOrderId" TEXT,
    "rewardGrantedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Referral_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Referral_referredCustomerId_fkey" FOREIGN KEY ("referredCustomerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketingSegment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rulesJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "segmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" DATETIME,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketingCampaign_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "MarketingSegment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignDelivery_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignDelivery_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AbandonedCartSequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "delayMinutes" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AbandonedCartSend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cartId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AbandonedCartSend_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "AbandonedCartSequence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalesChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "domain" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChannelProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelProduct_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "SalesChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChannelProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChannelPriceOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChannelPriceOverride_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "SalesChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChannelPriceOverride_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "salesChannelId" TEXT,
    "token" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "lockedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cart_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Cart_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Cart" ("createdAt", "currency", "customerId", "expiresAt", "id", "lockedAt", "token", "updatedAt") SELECT "createdAt", "currency", "customerId", "expiresAt", "id", "lockedAt", "token", "updatedAt" FROM "Cart";
DROP TABLE "Cart";
ALTER TABLE "new_Cart" RENAME TO "Cart";
CREATE UNIQUE INDEX "Cart_token_key" ON "Cart"("token");
CREATE INDEX "Cart_customerId_idx" ON "Cart"("customerId");
CREATE INDEX "Cart_salesChannelId_idx" ON "Cart"("salesChannelId");
CREATE INDEX "Cart_token_idx" ON "Cart"("token");
CREATE TABLE "new_CheckoutSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cartId" TEXT NOT NULL,
    "customerId" TEXT,
    "salesChannelId" TEXT,
    "email" TEXT,
    "step" TEXT NOT NULL DEFAULT 'address',
    "shippingAddressJson" TEXT,
    "billingAddressJson" TEXT,
    "shippingOptionJson" TEXT,
    "paymentIntentId" TEXT,
    "paymentProvider" TEXT,
    "couponCode" TEXT,
    "giftCardCode" TEXT,
    "storeCreditCents" INTEGER NOT NULL DEFAULT 0,
    "loyaltyPointsCents" INTEGER NOT NULL DEFAULT 0,
    "vatId" TEXT,
    "taxExempt" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CheckoutSession_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CheckoutSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CheckoutSession_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CheckoutSession" ("billingAddressJson", "cartId", "couponCode", "createdAt", "customerId", "email", "expiresAt", "giftCardCode", "id", "paymentIntentId", "paymentProvider", "shippingAddressJson", "shippingOptionJson", "step", "storeCreditCents", "taxExempt", "updatedAt", "vatId") SELECT "billingAddressJson", "cartId", "couponCode", "createdAt", "customerId", "email", "expiresAt", "giftCardCode", "id", "paymentIntentId", "paymentProvider", "shippingAddressJson", "shippingOptionJson", "step", "storeCreditCents", "taxExempt", "updatedAt", "vatId" FROM "CheckoutSession";
DROP TABLE "CheckoutSession";
ALTER TABLE "new_CheckoutSession" RENAME TO "CheckoutSession";
CREATE INDEX "CheckoutSession_cartId_idx" ON "CheckoutSession"("cartId");
CREATE INDEX "CheckoutSession_customerId_idx" ON "CheckoutSession"("customerId");
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
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("billingAddressJson", "couponCode", "createdAt", "currency", "customerId", "discountCents", "email", "giftCardCents", "id", "notes", "orderNumber", "paymentIntentId", "paymentProvider", "shippingAddressJson", "shippingCents", "status", "storeCreditCents", "subtotalCents", "taxCents", "taxExempt", "totalCents", "updatedAt", "vatId") SELECT "billingAddressJson", "couponCode", "createdAt", "currency", "customerId", "discountCents", "email", "giftCardCents", "id", "notes", "orderNumber", "paymentIntentId", "paymentProvider", "shippingAddressJson", "shippingCents", "status", "storeCreditCents", "subtotalCents", "taxCents", "taxExempt", "totalCents", "updatedAt", "vatId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX "Order_salesChannelId_idx" ON "Order"("salesChannelId");
CREATE INDEX "Order_orderNumber_idx" ON "Order"("orderNumber");
CREATE INDEX "Order_status_idx" ON "Order"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_customerId_idx" ON "LoyaltyTransaction"("customerId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_referenceType_referenceId_idx" ON "LoyaltyTransaction"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_customerId_key" ON "ReferralCode"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredCustomerId_key" ON "Referral"("referredCustomerId");

-- CreateIndex
CREATE INDEX "Referral_referralCodeId_idx" ON "Referral"("referralCodeId");

-- CreateIndex
CREATE INDEX "MarketingCampaign_segmentId_idx" ON "MarketingCampaign"("segmentId");

-- CreateIndex
CREATE INDEX "MarketingCampaign_status_idx" ON "MarketingCampaign"("status");

-- CreateIndex
CREATE INDEX "CampaignDelivery_campaignId_status_idx" ON "CampaignDelivery"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignDelivery_campaignId_customerId_key" ON "CampaignDelivery"("campaignId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "AbandonedCartSequence_stepNumber_key" ON "AbandonedCartSequence"("stepNumber");

-- CreateIndex
CREATE INDEX "AbandonedCartSend_cartId_idx" ON "AbandonedCartSend"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "AbandonedCartSend_cartId_sequenceId_key" ON "AbandonedCartSend"("cartId", "sequenceId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesChannel_handle_key" ON "SalesChannel"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "SalesChannel_domain_key" ON "SalesChannel"("domain");

-- CreateIndex
CREATE INDEX "ChannelProduct_channelId_published_idx" ON "ChannelProduct"("channelId", "published");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelProduct_channelId_productId_key" ON "ChannelProduct"("channelId", "productId");

-- CreateIndex
CREATE INDEX "ChannelPriceOverride_variantId_idx" ON "ChannelPriceOverride"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelPriceOverride_channelId_variantId_currency_key" ON "ChannelPriceOverride"("channelId", "variantId", "currency");
