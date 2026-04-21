"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { CommentSection } from "./CommentSection";

// ── 型定義 ───────────────────────────────────────────────────────────────────

type VisitRecord = {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_company: string;
  visit_content: string;
  visit_order: number;
};

type CommentItem = {
  id: number;
  commenter_id: number;
  commenter_name: string;
  content: string;
  created_at: string;
};

type ReportData = {
  id: number;
  salesperson_id: number;
  salesperson_name: string;
  report_date: string;
  problem: string | null;
  plan: string | null;
  visit_records: VisitRecord[];
  comments: { problem: CommentItem[]; plan: CommentItem[] };
};

type Customer = { id: number; name: string; company: string };

type Props = {
  report: ReportData;
  isOwner: boolean;
  isManager: boolean;
  customers: Customer[];
};

// ── 編集フォームスキーマ ──────────────────────────────────────────────────────

const editFormSchema = z.object({
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

type EditFormValues = z.infer<typeof editFormSchema>;

// ── メインコンポーネント ──────────────────────────────────────────────────────

export function ReportDetailClient({
  report: initialReport,
  isOwner,
  isManager,
  customers,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [report, setReport] = useState<ReportData>(initialReport);
  const [comments, setComments] = useState(initialReport.comments);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── 編集フォーム ────────────────────────────────────────────────────────────
  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      visit_records: report.visit_records.map((vr) => ({
        customer_id: String(vr.customer_id),
        visit_content: vr.visit_content,
      })),
      problem: report.problem ?? "",
      plan: report.plan ?? "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "visit_records",
  });

  const handleEditStart = () => {
    form.reset({
      visit_records: report.visit_records.map((vr) => ({
        customer_id: String(vr.customer_id),
        visit_content: vr.visit_content,
      })),
      problem: report.problem ?? "",
      plan: report.plan ?? "",
    });
    setSaveError(null);
    setMode("edit");
  };

  const handleCancel = () => {
    form.reset();
    setSaveError(null);
    setMode("view");
  };

  const onSubmit = async (data: EditFormValues) => {
    setSaveError(null);
    try {
      const res = await fetch(`/api/reports/${report.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_date: report.report_date,
          problem: data.problem || undefined,
          plan: data.plan || undefined,
          visit_records: data.visit_records.map((vr, i) => ({
            customer_id: Number(vr.customer_id),
            visit_content: vr.visit_content,
            visit_order: i + 1,
          })),
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        setSaveError(json.error?.message ?? "保存に失敗しました");
        return;
      }

      // 更新後のデータで report を再構築（PUT レスポンスは id/report_date/updated_at のみ）
      const updatedVisitRecords = data.visit_records.map((vr, i) => {
        const customer = customers.find((c) => c.id === Number(vr.customer_id));
        return {
          id: report.visit_records[i]?.id ?? -(i + 1),
          customer_id: Number(vr.customer_id),
          customer_name: customer?.name ?? "",
          customer_company: customer?.company ?? "",
          visit_content: vr.visit_content,
          visit_order: i + 1,
        };
      });

      setReport({
        ...report,
        problem: data.problem || null,
        plan: data.plan || null,
        visit_records: updatedVisitRecords,
      });
      setMode("view");
    } catch {
      setSaveError("通信エラーが発生しました");
    }
  };

  // ── コメント追加ハンドラ ────────────────────────────────────────────────────
  const handleCommentAdded =
    (target: "problem" | "plan") => (comment: CommentItem) => {
      setComments((prev) => ({
        ...prev,
        [target]: [...prev[target], comment],
      }));
    };

  // ── 表示モード ──────────────────────────────────────────────────────────────
  if (mode === "view") {
    return (
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">
              日報詳細　{report.report_date}　{report.salesperson_name}
            </h1>
          </div>
          <div className="flex gap-2">
            {isOwner && (
              <Button onClick={handleEditStart}>編集する</Button>
            )}
            <Button variant="outline" onClick={() => router.push("/")}>
              一覧へ戻る
            </Button>
          </div>
        </div>

        {/* 訪問記録 */}
        <section>
          <h2 className="mb-3 font-medium">▼ 訪問記録</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>顧客名</TableHead>
                <TableHead>訪問内容</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.visit_records.map((vr) => (
                <TableRow key={vr.id}>
                  <TableCell>{vr.visit_order}</TableCell>
                  <TableCell>
                    <div>{vr.customer_company}</div>
                    <div className="text-xs text-muted-foreground">
                      {vr.customer_name}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-pre-wrap">
                    {vr.visit_content}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        {/* Problem */}
        <section>
          <h2 className="mb-2 font-medium">▼ 今日の課題・相談（Problem）</h2>
          <p className="whitespace-pre-wrap text-sm">
            {report.problem ?? "（未入力）"}
          </p>
          <CommentSection
            reportId={report.id}
            targetType="problem"
            comments={comments.problem}
            isManager={isManager}
            onCommentAdded={handleCommentAdded("problem")}
          />
        </section>

        {/* Plan */}
        <section>
          <h2 className="mb-2 font-medium">▼ 明日やること（Plan）</h2>
          <p className="whitespace-pre-wrap text-sm">
            {report.plan ?? "（未入力）"}
          </p>
          <CommentSection
            reportId={report.id}
            targetType="plan"
            comments={comments.plan}
            isManager={isManager}
            onCommentAdded={handleCommentAdded("plan")}
          />
        </section>
      </div>
    );
  }

  // ── 編集モード ──────────────────────────────────────────────────────────────
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mx-auto max-w-3xl space-y-8 px-4 py-6"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">日報編集</h1>
          <p className="text-sm text-muted-foreground">
            対象日：{report.report_date}
          </p>
        </div>

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
                <Textarea maxLength={2000} rows={4} {...field} />
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
                <Textarea maxLength={2000} rows={4} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {saveError && (
          <p className="text-sm text-destructive">{saveError}</p>
        )}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
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
