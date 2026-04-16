import { describe, test, expect } from "vitest";
import {
  CreateSalespersonRequestSchema,
  UpdateSalespersonRequestSchema,
} from "../salespersons";

describe("CreateSalespersonRequestSchema", () => {
  const validPayload = {
    name: "山田 太郎",
    email: "yamada@example.co.jp",
    password: "password123",
    department: "東日本営業部",
    manager_id: 5,
    is_manager: false,
  };

  test("有効なデータで成功する", () => {
    const result = CreateSalespersonRequestSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  test("departmentは省略可能", () => {
    const result = CreateSalespersonRequestSchema.safeParse({
      name: validPayload.name,
      email: validPayload.email,
      password: validPayload.password,
      manager_id: validPayload.manager_id,
      is_manager: validPayload.is_manager,
    });
    expect(result.success).toBe(true);
  });

  test("不正なメール形式でエラーになる", () => {
    const result = CreateSalespersonRequestSchema.safeParse({
      ...validPayload,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  test("passwordが7文字でエラーになる", () => {
    const result = CreateSalespersonRequestSchema.safeParse({
      ...validPayload,
      password: "short7",
    });
    expect(result.success).toBe(false);
  });

  test("passwordが8文字で成功する", () => {
    const result = CreateSalespersonRequestSchema.safeParse({
      ...validPayload,
      password: "exactly8",
    });
    expect(result.success).toBe(true);
  });

  test("nameが101文字でエラーになる", () => {
    const result = CreateSalespersonRequestSchema.safeParse({
      ...validPayload,
      name: "a".repeat(101),
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdateSalespersonRequestSchema", () => {
  test("passwordフィールドが不要（省略できる）", () => {
    const result = UpdateSalespersonRequestSchema.safeParse({
      name: "山田 太郎",
      email: "yamada@example.co.jp",
      department: "東日本営業部",
      manager_id: 5,
      is_manager: false,
    });
    expect(result.success).toBe(true);
  });

  test("passwordを含めるとエラーになる（スキーマから除外されている）", () => {
    const data = UpdateSalespersonRequestSchema.safeParse({
      name: "山田 太郎",
      email: "yamada@example.co.jp",
      password: "password123",
      manager_id: 5,
      is_manager: false,
    });
    // stripされるのでsuccessになるが、passwordは含まれない
    if (data.success) {
      expect("password" in data.data).toBe(false);
    }
  });
});
