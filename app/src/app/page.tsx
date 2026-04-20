// NOTE: This placeholder must be deleted to resolve the route conflict with
// app/(protected)/page.tsx. Both resolve to "/" in Next.js App Router.
// Until deleted, this file redirects to /login as a fallback.
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/login");
}
