"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type ReportItem = {
  id: number;
  salesperson_id: number;
  salesperson_name: string;
  report_date: string;
  visit_count: number;
  has_comment: boolean;
};

type Pagination = {
  total: number;
  total_pages: number;
  current_page: number;
  per_page: number;
};

type Props = {
  isManager: boolean;
  initialItems: ReportItem[];
  initialPagination: Pagination;
  initialSalespersonOptions: { id: number; name: string }[];
};

// 直近12ヶ月の年月リストを生成
function buildYearMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    options.push({ value: `${y}-${m}`, label: `${y}年${m}月` });
  }
  return options;
}

const YEAR_MONTH_OPTIONS = buildYearMonthOptions();

export function ReportListClient({
  isManager,
  initialItems,
  initialPagination,
  initialSalespersonOptions,
}: Props) {
  const router = useRouter();

  const [items, setItems] = useState<ReportItem[]>(initialItems);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [salespersonOptions] = useState(initialSalespersonOptions);

  const [yearMonth, setYearMonth] = useState<string>("");
  const [salespersonId, setSalespersonId] = useState<string>("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchReports = useCallback(
    async (opts: { yearMonth?: string; salespersonId?: string; page?: number }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (opts.yearMonth) params.set("year_month", opts.yearMonth);
        if (opts.salespersonId) params.set("salesperson_id", opts.salespersonId);
        params.set("page", String(opts.page ?? 1));
        params.set("per_page", "20");

        const res = await fetch(`/api/reports?${params.toString()}`);
        if (!res.ok) return;
        const json = await res.json();
        setItems(json.data.items);
        setPagination(json.data.pagination);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleSearch = () => {
    setPage(1);
    void fetchReports({ yearMonth, salespersonId, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    void fetchReports({ yearMonth, salespersonId, page: newPage });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ヘッダー行 */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">日報一覧</h1>
        {!isManager && (
          <Button onClick={() => router.push("/reports/new")}>
            + 新規日報作成
          </Button>
        )}
      </div>

      {/* フィルター行 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">絞り込み：</span>

        {isManager && (
          <Select value={salespersonId} onValueChange={(v) => setSalespersonId(v ?? "")}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="営業名" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">すべて</SelectItem>
              {salespersonOptions.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={yearMonth} onValueChange={(v) => setYearMonth(v ?? "")}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="年月" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">すべて</SelectItem>
            {YEAR_MONTH_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={handleSearch} disabled={loading}>
          検索
        </Button>
      </div>

      {/* テーブル */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>日付</TableHead>
            {isManager && <TableHead>営業名</TableHead>}
            <TableHead>訪問件数</TableHead>
            <TableHead>コメント有無</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={isManager ? 4 : 3}
                className="py-8 text-center text-muted-foreground"
              >
                日報がありません
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow
                key={item.id}
                className="cursor-pointer"
                onClick={() => router.push(`/reports/${item.id}`)}
              >
                <TableCell>{item.report_date}</TableCell>
                {isManager && <TableCell>{item.salesperson_name}</TableCell>}
                <TableCell>{item.visit_count}件</TableCell>
                <TableCell>{item.has_comment ? "あり" : "なし"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* ページネーション */}
      {pagination.total_pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => handlePageChange(page - 1)}
          >
            &lt; 前へ
          </Button>
          <span className="text-sm text-muted-foreground">
            {page}/{pagination.total_pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.total_pages || loading}
            onClick={() => handlePageChange(page + 1)}
          >
            次へ &gt;
          </Button>
        </div>
      )}
    </div>
  );
}
