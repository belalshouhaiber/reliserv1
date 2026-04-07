type Props = {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export default function EmergencyOptInToggle({
  checked,
  disabled = false,
  onChange,
}: Props) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4">
      <div className="pr-4">
        <div className="font-semibold text-slate-900">Emergency Opt-in</div>
        <div className="mt-1 text-sm text-slate-600">
          Receive emergency requests when you are online and eligible.
        </div>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
          checked ? "bg-emerald-600" : "bg-slate-300"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}
