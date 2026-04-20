import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { SalespersonForm } from "../_components/SalespersonForm";

export default async function SalespersonNewPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.is_manager) redirect("/salespersons");

  const managers = await prisma.salesperson.findMany({
    where: { isManager: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return <SalespersonForm mode="new" managers={managers} />;
}
