Loaded Prisma config from prisma.config.ts.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CommentTargetType" AS ENUM ('PROBLEM', 'PLAN');

-- CreateTable
CREATE TABLE "salespersons" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "department" VARCHAR(100),
    "is_manager" BOOLEAN NOT NULL DEFAULT false,
    "manager_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salespersons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "company" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(20),
    "address" VARCHAR(300),
    "assigned_salesperson_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_reports" (
    "id" SERIAL NOT NULL,
    "salesperson_id" INTEGER NOT NULL,
    "report_date" DATE NOT NULL,
    "problem" TEXT,
    "plan" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_records" (
    "id" SERIAL NOT NULL,
    "report_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "visit_content" VARCHAR(1000) NOT NULL,
    "visit_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" SERIAL NOT NULL,
    "report_id" INTEGER NOT NULL,
    "target_type" "CommentTargetType" NOT NULL,
    "commenter_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salespersons_email_key" ON "salespersons"("email");

-- CreateIndex
CREATE UNIQUE INDEX "daily_reports_salesperson_id_report_date_key" ON "daily_reports"("salesperson_id", "report_date");

-- AddForeignKey
ALTER TABLE "salespersons" ADD CONSTRAINT "salespersons_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "salespersons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_assigned_salesperson_id_fkey" FOREIGN KEY ("assigned_salesperson_id") REFERENCES "salespersons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_salesperson_id_fkey" FOREIGN KEY ("salesperson_id") REFERENCES "salespersons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_records" ADD CONSTRAINT "visit_records_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "daily_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_records" ADD CONSTRAINT "visit_records_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "daily_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_commenter_id_fkey" FOREIGN KEY ("commenter_id") REFERENCES "salespersons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

