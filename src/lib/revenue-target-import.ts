import { parse } from "csv-parse/sync";

export type RevenueTargetImportKind = "annual" | "monthly" | "weekly" | "branch_weekly";

export type RevenueTargetRow = {
  academic_year: string;
  branch_id: number;
  target_revenue: number;
  month?: string;
};

type BranchLookup = {
  branch_id: number;
  branch_name: string;
};

type AcademicYearLookup = {
  academic_year: string;
};

type AgentLookup = {
  agent_id: number;
  agent_name: string;
  agent_email: string | null;
};

export type RevenueTargetImportReport = {
  kind: RevenueTargetImportKind;
  inputRows: number;
  outputRows: number;
  invalidRows: number;
  duplicateRows: number;
  errors: { row: number; message: string }[];
};

function normalize(value: unknown) {
  return String(value ?? "").trim();
}

function parseAmount(value: unknown) {
  const clean = normalize(value).replaceAll(",", "");
  if (!clean) return null;

  const amount = Number(clean);
  return Number.isFinite(amount) && amount >= 0 && Number.isInteger(amount)
    ? amount
    : null;
}

export function academicMonthNumber(month: string) {
  const months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const index = months.findIndex((item) => item.toLowerCase() === month.toLowerCase());
  return index === -1 ? null : index + 1;
}

export function transformRevenueTargetCsv(
  csvText: string,
  kind: RevenueTargetImportKind,
  lookups: {
    branches: BranchLookup[];
    academicYears: AcademicYearLookup[];
  },
) {
  const records = parse(csvText, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];
  const errors: { row: number; message: string }[] = [];
  const branchByName = new Map(
    lookups.branches.map((branch) => [branch.branch_name.toLowerCase(), branch.branch_id]),
  );
  const branchIds = new Set(lookups.branches.map((branch) => branch.branch_id));
  const academicYears = new Set(lookups.academicYears.map((row) => row.academic_year));
  const seen = new Set<string>();
  const rows: RevenueTargetRow[] = [];

  records.forEach((record, index) => {
    const rowNumber = index + 2;
    const academicYear = normalize(record.academic_year ?? record.AcademicYear);
    const rawBranchId = normalize(record.branch_id ?? record.BranchId);
    const branchName = normalize(record.branch_name ?? record.BranchName);
    const branchId = rawBranchId
      ? Number(rawBranchId)
      : branchByName.get(branchName.toLowerCase());
    const targetRevenue = parseAmount(record.target_revenue ?? record.TargetRevenue);
    const month = normalize(record.month ?? record.Month);

    if (!academicYears.has(academicYear)) {
      errors.push({ row: rowNumber, message: `Academic year not found: ${academicYear}` });
      return;
    }
    if (!branchId || !branchIds.has(branchId)) {
      errors.push({ row: rowNumber, message: "Branch ID/name not found." });
      return;
    }
    if (targetRevenue === null) {
      errors.push({ row: rowNumber, message: "target_revenue must be an integer >= 0." });
      return;
    }

    const key =
      kind === "annual"
        ? `${academicYear}|${branchId}`
        : `${academicYear}|${branchId}|${month.toLowerCase()}`;
    if (seen.has(key)) {
      errors.push({ row: rowNumber, message: `Duplicate target: ${key}` });
      return;
    }
    seen.add(key);

    if (kind === "monthly" && academicMonthNumber(month) === null) {
      errors.push({ row: rowNumber, message: `Invalid month: ${month}` });
      return;
    }

    rows.push({
      academic_year: academicYear,
      branch_id: branchId,
      target_revenue: targetRevenue,
      ...(kind === "monthly" ? { month } : {}),
    });
  });

  const report: RevenueTargetImportReport = {
    kind,
    inputRows: records.length,
    outputRows: rows.length,
    invalidRows: errors.length,
    duplicateRows: errors.filter((error) => error.message.startsWith("Duplicate")).length,
    errors: errors.slice(0, 50),
  };

  return { rows, report };
}

export type AgentWeeklyTargetRow = {
  agent_id: number;
  academic_year: string;
  month: string;
  week_start: string;
  branch_id: number | null;
  target_revenue: number;
};

export type BranchWeeklyTargetRow = {
  academic_year: string;
  month: string;
  week_start: string;
  branch_id: number;
  target_revenue: number;
};

