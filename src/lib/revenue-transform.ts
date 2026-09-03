import { parse } from "csv-parse/sync";

export type RevenueTxnInsert = {
  payment_date: string;
  month: string;
  invoice: string;
  grade_id: number | null;
  product_id: number | null;
  agent_id: number | null;
  branch_destination_id: number | null;
  branch_id: number | null;
  is_newtxn: boolean;
  is_fullpayment: boolean;
  academic_year: string | null;
  npsn: string | null;
  revenue: number | null;
  is_bulkbuying: boolean;
};

export type RevenueLookup = {
  grades: { grade_id: number; grade: string }[];
  products: { product_id: number; product_code: string }[];
  agents: { agent_id: number; agent_name: string; agent_email: string | null }[];
  branches: { branch_id: number; branch_name: string }[];
  academicYears: { academic_year: string }[];
  schools: { npsn: string }[];
};

export type RevenueRawRow = Record<string, string>;

export type InvalidRevenueRow = {
  rowNumber: number;
  raw: RevenueRawRow;
  missingFields: string[];
};

export type TransformReport = {
  inputRows: number;
  filteredRows: number;
  outputRows: number;
  invalidRows: number;
  oecDiscountOverrideRows: number;
  issues: Record<string, { value: string; count: number }[]>;
};

const monthNames = new Map([
  ["jan", "Jan"], ["january", "Jan"], ["feb", "Feb"], ["february", "Feb"],
  ["mar", "Mar"], ["march", "Mar"], ["apr", "Apr"], ["april", "Apr"],
  ["may", "May"], ["jun", "Jun"], ["june", "Jun"], ["jul", "Jul"],
  ["july", "Jul"], ["aug", "Aug"], ["august", "Aug"], ["sep", "Sep"],
  ["sept", "Sep"], ["september", "Sep"], ["oct", "Oct"], ["october", "Oct"],
  ["nov", "Nov"], ["november", "Nov"], ["dec", "Dec"], ["december", "Dec"],
]);

const monthNumbers = new Map([
  ["Jan", "01"], ["Feb", "02"], ["Mar", "03"], ["Apr", "04"],
  ["May", "05"], ["Jun", "06"], ["Jul", "07"], ["Aug", "08"],
  ["Sep", "09"], ["Oct", "10"], ["Nov", "11"], ["Dec", "12"],
]);

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function nullable(value: unknown) {
  const clean = String(value ?? "").trim();
  return !clean || clean.toLowerCase() === "null" ? "" : clean;
}

function parseEnglishDate(value: unknown) {
  const match = nullable(value).match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return "";

  const month = monthNames.get(match[2].toLowerCase());
  if (!month) return "";

  return `${match[3]}-${monthNumbers.get(month)}-${match[1].padStart(2, "0")}`;
}

