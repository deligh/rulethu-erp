import { EMPLOYEES } from "@/lib/seed";
import EmployeeClient from "./EmployeeClient";

// Pre-render a page for each seed employee (static export).
export function generateStaticParams() {
  return EMPLOYEES.map((e) => ({ id: e.id }));
}

export default function Page() {
  return <EmployeeClient />;
}
