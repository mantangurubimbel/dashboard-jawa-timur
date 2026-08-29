import { parse } from "csv-parse/sync";

export type RevenueTargetImportKind = "annual" | "monthly";

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
