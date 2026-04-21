"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Comment = {
  id: number;
  commenter_id: number;
  commenter_name: string;
  content: string;
  created_at: string;
};

type Props = {
  reportId: number;
  targetType: "problem" | "plan";
  comments: Comment[];
  isManager: boolean;
  onCommentAdded: (comment: Comment) => void;
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function CommentSection({
  reportId,
  targetType,
  comments,
  isManager,
  onCommentAdded,
}: Props) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError("コメントを入力してください");
      return;
    }
    if (content.length > 2000) {
      setError("コメントは2000文字以内で入力してください");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: targetType, content }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error?.message ?? "投稿に失敗しました");
        return;
      }
      const json = await res.json();
      onCommentAdded(json.data as Comment);
      setContent("");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">💬 上長コメント</p>
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">（コメントなし）</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border bg-muted/30 px-3 py-2 text-sm"
            >
              <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium">{c.commenter_name}</span>
                <span>{formatDateTime(c.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap">{c.content}</p>
            </li>
          ))}
        </ul>
      )}

      {isManager && (
        <div className="flex items-start gap-2 pt-1">
          <div className="flex-1 space-y-1">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="コメントを入力..."
              maxLength={2000}
              rows={2}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <Button
            type="button"
            size="sm"
            disabled={submitting}
            onClick={handleSubmit}
          >
            投稿
          </Button>
        </div>
      )}
    </div>
  );
}
