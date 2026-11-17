import SubModuleView from "@/components/SubModuleView";

import { SUBMODULES } from "@/lib/submodules";

export function generateStaticParams() {
  return (SUBMODULES.investments ?? []).filter((s) => s.slug && !s.custom).map((s) => ({ sub: s.slug }));
}

export default async function Page({ params }: { params: Promise<{ sub: string }> }) {
  const { sub } = await params;
  return <SubModuleView moduleKey="investments" slug={sub} />;
}
