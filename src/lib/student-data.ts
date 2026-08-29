import { supabaseRestFetch, SupabaseFetchInit } from "@/lib/supabase-server";
import {
  DashboardBranchScope,
  getDashboardBranchScope,
  resolveScopedBranchId,
} from "@/lib/dashboard-access";

type StudentRow = {
  nis: string;
  payment_date: string;
  academic_year: string;
  user_serial: string;
  user_name: string;
  user_phone: string | null;
  birth_date: string | null;
  email: string | null;
  grade_id: number | null;
  npsn: string | null;
  rombel_id: number | null;
  agent_id: number | null;
  status: string;
  branch_id: number;
};

type BranchRow = {
  branch_id: number;
  branch_name: string;
  region_id: number | null;
};

type GradeRow = {
  grade_id: number;
  grade: string;
  level: string | null;
};

export type StudentFilterOptions = {
  academicYears: string[];
  branches: { id: string; label: string; regionId: string }[];
};

export type StudentOverviewData = {
  filters: StudentFilterOptions;
  kpis: {
    totalStudents: number;
    activeRombel: number;
    averageStudentsPerRombel: number;
    newStudents: number;
    repeatStudents: number;
    renewalRate: number;
  };
  monthlyStudents: { period: string; students: number }[];
  branchStudents: { name: string; students: number }[];
  gradeStudents: {
    name: string;
    students: number;
    lySamePeriod: number;
    l2ySamePeriod: number;
  }[];
  levelStudents: {
    name: string;
    students: number;
    lySamePeriod: number;
    l2ySamePeriod: number;
  }[];
  statusStudents: { name: string; students: number }[];
  weeklyStudentAdds: {
    weeks: { label: string; fromDate: string; toDate: string }[];
    rows: { branch: string; values: number[] }[];
  };
  branchSummary: {
    branch: string;
    current: number;
    lySamePeriod: number;
    lyEndOfYear: number;
    l2ySamePeriod: number;
    l2yEndOfYear: number;
  }[];
  recentStudents: {
    name: string;
    nis: string;
    academicYear: string;
    branch: string;
    status: string;
    paymentDate: string;
  }[];
  loyalStudents: {
    nis: string;
    name: string;
    branch: string;
    purchases: number;
    academicYears: string;
    userSerial: string;
    email: string;
    birthDate: string;
    history: {
      academicYear: string;
      grade: string;
      school: string;
      branch: string;
    }[];
  }[];
  schoolSmaSummary: {
    npsn: string;
    school: string;
    years: {
      academicYear: string;
      grade10: number;
      grade11: number;
      grade12: number;
      total: number;
    }[];
  }[];
  schoolPartner: {
    npsn: string;
    school: string;
    level: string;
    students: number;
    lySamePeriod: number;
    lyEndOfYear: number;
    l2ySamePeriod: number;
    l2yEndOfYear: number;
    history: {
      academicYear: string;
      counts: Record<string, number>;
      total: number;
    }[];
  }[];
};

export type StudentMonthlyPoint = {
  period: string;
  students: number;
};

export type StudentKpis = {
  totalStudents: number;
  activeRombel: number;
  averageStudentsPerRombel: number;
  repeatStudents: number;
  renewalRate: number;
};

export type StudentLevelPoint = {
  name: string;
  students: number;
};

export type StudentBranchPoint = {
  name: string;
  students: number;
  renewalRate: number;
};

type StudentSummaryRow = Pick<
  StudentRow,
  "payment_date" | "academic_year" | "status" | "nis" | "user_serial" | "rombel_id" | "branch_id" | "grade_id"
>;

async function fetchAll<T>(
  path: string,
  select: string,
  order?: string,
  init: SupabaseFetchInit = {},
  query: Record<string, string> = {},
) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const params = new URLSearchParams({
      select,
      limit: "1000",
      offset: String(offset),
      ...query,
    });
    if (order) params.set("order", order);
    const response = await supabaseRestFetch(`${path}?${params.toString()}`, init);
    if (!response.ok) throw new Error(`${path}: ${await response.text()}`);
    const page = (await response.json()) as T[];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