export function transformAgentWeeklyTargetCsv(
  csvText: string,
  lookups: {
    agents: AgentLookup[];
    branches: BranchLookup[];
    academicYears: AcademicYearLookup[];
  },
) {
  const records = parse(csvText, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];
  const errors: { row: number; message: string }[] = [];
  const branchByName = new Map(
    lookups.branches.map((branch) => [branch.branch_name.toLowerCase(), branch.branch_id]),
  );
  const branchIds = new Set(lookups.branches.map((branch) => branch.branch_id));
  const academicYears = new Set(lookups.academicYears.map((row) => row.academic_year));
  const agentsById = new Map(lookups.agents.map((agent) => [String(agent.agent_id), agent.agent_id]));
  const agentsByEmail = new Map<string, AgentLookup[]>();
  const agentsByName = new Map<string, AgentLookup[]>();
  for (const agent of lookups.agents) {
    const email = normalize(agent.agent_email).toLowerCase();
    if (email) agentsByEmail.set(email, [...(agentsByEmail.get(email) ?? []), agent]);
    const name = normalize(agent.agent_name).toLowerCase();
    if (name) agentsByName.set(name, [...(agentsByName.get(name) ?? []), agent]);
  }
  const seen = new Set<string>();
  const rows: AgentWeeklyTargetRow[] = [];

  records.forEach((record, index) => {
    const rowNumber = index + 2;
    const rawAgentId = normalize(record.agent_id ?? record.AgentId ?? record["Agent ID"]);
    const agentEmail = normalize(record.agent_email ?? record.AgentEmail ?? record["Agent Email"]);
    const agentName = normalize(record.agent_name ?? record.AgentName ?? record["Agent Name"]);
    let agentId = rawAgentId ? agentsById.get(rawAgentId) : undefined;

    if (!agentId && agentEmail) {
      const matches = agentsByEmail.get(agentEmail.toLowerCase()) ?? [];
      if (matches.length === 1) agentId = matches[0].agent_id;
      else if (matches.length > 1) {
        const namedMatches = matches.filter(
          (agent) => normalize(agent.agent_name).toLowerCase() === agentName.toLowerCase(),
        );
        if (namedMatches.length === 1) agentId = namedMatches[0].agent_id;
        else {
          errors.push({ row: rowNumber, message: `Agent email matches multiple agents: ${agentEmail}` });
          return;
        }
      }
    }
    if (!agentId && agentName) {
      const matches = agentsByName.get(agentName.toLowerCase()) ?? [];
      if (matches.length === 1) agentId = matches[0].agent_id;
      else if (matches.length > 1) {
        errors.push({ row: rowNumber, message: `Agent name matches multiple agents: ${agentName}` });
        return;
      }
    }
    if (!agentId) {
      errors.push({ row: rowNumber, message: "Agent ID, agent email, or agent name not found." });
      return;
    }

    const academicYear = normalize(record.academic_year ?? record.AcademicYear ?? record["Academic Year"]);
    if (!academicYears.has(academicYear)) {
      errors.push({ row: rowNumber, message: `Academic year not found: ${academicYear}` });
      return;
    }

    const month = normalize(record.month ?? record.Month ?? record.MonthName);
    if (academicMonthNumber(month.split(/\s+/)[0] ?? "") === null || !/^\w{3} \d{4}$/.test(month)) {
      errors.push({ row: rowNumber, message: `Invalid month: ${month}. Use e.g. Aug 2026.` });
      return;
    }

    const weekStart = normalize(record.week_start ?? record.weekStart ?? record.WeekStart ?? record["Week Start"]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      errors.push({ row: rowNumber, message: "week_start must use YYYY-MM-DD." });
      return;
    }
    const parsedWeekStart = new Date(`${weekStart}T00:00:00Z`);
    if (
      Number.isNaN(parsedWeekStart.getTime())
      || parsedWeekStart.toISOString().slice(0, 10) !== weekStart
      || parsedWeekStart.getUTCDay() !== 1
    ) {
      errors.push({ row: rowNumber, message: "week_start must be a Monday." });
      return;
    }

    const rawBranchId = normalize(record.branch_id ?? record.BranchId ?? record["Branch ID"]);
    const branchName = normalize(record.branch_name ?? record.BranchName ?? record["Branch Name"]);
    const branchId: number | null = rawBranchId
      ? Number(rawBranchId)
      : branchName
        ? branchByName.get(branchName.toLowerCase()) ?? null
        : null;
    if (branchId !== null && (!Number.isSafeInteger(branchId) || !branchIds.has(branchId) || branchId === 100)) {
      errors.push({ row: rowNumber, message: "Branch ID/name is invalid or excluded." });
      return;
    }

    const targetRevenue = parseAmount(record.target_revenue ?? record.TargetRevenue ?? record["Target Revenue"]);
    if (targetRevenue === null) {
      errors.push({ row: rowNumber, message: "target_revenue must be an integer >= 0." });
      return;
    }

    const key = `${agentId}|${weekStart}`;
    if (seen.has(key)) {
      errors.push({ row: rowNumber, message: `Duplicate weekly target: ${key}` });
      return;
    }
    seen.add(key);
    rows.push({ agent_id: agentId, academic_year: academicYear, month, week_start: weekStart, branch_id: branchId, target_revenue: targetRevenue });
  });

  return {
    rows,
    report: {
      kind: "weekly" as const,
      inputRows: records.length,
      outputRows: rows.length,
      invalidRows: errors.length,
      duplicateRows: errors.filter((error) => error.message.startsWith("Duplicate")).length,
      errors: errors.slice(0, 50),
    } satisfies RevenueTargetImportReport,
  };
}

