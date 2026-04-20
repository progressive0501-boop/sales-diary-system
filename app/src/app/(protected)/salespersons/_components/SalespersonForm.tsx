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

type Manager = { id: number; name: string };

type Props = {
  mode: "new" | "edit";
  salespersonId?: number;
  managers: Manager[];
  defaultValues?: {
    name: string;
    email: string;
    department: string;
    manager_id: string;
    is_manager: "false" | "true";
  };
};

const newSchema = z.object({
  name: z.string().min(1, "氏名を入力してください").max(100),
  email: z.string().min(1, "メールアドレスを入力してください").email("メールアドレスの形式が正しくありません"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
  department: z.string().max(100).optional(),
  manager_id: z.string().min(1, "上長を選択してください"),
  is_manager: z.enum(["false", "true"]),
});

const editSchema = z.object({
  name: z.string().min(1, "氏名を入力してください").max(100),
  email: z.string().min(1, "メールアドレスを入力してください").email("メールアドレスの形式が正しくありません"),
  department: z.string().max(100).optional(),
  manager_id: z.string().min(1, "上長を選択してください"),
  is_manager: z.enum(["false", "true"]),
});

type NewFormValues = z.infer<typeof newSchema>;
type EditFormValues = z.infer<typeof editSchema>;

export function SalespersonForm({ mode, salespersonId, managers, defaultValues }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const newForm = useForm<NewFormValues>({
    resolver: zodResolver(newSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      department: "",
      manager_id: "",
      is_manager: "false",
    },
  });

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: defaultValues ?? {
      name: "",
      email: "",
      department: "",
      manager_id: "",
      is_manager: "false",
    },
  });

  const handleNewSubmit = async (data: NewFormValues) => {
    setServerError(null);
    try {
      const res = await fetch("/api/salespersons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          department: data.department || undefined,
          manager_id: Number(data.manager_id),
          is_manager: data.is_manager === "true",
        }),
      });
      if (res.ok) { router.push("/salespersons"); return; }
      const json = await res.json();
      setServerError(json.error?.message ?? "エラーが発生しました");
    } catch {
      setServerError("通信エラーが発生しました");
    }
  };

  const handleEditSubmit = async (data: EditFormValues) => {
    setServerError(null);
    try {
      const res = await fetch(`/api/salespersons/${salespersonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          department: data.department || undefined,
          manager_id: Number(data.manager_id),
          is_manager: data.is_manager === "true",
        }),
      });
      if (res.ok) { router.push("/salespersons"); return; }
      const json = await res.json();
      setServerError(json.error?.message ?? "エラーが発生しました");
    } catch {
      setServerError("通信エラーが発生しました");
    }
  };

  const managerSelect = (
    value: string,
    onChange: (v: string) => void,
  ) => (
    <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="上長を選択" />
      </SelectTrigger>
      <SelectContent>
        {managers.map((m) => (
          <SelectItem key={m.id} value={String(m.id)}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const isManagerRadio = (value: string, onChange: (v: "false" | "true") => void) => (
    <div className="flex gap-6">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          value="false"
          checked={value === "false"}
          onChange={() => onChange("false")}
          className="accent-primary"
        />
        <span className="text-sm">営業</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          value="true"
          checked={value === "true"}
          onChange={() => onChange("true")}
          className="accent-primary"
        />
        <span className="text-sm">上長</span>
      </label>
    </div>
  );

  if (mode === "new") {
    return (
      <Form {...newForm}>
        <form
          onSubmit={newForm.handleSubmit(handleNewSubmit)}
          className="mx-auto max-w-2xl space-y-6 px-4 py-6"
        >
          <h1 className="text-xl font-semibold">営業登録</h1>

          <FormField control={newForm.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>氏名 *</FormLabel>
              <FormControl><Input placeholder="山田 太郎" maxLength={100} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={newForm.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>メールアドレス *</FormLabel>
              <FormControl><Input type="email" placeholder="yamada@example.co.jp" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={newForm.control} name="password" render={({ field }) => (
            <FormItem>
              <FormLabel>パスワード *</FormLabel>
              <FormControl><Input type="password" placeholder="8文字以上" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={newForm.control} name="department" render={({ field }) => (
            <FormItem>
              <FormLabel>部署</FormLabel>
              <FormControl><Input placeholder="東日本営業部" maxLength={100} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={newForm.control} name="manager_id" render={({ field: f }) => (
            <FormItem>
              <FormLabel>上長 *</FormLabel>
              <FormControl>{managerSelect(f.value, f.onChange)}</FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={newForm.control} name="is_manager" render={({ field: f }) => (
            <FormItem>
              <FormLabel>権限</FormLabel>
              <FormControl>{isManagerRadio(f.value, f.onChange)}</FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => router.push("/salespersons")}>
              キャンセル
            </Button>
            <Button type="submit" disabled={newForm.formState.isSubmitting}>
              保存する
            </Button>
          </div>
        </form>
      </Form>
    );
  }

  return (
    <Form {...editForm}>
      <form
        onSubmit={editForm.handleSubmit(handleEditSubmit)}
        className="mx-auto max-w-2xl space-y-6 px-4 py-6"
      >
        <h1 className="text-xl font-semibold">営業編集</h1>

        <FormField control={editForm.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>氏名 *</FormLabel>
            <FormControl><Input placeholder="山田 太郎" maxLength={100} {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={editForm.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>メールアドレス *</FormLabel>
            <FormControl><Input type="email" placeholder="yamada@example.co.jp" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={editForm.control} name="department" render={({ field }) => (
          <FormItem>
            <FormLabel>部署</FormLabel>
            <FormControl><Input placeholder="東日本営業部" maxLength={100} {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={editForm.control} name="manager_id" render={({ field: f }) => (
          <FormItem>
            <FormLabel>上長 *</FormLabel>
            <FormControl>{managerSelect(f.value, f.onChange)}</FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={editForm.control} name="is_manager" render={({ field: f }) => (
          <FormItem>
            <FormLabel>権限</FormLabel>
            <FormControl>{isManagerRadio(f.value, f.onChange)}</FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {serverError && <p className="text-sm text-destructive">{serverError}</p>}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/salespersons")}>
            キャンセル
          </Button>
          <Button type="submit" disabled={editForm.formState.isSubmitting}>
            保存する
          </Button>
        </div>
      </form>
    </Form>
  );
}
