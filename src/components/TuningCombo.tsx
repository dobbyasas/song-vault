import { useId } from "react";
import { useTunings } from "../hooks/useTunings";

export function TuningCombo({
  value,
  onChange,
  placeholder = "Tuning (e.g. Drop C)",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  const tunings = useTunings();

  return (
    <>
      <input
        className="input"
        list={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={id}>
        {(tunings.data ?? []).map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </>
  );
}
