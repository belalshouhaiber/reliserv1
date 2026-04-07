import type { ReliabilityHistoryItem } from "../api/trust";

type Props = {
  items: ReliabilityHistoryItem[];
};

export default function ReliabilityHistoryList({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        No reliability history yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-slate-900">Reliability history</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4"
          >
            <div>
              <div className="font-medium text-slate-900">{item.reason}</div>
              <div className="text-sm text-slate-600">
                {new Date(item.createdAt).toLocaleString()}
              </div>
              {item.note ? <div className="mt-1 text-sm text-slate-500">{item.note}</div> : null}
            </div>

            <div className="text-right">
              <div className="text-sm text-slate-500">
                {item.oldScore} → {item.newScore}
              </div>
              <div
                className={`text-sm font-semibold ${
                  item.delta >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {item.delta >= 0 ? `+${item.delta}` : item.delta}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
