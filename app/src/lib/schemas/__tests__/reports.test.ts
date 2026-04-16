import { describe, test, expect } from "vitest";
import {
  CreateReportRequestSchema,
  ReportListQuerySchema,
  VisitRecordInputSchema,
} from "../reports";

describe("VisitRecordInputSchema", () => {
  test("有効なデータで成功する", () => {
    const result = VisitRecordInputSchema.safeParse({
      customer_id: 10,
      visit_content: "新製品の提案を実施。",
      visit_order: 1,
    });
    expect(result.success).toBe(true);
  });

  test("visit_contentが1001文字でエラーになる", () => {
    const result = VisitRecordInputSchema.safeParse({
      customer_id: 10,
      visit_content: "a".repeat(1001),
      visit_order: 1,
    });
    expect(result.success).toBe(false);
  });

  test("visit_orderが0でエラーになる", () => {
    const result = VisitRecordInputSchema.safeParse({
      customer_id: 10,
      visit_content: "訪問内容",
      visit_order: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateReportRequestSchema", () => {
  const validPayload = {
    report_date: "2026-04-13",
    problem: "課題があります。",
    plan: "対応計画を立てます。",
    visit_records: [
      { customer_id: 10, visit_content: "提案を実施。", visit_order: 1 },
    ],
  };

  test("有効なデータで成功する", () => {
    const result = CreateReportRequestSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  test("report_dateが不正な形式でエラーになる", () => {
    const result = CreateReportRequestSchema.safeParse({
      ...validPayload,
      report_date: "2026/04/13",
    });
    expect(result.success).toBe(false);
  });

  test("visit_recordsが空配列でエラーになる", () => {
    const result = CreateReportRequestSchema.safeParse({
      ...validPayload,
      visit_records: [],
    });
    expect(result.success).toBe(false);
  });

  test("problemが2001文字でエラーになる", () => {
    const result = CreateReportRequestSchema.safeParse({
      ...validPayload,
      problem: "a".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  test("problem・planは省略可能", () => {
    const result = CreateReportRequestSchema.safeParse({
      report_date: validPayload.report_date,
      visit_records: validPayload.visit_records,
    });
    expect(result.success).toBe(true);
  });
});

describe("ReportListQuerySchema", () => {
  test("デフォルト値が適用される", () => {
    const result = ReportListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.per_page).toBe(20);
    }
  });

  test("year_monthが不正な形式でエラーになる", () => {
    const result = ReportListQuerySchema.safeParse({ year_month: "2026-4" });
    expect(result.success).toBe(false);
  });

  test("per_pageが100を超えるとエラーになる", () => {
    const result = ReportListQuerySchema.safeParse({ per_page: 101 });
    expect(result.success).toBe(false);
  });
});