function normalizeMonth(value: unknown) {
  const match = nullable(value).match(/^(?:\d{1,2}\s+)?([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return "";

  const month = monthNames.get(match[1].toLowerCase());
  return month ? `${month} ${match[2]}` : "";
}

function parseRevenue(value: unknown) {
  const clean = nullable(value).replaceAll(",", "");
  if (!clean) return null;

  const amount = Number(clean);
  return Number.isFinite(amount) ? Math.round(amount) : null;
}

function addIssue(
  issues: Record<string, { value: string; count: number }[]>,
  type: string,
  value: unknown,
) {
  const clean = nullable(value);
  if (!clean) return;

  const list = issues[type] ?? (issues[type] = []);
  const current = list.find((item) => item.value === clean);
  if (current) current.count += 1;
  else list.push({ value: clean, count: 1 });
}

function productIdForSourceValue(value: unknown, productByCode: Map<string, number>) {
  const mapping = new Map([
    ["brain academy", "bac"],
    ["brain academy online regular", "bao"],
    ["brain academy online premium", "bao"],
    ["brain academy online elite", "bao"],
    ["ruangguru private offline", "rgp"],
    ["ruangguru private online", "rgp"],
    ["ruanguji", "ruanguji"],
    ["ruangbelajar", "rb"],
    ["math champs", "mc"],
    ["mathchamps offline", "mc"],
    ["english academy center", "eac"],
    ["english academy", "eac"],
    ["skill academy offline", "sa"],
    ["skill academy", "sa"],
    ["schoters", "schoters"],
    ["kalananti", "kalananti"],
    ["others", "others"],
  ]);

  const code = mapping.get(normalize(value));
  return code ? productByCode.get(code) ?? null : null;
}

export function transformRevenueCsv(
  csvText: string,
  startDate: string,
  lookup: RevenueLookup,
) {
  const rawRows = parse(csvText, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];

  const requiredColumns = [
    "Payment Date",
    "Month",
    "Invoice",
    "Class Name",
    "New Product Type",
    "Agent Name",
    "Agent Email",
    "Product Cluster",
    "Cluster",
    "Payment Category",
    "Payment Option",
    "Academic Year",
    "school_npsn",
    "Revenue",
  ];
  const missingColumn = requiredColumns.find(
    (column) => !Object.prototype.hasOwnProperty.call(rawRows[0] ?? {}, column),
  );

  if (missingColumn) {
    throw new Error(`Required column not found: ${missingColumn}`);
  }

  return transformRevenueRows(
    rawRows,
    startDate,
    lookup,
  );
}

export function transformRevenueRows(
  rawRows: RevenueRawRow[],
  startDate: string,
  lookup: RevenueLookup,
) {

  const gradeByName = new Map(lookup.grades.map((row) => [normalize(row.grade), row.grade_id]));
  const productByCode = new Map(
    lookup.products.map((row) => [normalize(row.product_code), row.product_id]),
  );
  const branchByName = new Map(
    lookup.branches.map((row) => [normalize(row.branch_name), row.branch_id]),
  );
  const academicYearSet = new Set(lookup.academicYears.map((row) => row.academic_year));
  const schoolSet = new Set(lookup.schools.map((row) => row.npsn));
  const oecAgent = lookup.agents.find(
    (row) => normalize(row.agent_name) === normalize("OEC/Others"),
  );

  if (!oecAgent) {
    throw new Error('Agent "OEC/Others" was not found in t_agent.');
  }

  const agentsByEmail = new Map<string, RevenueLookup["agents"]>();
  for (const agent of lookup.agents) {
    const key = String(agent.agent_email ?? "").trim().toLowerCase();
    if (!key) continue;
    const current = agentsByEmail.get(key) ?? [];
    current.push(agent);
    agentsByEmail.set(key, current);
  }

  const issues: TransformReport["issues"] = {};
  const filteredRows = rawRows
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => {
      const paymentDate = parseEnglishDate(row["Payment Date"]);
      return paymentDate && paymentDate >= startDate;
    });

  const invalidRows: InvalidRevenueRow[] = [];
  const validRows = filteredRows.filter(({ row, rowNumber }) => {
    const missingFields = ["Agent Name", "Agent Email", "Cluster"].filter(
      (field) => !nullable(row[field]),
    );
    if (missingFields.length) {
      invalidRows.push({ rowNumber, raw: row, missingFields });
      return false;
    }
    return true;
  });
  let oecDiscountOverrideRows = 0;

  const rows: RevenueTxnInsert[] = validRows.map(({ row }) => {
    const paymentDate = parseEnglishDate(row["Payment Date"]);
    const month = normalizeMonth(row.Month);
    const branchId = branchByName.get(normalize(row.Cluster)) ?? null;
    const destinationValue = nullable(row["Product Cluster"]);
    const destinationBranchId = branchByName.get(normalize(destinationValue)) ?? null;
    const gradeValue = nullable(row["Class Name"]);
    const gradeId = gradeByName.get(normalize(gradeValue)) ?? null;
    const productId = productIdForSourceValue(row["New Product Type"], productByCode);
    const agentName = nullable(row["Agent Name"]);
    const agentEmail = nullable(row["Agent Email"]);
    const candidates = agentsByEmail.get(agentEmail.toLowerCase()) ?? [];
    const nameCandidate = candidates.find(
      (candidate) => normalize(candidate.agent_name) === normalize(agentName),
    );
    const hasOecDiscount = normalize(row["Discount Code"]).includes("oec");
    const agentId = hasOecDiscount
      ? oecAgent.agent_id
      : candidates.length === 1
        ? candidates[0].agent_id
        : nameCandidate?.agent_id ?? null;
    const schoolNpsn = nullable(row.school_npsn);
    const paymentCategory = nullable(row["Payment Category"]);
    const paymentOption = nullable(row["Payment Option"]);
    const revenue = parseRevenue(row.Revenue);

    if (!paymentDate) addIssue(issues, "invalidPaymentDate", row["Payment Date"]);
    if (!month) addIssue(issues, "invalidMonth", row.Month);
    if (gradeValue && gradeId === null) addIssue(issues, "unmappedGrade", gradeValue);
    if (productId === null) addIssue(issues, "unmappedProduct", row["New Product Type"]);
    if (agentEmail && agentId === null) addIssue(issues, candidates.length > 1 ? "ambiguousAgent" : "unmappedAgent", agentEmail);
    if (destinationValue && destinationBranchId === null) addIssue(issues, "unmappedDestinationBranch", destinationValue);
    if (branchId === null) addIssue(issues, "unmappedBranch", row.Cluster);
    if (!academicYearSet.has(row["Academic Year"])) addIssue(issues, "unmappedAcademicYear", row["Academic Year"]);
    if (schoolNpsn && !schoolSet.has(schoolNpsn)) addIssue(issues, "unmappedSchool", schoolNpsn);
    if (revenue === null) addIssue(issues, "invalidRevenue", row.Revenue);
    if (hasOecDiscount) oecDiscountOverrideRows += 1;

    return {
      payment_date: paymentDate,
      month,
      invoice: nullable(row.Invoice),
      grade_id: gradeId,
      product_id: productId,
      agent_id: agentId,
      branch_destination_id: destinationBranchId,
      branch_id: branchId,
      is_newtxn: paymentCategory === "NEW_TXN" || paymentCategory === "DOWN_PAYMENT",
      is_fullpayment: paymentOption === "FULL_PAYMENT",
      academic_year: nullable(row["Academic Year"]) || null,
      npsn: schoolNpsn && schoolSet.has(schoolNpsn) ? schoolNpsn : null,
      revenue,
      is_bulkbuying: paymentCategory === "BULK_BUYING",
    };
  });

  return {
    rows,
    report: {
      inputRows: rawRows.length,
      filteredRows: filteredRows.length,
      outputRows: rows.length,
      invalidRows: invalidRows.length,
      oecDiscountOverrideRows,
      issues,
    } satisfies TransformReport,
    invalidRows,
  };
}
