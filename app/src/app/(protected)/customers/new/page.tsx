import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CustomerForm } from "../_components/CustomerForm";

export default async function CustomerNewPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (!session.is_manager) {
    redirect("/customers");
  }

  const salespersons = await prisma.salesperson.findMany({
    where: { isManager: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return <CustomerForm mode="new" salespersons={salespersons} />;
}
