import { RevenuePageContent } from "@/app/(dashboard)/revenue/page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function MonthlyRevenuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <RevenuePageContent
      searchParams={searchParams}
      eyebrow="Revenue Overview"
      title="Revenue Overview"
      showDataActions
    />
  );
}
