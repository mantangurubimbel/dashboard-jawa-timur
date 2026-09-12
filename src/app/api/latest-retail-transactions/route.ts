import { getLatestRetailTransactions } from "@/lib/analytics-data";
import { getDashboardUserContext } from "@/lib/dashboard-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await getDashboardUserContext();
  if (!context.user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (!context.hasDashboardAccess) return Response.json({ error: "Dashboard access is not enabled." }, { status: 403 });

  const search = new URL(request.url).searchParams.get("search") ?? "";
  try {
    const data = await getLatestRetailTransactions(context.branchScope, search);
    return Response.json({ data });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load latest retail transactions." },
      { status: 500 },
    );
  }
}
