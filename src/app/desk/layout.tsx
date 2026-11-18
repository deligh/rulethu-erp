import DeskShell from "@/components/desk/DeskShell";

export const metadata = {
  title: "Minister's Desk",
  description: "Chief-of-staff platform: daily brief, commitments, calendar, meeting recorder, investment pipeline, drafter and Economic Lab.",
};

export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return <DeskShell>{children}</DeskShell>;
}
