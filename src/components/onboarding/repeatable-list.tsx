"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";

export type FieldSpec = { key: string; label: string; placeholder?: string; numeric?: boolean };

// Generic "repeatable group" editor — qualifications, registrations,
// hospital affiliations, awards, memberships all share the same shape (a
// small set of text/number fields, added/removed as rows), so one
// configurable component covers all of them instead of four near-identical
// ones. Summary line + inline add-form, matching the design doc's
// "MBBS / AIIMS New Delhi · 2014 →" pattern rather than permanently-visible
// input rows for every entry.
export function RepeatableList<T extends Record<string, string>>({
  items,
  onChange,
  fields,
  summary,
  addLabel,
  emptyLabel,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  fields: FieldSpec[];
  summary: (item: T) => { title: string; subtitle?: string };
  addLabel: string;
  emptyLabel: string;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const startAdd = () => {
    setDraft(Object.fromEntries(fields.map((f) => [f.key, ""])));
    setAdding(true);
  };

  const save = () => {
    const primary = fields[0]?.key;
    if (primary && !draft[primary]?.trim()) return;
    onChange([...items, draft as T]);
    setAdding(false);
  };

  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div>
      {items.length === 0 && !adding && <p className="text-[13px] text-faint">{emptyLabel}</p>}
      <div className="space-y-1">
        {items.map((item, i) => {
          const { title, subtitle } = summary(item);
          return (
            <div key={i} className="flex items-center gap-3 rounded-field px-1 py-2.5 hover:bg-surface-2/50">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-ink">{title}</p>
                {subtitle && <p className="truncate text-[12.5px] text-muted">{subtitle}</p>}
              </div>
              <button type="button" onClick={() => remove(i)} aria-label={`Remove ${title}`} className="p-1.5 text-faint hover:text-danger">
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className="mt-3 space-y-3 rounded-panel bg-surface-2/60 p-4">
          {fields.map((f) => (
            <Input
              key={f.key}
              placeholder={f.placeholder ?? f.label}
              inputMode={f.numeric ? "numeric" : undefined}
              value={draft[f.key] ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: f.numeric ? e.target.value.replace(/\D/g, "") : e.target.value }))}
              className="h-11 bg-surface"
            />
          ))}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={save} className="pressable h-10 flex-1 rounded-pill bg-charcoal text-[13px] font-medium text-white">
              Add
            </button>
            <button type="button" onClick={() => setAdding(false)} className="pressable h-10 rounded-pill bg-surface px-4 text-[13px] text-muted">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={startAdd} className="pressable mt-2 inline-flex h-9 items-center gap-1.5 rounded-pill bg-surface-2 px-3.5 text-[13px] text-muted hover:bg-surface-3">
          <Plus size={13} /> {addLabel}
        </button>
      )}
    </div>
  );
}
