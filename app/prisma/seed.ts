import "dotenv/config";
import { PrismaClient, CommentTargetType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;

async function main() {
  const passwordHash = await bcrypt.hash("Test1234!", BCRYPT_ROUNDS);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. 営業担当者（上長を先に作成してから部下を作成）
  // ─────────────────────────────────────────────────────────────────────────────

  // 上長: 鈴木 部長（ID:1）
  await prisma.salesperson.upsert({
    where: { email: "suzuki@test.com" },
    update: {
      name: "鈴木 部長",
      passwordHash,
      isManager: true,
      managerId: null,
    },
    create: {
      id: 1,
      name: "鈴木 部長",
      email: "suzuki@test.com",
      passwordHash,
      isManager: true,
      managerId: null,
    },
  });

  // 上長: 他部署 上長（ID:4）
  await prisma.salesperson.upsert({
    where: { email: "other@test.com" },
    update: {
      name: "他部署 上長",
      passwordHash,
      isManager: true,
      managerId: null,
    },
    create: {
      id: 4,
      name: "他部署 上長",
      email: "other@test.com",
      passwordHash,
      isManager: true,
      managerId: null,
    },
  });

  // 営業: 山田 太郎（ID:2, 上長=1）
  await prisma.salesperson.upsert({
    where: { email: "yamada@test.com" },
    update: {
      name: "山田 太郎",
      passwordHash,
      isManager: false,
      managerId: 1,
    },
    create: {
      id: 2,
      name: "山田 太郎",
      email: "yamada@test.com",
      passwordHash,
      isManager: false,
      managerId: 1,
    },
  });

  // 営業: 田中 次郎（ID:3, 上長=1）
  await prisma.salesperson.upsert({
    where: { email: "tanaka@test.com" },
    update: {
      name: "田中 次郎",
      passwordHash,
      isManager: false,
      managerId: 1,
    },
    create: {
      id: 3,
      name: "田中 次郎",
      email: "tanaka@test.com",
      passwordHash,
      isManager: false,
      managerId: 1,
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. 顧客
  // ─────────────────────────────────────────────────────────────────────────────

  await prisma.customer.upsert({
    where: { id: 10 },
    update: {
      name: "佐藤 一郎",
      company: "株式会社A",
      assignedSalespersonId: 2,
    },
    create: {
      id: 10,
      name: "佐藤 一郎",
      company: "株式会社A",
      assignedSalespersonId: 2,
    },
  });

  await prisma.customer.upsert({
    where: { id: 11 },
    update: {
      name: "中村 花子",
      company: "株式会社B",
      assignedSalespersonId: 2,
    },
    create: {
      id: 11,
      name: "中村 花子",
      company: "株式会社B",
      assignedSalespersonId: 2,
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. 日報
  // ─────────────────────────────────────────────────────────────────────────────

  await prisma.dailyReport.upsert({
    where: { id: 101 },
    update: {
      problem: "テスト課題",
      plan: "テスト計画",
    },
    create: {
      id: 101,
      salespersonId: 2,
      reportDate: new Date("2026-04-10"),
      problem: "テスト課題",
      plan: "テスト計画",
    },
  });

  await prisma.dailyReport.upsert({
    where: { id: 102 },
    update: {
      problem: null,
      plan: null,
    },
    create: {
      id: 102,
      salespersonId: 3,
      reportDate: new Date("2026-04-10"),
      problem: null,
      plan: null,
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. 訪問記録
  // ─────────────────────────────────────────────────────────────────────────────

  await prisma.visitRecord.upsert({
    where: { id: 201 },
    update: {
      customerId: 10,
      visitContent: "提案実施",
      visitOrder: 1,
    },
    create: {
      id: 201,
      reportId: 101,
      customerId: 10,
      visitContent: "提案実施",
      visitOrder: 1,
    },
  });

  await prisma.visitRecord.upsert({
    where: { id: 202 },
    update: {
      customerId: 11,
      visitContent: "定期訪問",
      visitOrder: 2,
    },
    create: {
      id: 202,
      reportId: 101,
      customerId: 11,
      visitContent: "定期訪問",
      visitOrder: 2,
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. コメント
  // ─────────────────────────────────────────────────────────────────────────────

  await prisma.comment.upsert({
    where: { id: 301 },
    update: {
      content: "標準条件で対応してください",
    },
    create: {
      id: 301,
      reportId: 101,
      targetType: CommentTargetType.PROBLEM,
      commenterId: 1,
      content: "標準条件で対応してください",
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. シーケンスリセット（auto-increment が明示的IDと競合しないよう調整）
  // ─────────────────────────────────────────────────────────────────────────────

  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('salespersons', 'id'), (SELECT MAX(id) FROM salespersons))`;
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('customers', 'id'), (SELECT MAX(id) FROM customers))`;
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('daily_reports', 'id'), (SELECT MAX(id) FROM daily_reports))`;
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('visit_records', 'id'), (SELECT MAX(id) FROM visit_records))`;
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('comments', 'id'), (SELECT MAX(id) FROM comments))`;

  console.log("✅ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
