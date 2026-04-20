import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CustomerForm } from "../../_components/CustomerForm";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerEditPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (!session.is_manager) {
    redirect("/customers");
  }

  const { id: rawId } = await params;
  const customerId = Number(rawId);
  if (!Number.isInteger(customerId) || customerId <= 0) {
    notFound();
  }

  const [customer, salespersons] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    prisma.salesperson.findMany({
      where: { isManager: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!customer) {
    notFound();
  }

  const defaultValues = {
    name: customer.name,
    company: customer.company,
    phone: customer.phone ?? "",
    address: customer.address ?? "",
    assigned_salesperson_id: String(customer.assignedSalespersonId),
  };

  return (
    <CustomerForm
      mode="edit"
      customerId={customer.id}
      salespersons={salespersons}
      defaultValues={defaultValues}
    />
  );
}
