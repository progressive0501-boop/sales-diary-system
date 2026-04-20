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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SalespersonItem = {
  id: number;
  name: string;
  email: string;
  manager_name: string | null;
};

type Pagination = {
  total: number;
  total_pages: number;
  current_page: number;
  per_page: number;
};

type Props = {
  initialItems: SalespersonItem[];
  initialPagination: Pagination;
};

export function SalespersonListClient({ initialItems, initialPagination }: Props) {
  const router = useRouter();

  const [items, setItems] = useState<SalespersonItem[]>(initialItems);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchSalespersons = useCallback(async (opts: { q?: string; page?: number }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (opts.q) params.set("q", opts.q);
      params.set("page", String(opts.page ?? 1));
      params.set("per_page", "20");

      const res = await fetch(`/api/salespersons?${params.toString()}`);
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.data.items);
      setPagination(json.data.pagination);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = () => {
    setPage(1);
    void fetchSalespersons({ q, page: 1 });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    void fetchSalespersons({ q, page: newPage });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ヘッダー行 */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">営業マスタ</h1>
        <Button onClick={() => router.push("/salespersons/new")}>
          + 新規登録
        </Button>
      </div>

      {/* 検索行 */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">検索：</span>
        <Input
          className="w-56"
          placeholder="名前..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button variant="outline" onClick={handleSearch} disabled={loading}>
          検索
        </Button>
      </div>

      {/* テーブル */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>氏名</TableHead>
            <TableHead>メールアドレス</TableHead>
            <TableHead>上長</TableHead>
            <TableHead className="w-20">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                営業が見つかりません
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.email}</TableCell>
                <TableCell>{item.manager_name ?? "—"}</TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/salespersons/${item.id}/edit`)}
                  >
                    編集
                  </Button>
                </TableCell>
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
