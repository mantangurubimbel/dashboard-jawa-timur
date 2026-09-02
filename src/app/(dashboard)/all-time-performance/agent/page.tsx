import { UsersRound } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { AgentCareerChart } from "@/components/agent-career-chart";
import { AgentCareerFilters } from "@/components/agent-career-filters";
import { AgentCareerTable } from "@/components/agent-career-table";
import { getAgentCareerData } from "@/lib/agent-career-data";
import { getDashboardBranchScope } from "@/lib/dashboard-access";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AllTimeAgentPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const value = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  };
  const agentIdValue = value("agentId");
  const parsedAgentId = agentIdValue ? Number(agentIdValue) : undefined;
  const agentId = parsedAgentId !== undefined && Number.isSafeInteger(parsedAgentId) ? parsedAgentId : undefined;
  const branchScope = await getDashboardBranchScope();
  const data = await getAgentCareerData({
    agentId,
    fromMonth: value("fromMonth") || undefined,
    toMonth: value("toMonth") || undefined,
  }, branchScope);

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <UsersRound className="h-6 w-6 text-teal-700" aria-hidden />
          <div>
            <p className="text-sm font-semibold uppercase text-teal-700">All Time Performance</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">Agent Career History</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600">Weekly target and revenue performance across the selected career period.</p>
      </header>

      <AgentCareerFilters
        agents={data.agents}
        months={data.months}
        values={{ agentId: agentIdValue, fromMonth: value("fromMonth"), toMonth: value("toMonth") }}
      />

      {!data.selectedAgent ? (
        <section className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Select an agent to view weekly career performance.
        </section>
      ) : (
        <>
          <p className="text-sm text-slate-600">Showing career performance for <span className="font-semibold text-slate-900">{data.selectedAgent.label}</span>.</p>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Total Target" value={formatCurrency(data.kpis.totalTarget)} detail="Selected career period" icon={UsersRound} />
            <MetricCard label="Total Revenue" value={formatCurrency(data.kpis.totalRevenue)} detail="Non-bulk buying revenue" icon={UsersRound} />
            <MetricCard label="Revenue to Target" value={data.kpis.achievement === null ? "-" : formatPercent(data.kpis.achievement)} detail="Total revenue / total target" icon={UsersRound} />
            <MetricCard label="New Transactions" value={formatNumber(data.kpis.newTransactions)} detail={`${formatNumber(data.kpis.newTxnBac)} New Txn BAC`} icon={UsersRound} />
            <MetricCard label="Branches Covered" value={formatNumber(data.kpis.branchesCovered)} detail="Unique assigned branches" icon={UsersRound} />
          </section>
          <AgentCareerChart rows={data.rows} />
          <AgentCareerTable rows={data.rows} branches={data.branches} />
        </>
      )}
    </div>
  );
}
