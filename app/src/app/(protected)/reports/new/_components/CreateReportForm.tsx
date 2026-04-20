"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Customer = { id: number; name: string; company: string };

type Props = {
  today: string;
  customers: Customer[];
};

// customer_id は Select が string を返すため string で管理し、送信時に変換
const formSchema = z.object({
  visit_records: z
    .array(
      z.object({
        customer_id: z.string().min(1, "顧客を選択してください"),
        visit_content: z
          .string()
          .min(1, "訪問内容を入力してください")
          .max(1000),
      }),
    )
    .min(1, "訪問記録を1件以上入力してください"),
  problem: z.string().max(2000).optional(),
  plan: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function CreateReportForm({ today, customers }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      visit_records: [{ customer_id: "", visit_content: "" }],
      problem: "",
      plan: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "visit_records",
  });

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_date: today,
          problem: data.problem || undefined,
          plan: data.plan || undefined,
          visit_records: data.visit_records.map((vr, i) => ({
            customer_id: Number(vr.customer_id),
            visit_content: vr.visit_content,
            visit_order: i + 1,
          })),
        }),
      });

      if (res.ok) {
        const json = await res.json();
        router.push(`/reports/${json.data.id}`);
        return;
      }

      const json = await res.json();
      if (res.status === 409) {
        setServerError("本日の日報は既に作成されています");
      } else {
        setServerError(json.error?.message ?? "エラーが発生しました");
      }
    } catch {
      setServerError("通信エラーが発生しました");
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mx-auto max-w-3xl space-y-8 px-4 py-6"
      >
        <h1 className="text-xl font-semibold">日報作成</h1>

        {/* 対象日（表示のみ） */}
        <p className="text-sm text-muted-foreground">
          対象日：{today}（本日）
        </p>

        {/* 訪問記録 */}
        <section>
          <h2 className="mb-3 font-medium">▼ 訪問記録</h2>
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-[2rem_1fr_2fr_auto] items-start gap-2 rounded-lg border p-3"
              >
                <span className="pt-2 text-sm text-muted-foreground">
                  {index + 1}
                </span>

                {/* 顧客名 */}
                <FormField
                  control={form.control}
                  name={`visit_records.${index}.customer_id`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel className="sr-only">顧客名</FormLabel>
                      <FormControl>
                        <Select
                          value={f.value}
                          onValueChange={(v) => f.onChange(v ?? "")}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="顧客を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {customers.map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.company}（{c.name}）
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 訪問内容 */}
                <FormField
                  control={form.control}
                  name={`visit_records.${index}.visit_content`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel className="sr-only">訪問内容</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="訪問内容を入力"
                          maxLength={1000}
                          {...f}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 削除ボタン */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={fields.length <= 1}
                  onClick={() => remove(index)}
                  aria-label={`訪問記録${index + 1}を削除`}
                >
                  削除
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => append({ customer_id: "", visit_content: "" })}
          >
            + 訪問先を追加する
          </Button>

          {form.formState.errors.visit_records?.root && (
            <p className="mt-1 text-sm text-destructive">
              {form.formState.errors.visit_records.root.message}
            </p>
          )}
        </section>

        {/* Problem */}
        <FormField
          control={form.control}
          name="problem"
          render={({ field }) => (
            <FormItem>
              <FormLabel>▼ 今日の課題・相談（Problem）</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="今日の課題や相談事項を入力してください（任意）"
                  maxLength={2000}
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Plan */}
        <FormField
          control={form.control}
          name="plan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>▼ 明日やること（Plan）</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="明日の行動計画を入力してください（任意）"
                  maxLength={2000}
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* サーバーエラー */}
        {serverError && (
          <p className="text-sm text-destructive">{serverError}</p>
        )}

        {/* アクションボタン */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/")}
          >
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
