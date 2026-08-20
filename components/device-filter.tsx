"use client";

import { filterOptionsFor, type WorkspaceId } from "@/lib/workspace";

export function DeviceFilter({
  workspaceId,
  value,
  onChange,
}: {
  workspaceId: WorkspaceId;
  value: string;
  onChange: (value: string) => void;
}) {
  const config = filterOptionsFor(workspaceId);
  return (
    <label className="text-sm">
      {config.label}
      <select className="ml-2 h-9 rounded-md border px-2" value={value} onChange={(e) => onChange(e.target.value)}>
        {config.options.map((option) => (
          <option key={option.id || "all"} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