function monthLabel(date: string) {
  const [year, month] = date.split("-");
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${labels[Number(month) - 1]} ${year}`;
}

function sortMonth(left: string, right: string) {
  const monthIndexes = new Map([
    ["Jan", 0],
    ["Feb", 1],
    ["Mar", 2],
    ["Apr", 3],
    ["May", 4],
    ["Jun", 5],
    ["Jul", 6],
    ["Aug", 7],
    ["Sep", 8],
    ["Oct", 9],
    ["Nov", 10],
    ["Dec", 11],
  ]);
  const parse = (value: string) => {
    const [month, year] = value.split(" ");
    return Number(year) * 12 + (monthIndexes.get(month) ?? 0);
  };

  return parse(left) - parse(right);
}

function previousAcademicYear(academicYear: string, offset: number) {
  const match = academicYear.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return null;
  const startYear = Number(match[1]) - offset;
  return `${String((startYear + 100) % 100).padStart(2, "0")}/${String((startYear + 101) % 100).padStart(2, "0")}`;
}

function shiftYear(date: string, years: number) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return "";
  const shiftedYear = year - years;
  const lastDay = new Date(Date.UTC(shiftedYear, month, 0)).getUTCDate();
  return `${shiftedYear}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function academicYearOffset(academicYear: string, offset: number) {
  const match = academicYear.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return null;
  const startYear = Number(match[1]) - offset;
  return `${String((startYear + 100) % 100).padStart(2, "0")}/${String((startYear + 101) % 100).padStart(2, "0")}`;
}

function startOfWeek(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  const day = value.getUTCDay();
  value.setUTCDate(value.getUTCDate() - ((day + 6) % 7));
  return value.toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function weekLabel(fromDate: string, toDate: string) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const format = (date: string) => {
    const value = new Date(`${date}T00:00:00Z`);
    return `${value.getUTCDate()} ${monthNames[value.getUTCMonth()]}`;
  };
  return `${format(fromDate)} - ${format(toDate)}`;
}

export async function getStudentOverviewData(filters: {
  academicYear?: string;
  branchId?: number;
  fromDate?: string;
  toDate?: string;
  status?: string;
  level?: string;
} = {},
  branchScope?: DashboardBranchScope,
): Promise<StudentOverviewData> {
  const scope = branchScope ?? await getDashboardBranchScope();
  const effectiveBranchId = resolveScopedBranchId(scope, filters.branchId);
  const scopedFilters = { ...filters, branchId: effectiveBranchId };
  const cacheInit: SupabaseFetchInit = {
    next: { revalidate: 30, tags: ["students-overview"] },
  };
  const branchQuery: Record<string, string> = scope === null
    ? {}
    : scope.length
      ? { branch_id: `in.(${scope.join(",")})` }
      : { branch_id: "in.(-1)" };
  const [rawStudents, branches, grades, schoolRows] = await Promise.all([
    fetchAll<StudentRow>(
      "t_students",
      "nis,payment_date,academic_year,user_serial,user_name,user_phone,birth_date,email,grade_id,npsn,rombel_id,agent_id,status,branch_id",
      "payment_date.desc",
      cacheInit,
      branchQuery,
    ),
    fetchAll<BranchRow>("t_branch", "branch_id,branch_name,region_id", undefined, cacheInit, branchQuery),
    fetchAll<GradeRow>("t_grade", "grade_id,grade,level", undefined, cacheInit),
    fetchAll<{ npsn: string; name: string; level: string | null }>(
      "t_master_school",
      "npsn,name,level",
      undefined,
      cacheInit,
    ),
  ]);

  const students = rawStudents.filter((row) => row.status !== "Deleted");
  const academicYears = Array.from(new Set(students.map((row) => row.academic_year))).sort(
    (a, b) => b.localeCompare(a, undefined, { numeric: true }),
  );
  const currentAcademicYear =
    scopedFilters.academicYear && academicYears.includes(scopedFilters.academicYear)
      ? scopedFilters.academicYear
      : academicYears[0] ?? "26/27";
  const branchById = new Map(branches.map((row) => [row.branch_id, row]));
  const gradeById = new Map(grades.map((row) => [row.grade_id, row]));
  const schoolByNpsn = new Map(schoolRows.map((row) => [row.npsn, row.name]));
  const schoolLevelByNpsn = new Map(schoolRows.map((row) => [row.npsn, row.level ?? "-"]));
  const filtered = students.filter((row) => {
    const grade = row.grade_id === null ? null : gradeById.get(row.grade_id);
    return (
      row.academic_year === currentAcademicYear &&
      (scopedFilters.branchId === undefined || row.branch_id === scopedFilters.branchId) &&
      (!scopedFilters.fromDate || row.payment_date >= scopedFilters.fromDate) &&
      (!scopedFilters.toDate || row.payment_date <= scopedFilters.toDate) &&
      (!scopedFilters.status || row.status === scopedFilters.status) &&
      (!scopedFilters.level || grade?.level === scopedFilters.level)
    );
  });

  const nisCounts = new Map<string, number>();
  for (const row of filtered) {
    nisCounts.set(row.nis, (nisCounts.get(row.nis) ?? 0) + 1);
  }

  const userSerialCounts = new Map<string, number>();
  for (const row of students) {
    userSerialCounts.set(row.user_serial, (userSerialCounts.get(row.user_serial) ?? 0) + 1);
  }

  const uniqueStudents = new Map<string, StudentRow>();
  for (const row of filtered) {
    const current = uniqueStudents.get(row.nis);
    if (!current || row.payment_date > current.payment_date) uniqueStudents.set(row.nis, row);
  }

  const uniqueRows = Array.from(uniqueStudents.values());
  const totalStudents = uniqueRows.length;
  const activeRombel = new Set(
    filtered
      .filter((row) => row.rombel_id !== null)
      .map((row) => `${row.branch_id}:${row.rombel_id}`),
  ).size;
  const repeatStudents = uniqueRows.filter(
    (row) => (userSerialCounts.get(row.user_serial) ?? 0) > 1,
  ).length;
  const newStudents = uniqueRows.filter((row) => {
    const count = nisCounts.get(row.nis) ?? 0;
    return count === 1;
  }).length;

  const group = (key: (row: StudentRow) => string) => {
    const map = new Map<string, number>();
    for (const row of uniqueRows) {
      const name = key(row);
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, students]) => ({ name, students }))
      .sort((a, b) => b.students - a.students || a.name.localeCompare(b.name));
  };
  const gradeOrder = [
    "12 SMA + Gapyear",
    "11 SMA",
    "10 SMA",
    "9 SMP",
    "8 SMP",
    "7 SMP",
    "6 SD",
    "5 SD",
    "4 SD",
    "3 SD",
  ];
  const gradeCounts = new Map<string, number>();
  for (const row of uniqueRows) {
    const grade = row.grade_id === null ? null : gradeById.get(row.grade_id)?.grade;
    const category = grade === "12 SMA" || grade === "Gapyear" ? "12 SMA + Gapyear" : grade;
    if (category && gradeOrder.includes(category)) {
      gradeCounts.set(category, (gradeCounts.get(category) ?? 0) + 1);
    }
  }

  const monthlyMap = new Map<string, number>();
  for (const row of filtered) {
    const period = monthLabel(row.payment_date);
    monthlyMap.set(period, (monthlyMap.get(period) ?? 0) + 1);
  }

  const lyAcademicYear = previousAcademicYear(currentAcademicYear, 1);
  const l2yAcademicYear = previousAcademicYear(currentAcademicYear, 2);
  const currentRows = filtered;
  const currentEndDate = scopedFilters.toDate ||
    currentRows.map((row) => row.payment_date).sort().at(-1) ||
    "";
  const currentStartDate = scopedFilters.fromDate || `20${currentAcademicYear.slice(0, 2)}-07-01`;
  const lySamePeriodStart = shiftYear(currentStartDate, 1);
  const lySamePeriodEnd = shiftYear(currentEndDate, 1);
  const l2ySamePeriodStart = shiftYear(currentStartDate, 2);
  const l2ySamePeriodEnd = shiftYear(currentEndDate, 2);
  const comparisonRows = students.filter((row) => (
    (scopedFilters.branchId === undefined || row.branch_id === scopedFilters.branchId) &&
    (!scopedFilters.status || row.status === scopedFilters.status) &&
    (!scopedFilters.level || gradeById.get(row.grade_id ?? -1)?.level === scopedFilters.level)
  ));
  const groupByNpsn = (rows: StudentRow[]) => {
    const grouped = new Map<string, StudentRow[]>();
    for (const row of rows) {
      if (!row.npsn) continue;
      const current = grouped.get(row.npsn) ?? [];
      current.push(row);
      grouped.set(row.npsn, current);
    }
    return grouped;
  };
  const studentsByNpsn = groupByNpsn(students);
  const currentRowsByNpsn = groupByNpsn(currentRows);
  const comparisonRowsByNpsn = groupByNpsn(comparisonRows);
  const countByNpsn = (
    source: Map<string, StudentRow[]>,
    npsn: string,
    fromDate?: string,
    toDate?: string,
  ) =>
    new Set(
      (source.get(npsn) ?? [])
        .filter((row) =>
          (!fromDate || row.payment_date >= fromDate) &&
          (!toDate || row.payment_date <= toDate),
        )
        .map((row) => row.nis),
    ).size;
  const partnerNpsns = Array.from(new Set(currentRows.map((row) => row.npsn).filter(Boolean) as string[]));
  const schoolPartner = partnerNpsns
    .map((npsn) => {
      const level = schoolLevelByNpsn.get(npsn) ?? "-";
      const gradeLabels =
        level === "SMA"
          ? ["10 SMA", "11 SMA", "12 SMA", "Gapyear"]
          : level === "SMP"
            ? ["7 SMP", "8 SMP", "9 SMP"]
            : level === "SD"
              ? ["3 SD", "4 SD", "5 SD", "6 SD"]
              : [];
      const historyRows = students.filter((row) =>
        row.npsn === npsn && (!scopedFilters.branchId || row.branch_id === scopedFilters.branchId),
      );
      const history = Array.from(new Set(historyRows.map((row) => row.academic_year)))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
        .map((academicYear) => {
          const counts = Object.fromEntries(gradeLabels.map((label) => [label, 0]));
          const nises = new Set<string>();
          for (const row of studentsByNpsn.get(npsn) ?? []) {
            if (row.academic_year !== academicYear) continue;
            if (scopedFilters.branchId && row.branch_id !== scopedFilters.branchId) continue;
            const grade = row.grade_id === null ? null : gradeById.get(row.grade_id)?.grade;
            const gradeLabel = grade === "12 SMA" || grade === "Gapyear" ? "12 SMA" : grade;
            if (gradeLabel && gradeLabels.includes(gradeLabel)) {
              if (!nises.has(row.nis)) {
                counts[gradeLabel] += 1;
                nises.add(row.nis);
              }
            }
          }
          return { academicYear, counts, total: nises.size };
        });

      return {
        npsn,
        school: schoolByNpsn.get(npsn) ?? "School not found",
        level,
        students: countByNpsn(currentRowsByNpsn, npsn),
        lySamePeriod: countByNpsn(comparisonRowsByNpsn, npsn, lySamePeriodStart, lySamePeriodEnd),
        lyEndOfYear: countByNpsn(comparisonRowsByNpsn, npsn),
        l2ySamePeriod: countByNpsn(comparisonRowsByNpsn, npsn, l2ySamePeriodStart, l2ySamePeriodEnd),
        l2yEndOfYear: countByNpsn(comparisonRowsByNpsn, npsn, l2ySamePeriodStart, l2ySamePeriodEnd),
        history,
      };
    })
    .sort((a, b) => b.students - a.students || a.school.localeCompare(b.school));
  const currentStudentBySerial = new Map<string, StudentRow>();
  for (const row of currentRows) {
    const current = currentStudentBySerial.get(row.user_serial);
    if (!current || row.payment_date > current.payment_date) {
      currentStudentBySerial.set(row.user_serial, row);
    }
  }
  const rowsBySerial = new Map<string, StudentRow[]>();
  for (const row of students) {
    const current = rowsBySerial.get(row.user_serial) ?? [];
    current.push(row);
    rowsBySerial.set(row.user_serial, current);
  }
  const loyalStudents = Array.from(currentStudentBySerial.entries())
    .map(([userSerial, current]) => {
      const history = rowsBySerial.get(userSerial) ?? [];
      const academicYears = Array.from(new Set(history.map((row) => row.academic_year))).sort(
        (a, b) => a.localeCompare(b, undefined, { numeric: true }),
      );
      return {
        nis: current.nis,
        name: current.user_name,
        branch: branchById.get(current.branch_id)?.branch_name ?? "Branch not found",
        purchases: history.length,
        academicYears: academicYears.join(", "),
        userSerial,
        email: current.email ?? "-",
        birthDate: current.birth_date ?? "-",
        history: history
          .slice()
          .sort((a, b) => b.academic_year.localeCompare(a.academic_year, undefined, { numeric: true }))
          .map((row) => ({
            academicYear: row.academic_year,
            grade: row.grade_id === null ? "-" : gradeById.get(row.grade_id)?.grade ?? "-",
            school: row.npsn ? schoolByNpsn.get(row.npsn) ?? "-" : "-",
            branch: branchById.get(row.branch_id)?.branch_name ?? "Branch not found",
          })),
      };
    })
    .filter((row) => row.purchases > 1)
    .sort((a, b) => b.purchases - a.purchases || a.name.localeCompare(b.name));
  const comparisonYears = [0, 1, 2]
    .map((offset) => academicYearOffset(currentAcademicYear, offset))
    .filter((year): year is string => Boolean(year));
  const schoolSmaMap = new Map<string, {
    npsn: string;
    school: string;
    years: Map<string, { grade10: Set<string>; grade11: Set<string>; grade12: Set<string> }>;
  }>();
  for (const row of students) {
    const yearIndex = comparisonYears.indexOf(row.academic_year);
    if (yearIndex === -1) continue;
    if (scopedFilters.branchId !== undefined && row.branch_id !== scopedFilters.branchId) continue;
    if (scopedFilters.fromDate && row.payment_date < (yearIndex === 0 ? scopedFilters.fromDate : shiftYear(scopedFilters.fromDate, yearIndex))) continue;
    if (scopedFilters.toDate && row.payment_date > (yearIndex === 0 ? scopedFilters.toDate : shiftYear(scopedFilters.toDate, yearIndex))) continue;
    if (!row.npsn) continue;
    const grade = row.grade_id === null ? null : gradeById.get(row.grade_id)?.grade;
    const gradeKey = grade === "10 SMA" ? "grade10" : grade === "11 SMA" ? "grade11" : grade === "12 SMA" || grade === "Gapyear" ? "grade12" : null;
    if (!gradeKey) continue;
    const current = schoolSmaMap.get(row.npsn) ?? {
      npsn: row.npsn,
      school: schoolByNpsn.get(row.npsn) ?? "School not found",
      years: new Map(),
    };
    const year = current.years.get(row.academic_year) ?? {
      grade10: new Set<string>(),
      grade11: new Set<string>(),
      grade12: new Set<string>(),
    };
    year[gradeKey].add(row.nis);
    current.years.set(row.academic_year, year);
    schoolSmaMap.set(row.npsn, current);
  }
  const schoolSmaSummary = Array.from(schoolSmaMap.values())
    .map((school) => ({
      npsn: school.npsn,
      school: school.school,
      years: comparisonYears.map((academicYear) => {
        const year = school.years.get(academicYear);
        const grade10 = year?.grade10.size ?? 0;
        const grade11 = year?.grade11.size ?? 0;
        const grade12 = year?.grade12.size ?? 0;
        return { academicYear, grade10, grade11, grade12, total: grade10 + grade11 + grade12 };
      }),
    }))
    .filter((school) => school.years.some((year) => year.total > 0))
    .sort((a, b) => {
      const aTotal = a.years[0]?.total ?? 0;
      const bTotal = b.years[0]?.total ?? 0;
      return bTotal - aTotal || a.school.localeCompare(b.school);
    });
  const periodStart = scopedFilters.fromDate || `20${currentAcademicYear.slice(0, 2)}-07-01`;
  const periodEnd = scopedFilters.toDate ||
    currentRows.map((row) => row.payment_date).sort().at(-1) ||
    periodStart;
  const firstWeekStart = startOfWeek(periodStart);
  const lastWeekStart = startOfWeek(periodEnd);
  const weeklyWeeks: { label: string; fromDate: string; toDate: string }[] = [];
  for (let cursor = firstWeekStart; cursor <= lastWeekStart; cursor = addDays(cursor, 7)) {
    const toDate = addDays(cursor, 6);
    weeklyWeeks.push({
      label: weekLabel(cursor, toDate),
      fromDate: cursor,
      toDate,
    });
  }
  const weeklyBranchMap = new Map<number, number[]>();
  for (const row of currentRows) {
    const weekIndex = Math.floor(
      (Date.parse(`${row.payment_date}T00:00:00Z`) -
        Date.parse(`${firstWeekStart}T00:00:00Z`)) /
        (7 * 24 * 60 * 60 * 1000),
    );
    if (weekIndex < 0 || weekIndex >= weeklyWeeks.length) continue;
    const values = weeklyBranchMap.get(row.branch_id) ?? Array(weeklyWeeks.length).fill(0);
    values[weekIndex] += 1;
    weeklyBranchMap.set(row.branch_id, values);
  }
  const weeklyStudentAdds = {
    weeks: weeklyWeeks,
    rows: Array.from(weeklyBranchMap.entries())
      .map(([branchId, values]) => ({
        branch: branchById.get(branchId)?.branch_name ?? "Branch not found",
        values,
      }))
      .sort((a, b) => a.branch.localeCompare(b.branch)),
  };
  const comparisonBase = students.filter((row) => (
    (scopedFilters.branchId === undefined || row.branch_id === scopedFilters.branchId) &&
    (!scopedFilters.status || row.status === scopedFilters.status) &&
    (!scopedFilters.level || gradeById.get(row.grade_id ?? -1)?.level === scopedFilters.level)
  ));
  const countUnique = (rows: StudentRow[]) => new Set(rows.map((row) => row.nis)).size;
  const gradeCategory = (row: StudentRow) => {
    const grade = row.grade_id === null ? null : gradeById.get(row.grade_id)?.grade;
    return grade === "12 SMA" || grade === "Gapyear" ? "12 SMA + Gapyear" : grade;
  };
  const countGrade = (rows: StudentRow[], gradeName: string) =>
    countUnique(rows.filter((row) => gradeCategory(row) === gradeName));
  const levelCategory = (row: StudentRow) =>
    row.grade_id === null ? "Unmapped" : gradeById.get(row.grade_id)?.level ?? "Unmapped";
  const countLevel = (rows: StudentRow[], levelName: string) =>
    countUnique(rows.filter((row) => levelCategory(row) === levelName));
  const lySamePeriodRows = comparisonBase.filter((row) =>
    row.academic_year === lyAcademicYear && row.payment_date <= lySamePeriodEnd,
  );
  const l2ySamePeriodRows = comparisonBase.filter((row) =>
    row.academic_year === l2yAcademicYear && row.payment_date <= l2ySamePeriodEnd,
  );
  const levelOrder = ["SMA", "SMP", "SD", "Unmapped"];
  const levelCounts = new Map(group(levelCategory).map((row) => [row.name, row.students]));
  const levelStudents = levelOrder
    .filter((level) => levelCounts.has(level))
    .map((name) => ({
      name,
      students: levelCounts.get(name) ?? 0,
      lySamePeriod: countLevel(lySamePeriodRows, name),
      l2ySamePeriod: countLevel(l2ySamePeriodRows, name),
    }));
  const branchIds = Array.from(new Set([
    ...currentRows.map((row) => row.branch_id),
    ...comparisonBase.map((row) => row.branch_id),
  ]));
  const branchSummary = branchIds
    .map((branchId) => {
      const branchRows = comparisonBase.filter((row) => row.branch_id === branchId);
      return {
        branch: branchById.get(branchId)?.branch_name ?? "Branch not found",
        current: countUnique(currentRows.filter((row) => row.branch_id === branchId)),
        lySamePeriod: countUnique(branchRows.filter((row) =>
          row.academic_year === lyAcademicYear &&
          row.payment_date <= lySamePeriodEnd,
        )),
        lyEndOfYear: countUnique(branchRows.filter((row) => row.academic_year === lyAcademicYear)),
        l2ySamePeriod: countUnique(branchRows.filter((row) =>
          row.academic_year === l2yAcademicYear &&
          row.payment_date <= l2ySamePeriodEnd,
        )),
        l2yEndOfYear: countUnique(branchRows.filter((row) => row.academic_year === l2yAcademicYear)),
      };
    })
    .sort((a, b) => b.current - a.current || a.branch.localeCompare(b.branch));

  return {
    filters: {
      academicYears,
      branches: branches
        .filter((row) => row.region_id !== null)
        .sort((a, b) => a.branch_name.localeCompare(b.branch_name))
        .map((row) => ({
          id: String(row.branch_id),
          label: row.branch_name,
          regionId: String(row.region_id),
        })),
    },
    kpis: {
      totalStudents,
      activeRombel,
      averageStudentsPerRombel: activeRombel ? totalStudents / activeRombel : 0,
      newStudents,
      repeatStudents,
      renewalRate: totalStudents ? repeatStudents / totalStudents : 0,
    },
    monthlyStudents: Array.from(monthlyMap.entries())
      .map(([period, studentCount]) => ({ period, students: studentCount }))
      .sort((a, b) => sortMonth(a.period, b.period)),
    branchStudents: group((row) => branchById.get(row.branch_id)?.branch_name ?? "Branch not found").slice(0, 12),
    gradeStudents: gradeOrder
      .map((name) => ({
        name,
        students: gradeCounts.get(name) ?? 0,
        lySamePeriod: countGrade(lySamePeriodRows, name),
        l2ySamePeriod: countGrade(l2ySamePeriodRows, name),
      }))
      .filter((row) => row.students > 0),
    levelStudents,
    statusStudents: group((row) => row.status),
    weeklyStudentAdds,
    branchSummary,
    recentStudents: filtered
      .sort((a, b) => b.payment_date.localeCompare(a.payment_date))
      .slice(0, 20)
      .map((row) => ({
        name: row.user_name,
        nis: row.nis,
        academicYear: row.academic_year,
        branch: branchById.get(row.branch_id)?.branch_name ?? "Branch not found",
        status: row.status,
        paymentDate: row.payment_date,
      })),
    loyalStudents,
    schoolSmaSummary,
    schoolPartner,
  };
}

