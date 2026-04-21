import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { SalespersonForm } from "../../_components/SalespersonForm";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SalespersonEditPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.is_manager) redirect("/salespersons");

  const { id: rawId } = await params;
  const salespersonId = Number(rawId);
  if (!Number.isInteger(salespersonId) || salespersonId <= 0) notFound();

  const [salesperson, managers] = await Promise.all([
    prisma.salesperson.findUnique({ where: { id: salespersonId } }),
    prisma.salesperson.findMany({
      where: { isManager: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!salesperson) notFound();

  const defaultValues = {
    name: salesperson.name,
    email: salesperson.email,
    department: salesperson.department ?? "",
    manager_id: String(salesperson.managerId ?? ""),
    is_manager: salesperson.isManager ? ("true" as const) : ("false" as const),
  };

  return (
    <SalespersonForm
      mode="edit"
      salespersonId={salesperson.id}
      managers={managers}
      defaultValues={defaultValues}
    />
  );
}
