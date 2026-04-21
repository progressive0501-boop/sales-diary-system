"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Salesperson = { id: number; name: string };

type Props = {
  mode: "new" | "edit";
  customerId?: number;
  salespersons: Salesperson[];
  defaultValues?: {
    name: string;
    company: string;
    phone: string;
    address: string;
    assigned_salesperson_id: string;
  };
};

const formSchema = z.object({
  name: z.string().min(1, "顧客名を入力してください").max(100),
  company: z.string().min(1, "会社名を入力してください").max(200),
  phone: z.string().max(50).optional(),
  address: z.string().max(300).optional(),
  assigned_salesperson_id: z.string().min(1, "担当営業を選択してください"),
});

type FormValues = z.infer<typeof formSchema>;

export function CustomerForm({ mode, customerId, salespersons, defaultValues }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues ?? {
      name: "",
      company: "",
      phone: "",
      address: "",
      assigned_salesperson_id: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    const body = {
      name: data.name,
      company: data.company,
      phone: data.phone || undefined,
      address: data.address || undefined,
      assigned_salesperson_id: Number(data.assigned_salesperson_id),
    };

    try {
      const res = await fetch(
        mode === "new" ? "/api/customers" : `/api/customers/${customerId}`,
        {
          method: mode === "new" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (res.ok) {
        router.push("/customers");
        return;
      }

      const json = await res.json();
      setServerError(json.error?.message ?? "エラーが発生しました");
    } catch {
      setServerError("通信エラーが発生しました");
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mx-auto max-w-2xl space-y-6 px-4 py-6"
      >
        <h1 className="text-xl font-semibold">
          {mode === "new" ? "顧客登録" : "顧客編集"}
        </h1>

        {/* 顧客名 */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>顧客名 *</FormLabel>
              <FormControl>
                <Input placeholder="田中 一郎" maxLength={100} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 会社名 */}
        <FormField
          control={form.control}
          name="company"
          render={({ field }) => (
            <FormItem>
              <FormLabel>会社名 *</FormLabel>
              <FormControl>
                <Input placeholder="株式会社A" maxLength={200} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 電話番号 */}
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>電話番号</FormLabel>
              <FormControl>
                <Input placeholder="03-1234-5678" maxLength={50} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 住所 */}
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>住所</FormLabel>
              <FormControl>
                <Input placeholder="東京都千代田区..." maxLength={300} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 担当営業 */}
        <FormField
          control={form.control}
          name="assigned_salesperson_id"
          render={({ field: f }) => (
            <FormItem>
              <FormLabel>担当営業 *</FormLabel>
              <FormControl>
                <Select value={f.value} onValueChange={(v) => f.onChange(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="担当営業を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {salespersons.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {serverError && (
          <p className="text-sm text-destructive">{serverError}</p>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/customers")}>
            キャンセル
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            保存する
          </Button>
        </div>
      </form>
    </Form>
  );
}
