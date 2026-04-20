import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { SalespersonListClient } from "./_components/SalespersonListClient";

export default async function SalespersonListPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (!session.is_manager) {
    redirect("/");
  }

  const perPage = 20;

  const [total, salespersons] = await Promise.all([
    prisma.salesperson.count(),
    prisma.salesperson.findMany({
      include: { manager: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: perPage,
    }),
  ]);

  const initialItems = salespersons.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    manager_name: s.manager?.name ?? null,
  }));

  const initialPagination = {
    total,
    total_pages: Math.ceil(total / perPage) || 1,
    current_page: 1,
    per_page: perPage,
  };

  return (
    <SalespersonListClient
      initialItems={initialItems}
      initialPagination={initialPagination}
    />
  );
}
