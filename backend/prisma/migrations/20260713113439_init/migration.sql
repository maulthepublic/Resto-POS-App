-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'admin', 'cashier', 'chef');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('draft', 'paid', 'cooking', 'ready', 'served', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'static_qris', 'dynamic_qris', 'ewallet', 'debit_credit');

-- CreateEnum
CREATE TYPE "SyncOperation" AS ENUM ('insert', 'update', 'delete');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('pending', 'processing', 'synced', 'failed');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('income', 'expense');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "pin_hash" TEXT,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "base_price" DECIMAL(14,2) NOT NULL,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "menu_item_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "max_selected" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "variant_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variant_group_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price_delta" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifiers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "price_delta" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_materials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "minimum_quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "current_quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "menu_item_id" UUID NOT NULL,
    "raw_material_id" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "table_number" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'paid',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "discount_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(14,2) NOT NULL,
    "paid_at" TIMESTAMPTZ NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "menu_item_id" UUID,
    "item_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "line_total" DECIMAL(14,2) NOT NULL,
    "selected_variants" JSONB NOT NULL DEFAULT '[]',
    "selected_modifiers" JSONB NOT NULL DEFAULT '[]',
    "kitchen_note" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "provider_reference" TEXT,
    "is_offline" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "raw_material_id" UUID NOT NULL,
    "order_id" UUID,
    "movement_type" TEXT NOT NULL,
    "quantity_delta" DECIMAL(14,3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_ledger" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID,
    "type" "LedgerType" NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "payment_method" "PaymentMethod",
    "description" TEXT,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_mutations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "operation" "SyncOperation" NOT NULL,
    "payload" JSONB NOT NULL,
    "client_created_at" TIMESTAMPTZ NOT NULL,
    "server_received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SyncStatus" NOT NULL DEFAULT 'synced',

    CONSTRAINT "sync_mutations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_menu_item_id_raw_material_id_key" ON "recipes"("menu_item_id", "raw_material_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_receipt_number_key" ON "orders"("receipt_number");

-- CreateIndex
CREATE INDEX "orders_paid_at_idx" ON "orders"("paid_at" DESC);

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "stock_movements_raw_material_id_created_at_idx" ON "stock_movements"("raw_material_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "finance_ledger_occurred_at_idx" ON "finance_ledger"("occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "sync_mutations_idempotency_key_key" ON "sync_mutations"("idempotency_key");

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_groups" ADD CONSTRAINT "variant_groups_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_variant_group_id_fkey" FOREIGN KEY ("variant_group_id") REFERENCES "variant_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_ledger" ADD CONSTRAINT "finance_ledger_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_ledger" ADD CONSTRAINT "finance_ledger_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
