import { describe, test, expect } from "vitest";
import { CreateCustomerRequestSchema } from "../customers";

describe("CreateCustomerRequestSchema", () => {
  const validPayload = {
    name: "田中 一郎",
    company: "株式会社A",
    phone: "03-1234-5678",
    address: "東京都千代田区1-1-1",
    assigned_salesperson_id: 1,
  };

  test("有効なデータで成功する", () => {
    const result = CreateCustomerRequestSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  test("phone・addressは省略可能", () => {
    const result = CreateCustomerRequestSchema.safeParse({
      name: validPayload.name,
      company: validPayload.company,
      assigned_salesperson_id: validPayload.assigned_salesperson_id,
    });
    expect(result.success).toBe(true);
  });

  test("nameが101文字でエラーになる", () => {
    const result = CreateCustomerRequestSchema.safeParse({
      ...validPayload,
      name: "a".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  test("companyが201文字でエラーになる", () => {
    const result = CreateCustomerRequestSchema.safeParse({
      ...validPayload,
      company: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  test("addressが301文字でエラーになる", () => {
    const result = CreateCustomerRequestSchema.safeParse({
      ...validPayload,
      address: "a".repeat(301),
    });
    expect(result.success).toBe(false);
  });

  test("assigned_salesperson_idが0でエラーになる", () => {
    const result = CreateCustomerRequestSchema.safeParse({
      ...validPayload,
      assigned_salesperson_id: 0,
    });
    expect(result.success).toBe(false);
  });
});
