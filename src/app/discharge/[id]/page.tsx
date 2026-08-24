import DischargeWorkspace from "@/components/discharge-workspace";

type DischargePageProps = {
  params: Promise<{ id: string }>;
};

export default async function DischargePage({ params }: DischargePageProps) {
  const { id } = await params;

  return <DischargeWorkspace dischargeId={id} />;
}
