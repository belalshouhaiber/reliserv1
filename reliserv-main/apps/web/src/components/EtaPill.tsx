type Props = {
  etaMinutes: number | null;
};

export default function EtaPill({ etaMinutes }: Props) {
  return (
    <span className="inline-flex items-center rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
      {etaMinutes != null ? `${etaMinutes} min ETA` : "ETA unavailable"}
    </span>
  );
}
