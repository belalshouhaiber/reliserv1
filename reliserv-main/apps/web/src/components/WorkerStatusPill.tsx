import type { WorkerServiceStatus } from "../api/worker";

type Props = {
  status: WorkerServiceStatus;
};

const statusStyles: Record<WorkerServiceStatus, string> = {
  ONLINE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  BUSY: "bg-amber-100 text-amber-700 border-amber-200",
  OFFLINE: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function WorkerStatusPill({ status }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}
