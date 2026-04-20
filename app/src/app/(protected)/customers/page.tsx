import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CustomerListClient } from "./_components/CustomerListClient";

export default async function CustomerListPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const perPage = 20;

  const [total, customers] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.findMany({
      include: { assignedSalesperson: { select: { name: true } } },
      orderBy: { company: "asc" },
      take: perPage,
    }),
  ]);

  const initialItems = customers.map((c) => ({
    id: c.id,
    name: c.name,
    company: c.company,
    assigned_salesperson_name: c.assignedSalesperson.name,
  }));

  const initialPagination = {
    total,
    total_pages: Math.ceil(total / perPage) || 1,
    current_page: 1,
    per_page: perPage,
  };

  return (
    <CustomerListClient
      isManager={session.is_manager}
      initialItems={initialItems}
      initialPagination={initialPagination}
    />
  );
}
