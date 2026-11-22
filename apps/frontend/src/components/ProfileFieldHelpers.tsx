import { useState } from "react";

export function appendProfileLines(value: string, entries: readonly string[], maxLength = Infinity) {
  const lines = value.split("\n").map(line => line.trim().toLowerCase());
  const additions = entries.filter(entry => !lines.includes(entry.toLowerCase()));
  const next = [value.trimEnd(), ...additions].filter(Boolean).join("\n");
  return additions.length && next.length <= maxLength ? next : value;
}

export function ProfileSuggestions({ label, options, value, onChange, maxLength }: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}) {
  return (
    <div role="group" aria-label={label} className="mt-2 flex flex-wrap gap-2">
      {options.map(option => {
        const next = appendProfileLines(value, [option], maxLength);
        return <button key={option} type="button" disabled={next === value}
          onClick={() => onChange(next)}
          className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-indigo-300 disabled:opacity-50">
          {next === value && value.split("\n").some(line => line.trim().toLowerCase() === option.toLowerCase()) ? "✓ " : "+ "}
          {option}
        </button>;
      })}
    </div>
  );
}

const entryInput = "w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5";

export function ProfilePairEntry({ labels, action, separator, onAdd }: {
  labels: [string, string];
  action: string;
  separator: string;
  onAdd: (entry: string) => void;
}) {
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const ready = Boolean(first.trim() && second.trim());

  function add() {
    if (!ready) return;
    onAdd(first.trim() + separator + second.trim());
    setFirst("");
    setSecond("");
  }

  return (
    <div className="mb-2 grid gap-2 sm:grid-cols-2" onKeyDown={event => {
      if (event.key === "Enter" && event.target instanceof HTMLInputElement && !event.nativeEvent.isComposing) {
        event.preventDefault();
        add();
      }
    }}>
      <label className="grid gap-1">{labels[0]}
        <input className={entryInput} value={first} onChange={e => setFirst(e.target.value)} />
      </label>
      <label className="grid gap-1">{labels[1]}
        <input className={entryInput} value={second} onChange={e => setSecond(e.target.value)} />
      </label>
      <button type="button" disabled={!ready} onClick={add}
        className="justify-self-start rounded-lg border border-slate-700 px-3 py-1.5 text-indigo-300 disabled:opacity-50">
        {action}
      </button>
    </div>
  );
}