export async function getStudentMonthlyData(
  academicYear?: string | null,
  branchScope?: DashboardBranchScope,
): Promise<StudentMonthlyPoint[]> {
  const rows = await fetchStudentSummaryRows(branchScope);
  return buildStudentMonthlyData(rows, academicYear);
}

async function fetchStudentSummaryRows(branchScope?: DashboardBranchScope) {
  const scope = branchScope ?? await getDashboardBranchScope();
  if (scope !== null && !scope.length) return [] as StudentSummaryRow[];
  const rows: StudentSummaryRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const params = new URLSearchParams({
      select: "payment_date,academic_year,status,nis,user_serial,rombel_id,branch_id,grade_id",
      order: "payment_date.asc",
      limit: "1000",
      offset: String(offset),
      status: "neq.Deleted",
    });
    if (scope !== null) params.set("branch_id", `in.(${scope.join(",")})`);
    const response = await supabaseRestFetch(`t_students?${params.toString()}`, {
      next: { revalidate: 30, tags: ["students-overview"] },
    });
    if (!response.ok) {
      throw new Error(`t_students: ${await response.text()}`);
    }

    const page = (await response.json()) as StudentSummaryRow[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

function buildStudentMonthlyData(
  rows: StudentSummaryRow[],
  academicYear?: string | null,
): StudentMonthlyPoint[] {
  const selectedRows = academicYear
    ? rows.filter((row) => row.academic_year === academicYear)
    : rows.filter((row) => row.academic_year === rows.at(-1)?.academic_year);
  const monthlyMap = new Map<string, number>();
  for (const row of selectedRows) {
    const period = monthLabel(row.payment_date);
    monthlyMap.set(period, (monthlyMap.get(period) ?? 0) + 1);
  }

  return Array.from(monthlyMap.entries())
    .map(([period, students]) => ({ period, students }))
    .sort((a, b) => sortMonth(a.period, b.period));
}

export async function getStudentKpis(
  academicYear: string,
  branchScope?: DashboardBranchScope,
): Promise<StudentKpis> {
  const rows = await fetchStudentSummaryRows(branchScope);
  return buildStudentKpis(rows, academicYear);
}

function buildStudentKpis(
  rows: StudentSummaryRow[],
  academicYear: string,
): StudentKpis {
  const currentRows = rows.filter((row) => row.academic_year === academicYear);
  const uniqueNis = new Set(currentRows.map((row) => row.nis));
  const activeRombel = new Set(
    currentRows
      .filter((row) => row.rombel_id !== null)
      .map((row) => `${row.branch_id}:${row.rombel_id}`),
  ).size;
  const serialCounts = new Map<string, number>();
  for (const row of rows) {
    serialCounts.set(row.user_serial, (serialCounts.get(row.user_serial) ?? 0) + 1);
  }
  const currentSerials = new Map<string, string>();
  for (const row of currentRows) {
    currentSerials.set(row.nis, row.user_serial);
  }
  const repeatStudents = Array.from(currentSerials.values()).filter(
    (userSerial) => (serialCounts.get(userSerial) ?? 0) > 1,
  ).length;
  const totalStudents = uniqueNis.size;

  return {
    totalStudents,
    activeRombel,
    averageStudentsPerRombel: activeRombel ? totalStudents / activeRombel : 0,
    repeatStudents,
    renewalRate: totalStudents ? repeatStudents / totalStudents : 0,
  };
}

export async function getStudentRevenueSummary(
  academicYear: string,
  branchScope?: DashboardBranchScope,
) {
  const scope = branchScope ?? await getDashboardBranchScope();
  const branchQuery: Record<string, string> = scope === null
    ? {}
    : scope.length
      ? { branch_id: `in.(${scope.join(",")})` }
      : { branch_id: "in.(-1)" };
  const [rows, grades, branches] = await Promise.all([
    fetchStudentSummaryRows(scope),
    fetchAll<GradeRow>("t_grade", "grade_id,grade,level", undefined, {
      next: { revalidate: 30, tags: ["students-overview"] },
    }),
    fetchAll<BranchRow>("t_branch", "branch_id,branch_name,region_id", undefined, {
      next: { revalidate: 30, tags: ["students-overview"] },
    }, branchQuery),
  ]);
  const gradeById = new Map(grades.map((row) => [row.grade_id, row]));
  const branchById = new Map(branches.map((row) => [row.branch_id, row.branch_name]));
  const levelCounts = new Map<string, Set<string>>();
  const gradeCounts = new Map<string, Set<string>>();
  const branchStudents = new Map<number, Set<string>>();
  const branchSerials = new Map<number, Set<string>>();
  const serialCounts = new Map<string, number>();
  for (const row of rows) {
    serialCounts.set(row.user_serial, (serialCounts.get(row.user_serial) ?? 0) + 1);
  }
  for (const row of rows) {
    if (row.academic_year !== academicYear) continue;
    const level = gradeById.get(row.grade_id ?? -1)?.level ?? "Unmapped";
    const grade = gradeById.get(row.grade_id ?? -1)?.grade ?? "Unmapped";
    const gradeNises = gradeCounts.get(grade) ?? new Set<string>();
    gradeNises.add(row.nis);
    gradeCounts.set(grade, gradeNises);
    const nises = levelCounts.get(level) ?? new Set<string>();
    nises.add(row.nis);
    levelCounts.set(level, nises);
    const branchNises = branchStudents.get(row.branch_id) ?? new Set<string>();
    branchNises.add(row.nis);
    branchStudents.set(row.branch_id, branchNises);
    const branchRepeatSerials = branchSerials.get(row.branch_id) ?? new Set<string>();
    if ((serialCounts.get(row.user_serial) ?? 0) > 1) {
      branchRepeatSerials.add(row.user_serial);
    }
    branchSerials.set(row.branch_id, branchRepeatSerials);
  }

  return {
    monthlyData: buildStudentMonthlyData(rows, academicYear),
    kpis: buildStudentKpis(rows, academicYear),
    levelStudents: ["SMA", "SMP", "SD", "Unmapped"]
      .filter((level) => levelCounts.has(level))
      .map((name) => ({
        name,
        students: levelCounts.get(name)?.size ?? 0,
      })),
    gradeStudents: Array.from(gradeCounts.entries())
      .map(([name, nises]) => ({ name, students: nises.size, lySamePeriod: 0, l2ySamePeriod: 0 }))
      .sort((a, b) => b.students - a.students || a.name.localeCompare(b.name)),
    branchStudents: Array.from(branchStudents.entries())
      .map(([branchId, nises]) => ({
        name: branchById.get(branchId) ?? "Branch not found",
        students: nises.size,
        renewalRate: nises.size
          ? (branchSerials.get(branchId)?.size ?? 0) / nises.size
          : 0,
      }))
      .sort((a, b) => b.students - a.students || a.name.localeCompare(b.name)),
  };
}
