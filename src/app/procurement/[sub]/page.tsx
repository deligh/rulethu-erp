import Redirect from "@/components/Redirect";

export function generateStaticParams() {
  return [{ sub: "_" }];
}

export default function Page() {
  return <Redirect to="/procurement" />;
}