export function transformBranchWeeklyTargetCsv(
  csvText: string,
  lookups: {
    branches: BranchLookup[];
    academicYears: AcademicYearLookup[];
  },
) {
  const records = parse(csvText, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];
  const errors: { row: number; message: string }[] = [];
  const branchByName = new Map(
    lookups.branches.map((branch) => [branch.branch_name.toLowerCase(), branch.branch_id]),
  );
  const branchIds = new Set(lookups.branches.map((branch) => branch.branch_id));
  const academicYears = new Set(lookups.academicYears.map((row) => row.academic_year));
  const seen = new Set<string>();
  const rows: BranchWeeklyTargetRow[] = [];

  records.forEach((record, index) => {
    const rowNumber = index + 2;
    const academicYear = normalize(record.academic_year ?? record.AcademicYear ?? record["Academic Year"]);
    if (!academicYears.has(academicYear)) {
      errors.push({ row: rowNumber, message: `Academic year not found: ${academicYear}` });
      return;
    }

    const month = normalize(record.month ?? record.Month ?? record.MonthName);
    if (academicMonthNumber(month.split(/\s+/)[0] ?? "") === null || !/^\w{3} \d{4}$/.test(month)) {
      errors.push({ row: rowNumber, message: `Invalid month: ${month}. Use e.g. Aug 2026.` });
      return;
    }

    const weekStart = normalize(record.week_start ?? record.weekStart ?? record.WeekStart ?? record["Week Start"]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      errors.push({ row: rowNumber, message: "week_start must use YYYY-MM-DD." });
      return;
    }
    const parsedWeekStart = new Date(`${weekStart}T00:00:00Z`);
    if (
      Number.isNaN(parsedWeekStart.getTime())
      || parsedWeekStart.toISOString().slice(0, 10) !== weekStart
      || parsedWeekStart.getUTCDay() !== 1
    ) {
      errors.push({ row: rowNumber, message: "week_start must be a Monday." });
      return;
    }

    const rawBranchId = normalize(record.branch_id ?? record.BranchId ?? record["Branch ID"]);
    const branchName = normalize(record.branch_name ?? record.BranchName ?? record["Branch Name"]);
    const branchId = rawBranchId
      ? Number(rawBranchId)
      : branchByName.get(branchName.toLowerCase());
    if (!branchId || !Number.isSafeInteger(branchId) || !branchIds.has(branchId) || branchId === 100) {
      errors.push({ row: rowNumber, message: "Branch ID/name is invalid or excluded." });
      return;
    }

    const targetRevenue = parseAmount(record.target_revenue ?? record.TargetRevenue ?? record["Target Revenue"]);
    if (targetRevenue === null) {
      errors.push({ row: rowNumber, message: "target_revenue must be an integer >= 0." });
      return;
    }

    const key = `${branchId}|${weekStart}`;
    if (seen.has(key)) {
      errors.push({ row: rowNumber, message: `Duplicate branch weekly target: ${key}` });
      return;
    }
    seen.add(key);
    rows.push({
      academic_year: academicYear,
      month,
      week_start: weekStart,
      branch_id: branchId,
      target_revenue: targetRevenue,
    });
  });

  return {
    rows,
    report: {
      kind: "branch_weekly" as const,
      inputRows: records.length,
      outputRows: rows.length,
      invalidRows: errors.length,
      duplicateRows: errors.filter((error) => error.message.startsWith("Duplicate")).length,
      errors: errors.slice(0, 50),
    } satisfies RevenueTargetImportReport,
  };
}
