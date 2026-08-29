"use client";

import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type BranchOption = { id: number; name: string };

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

export function BranchAccessMultiSelect({
  id,
  name,
  options,
}: {
  id?: string;
  name: string;
  options: BranchOption[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({
    top: 0,
    left: 0,
    width: 280,
    maxHeight: 360,
  });

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportGap = 12;
    const menuWidth = Math.min(
      Math.max(rect.width, 280),
      Math.max(220, window.innerWidth - viewportGap * 2),
    );
    const estimatedHeight = Math.min(360, 58 + options.length * 44);
    const belowSpace = window.innerHeight - rect.bottom - viewportGap;
    const aboveSpace = rect.top - viewportGap;
    const openBelow = belowSpace >= Math.min(estimatedHeight, 220) || belowSpace >= aboveSpace;
    const availableSpace = openBelow ? belowSpace : aboveSpace;
    const maxHeight = Math.max(160, Math.min(estimatedHeight, availableSpace));
    const top = openBelow
      ? rect.bottom + 6
      : Math.max(viewportGap, rect.top - maxHeight - 6);
    const left = Math.min(
      Math.max(viewportGap, rect.left),
      Math.max(viewportGap, window.innerWidth - menuWidth - viewportGap),
    );

    setMenuPosition({ top, left, width: menuWidth, maxHeight });
  }, [options.length]);

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();
    const handleViewportChange = () => updateMenuPosition();
    const handleOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  const allSelected = options.length > 0 && selected.length === options.length;
  const selectedLabel =
    selected.length === 0
      ? "Select branch"
      : allSelected
        ? "All branches"
        : selected.length === 1
          ? options.find((option) => option.id === selected[0])?.name ?? "1 branch selected"
          : `${selected.length} branches selected`;

  function toggleBranch(branchId: number) {
    setSelected((current) =>
      current.includes(branchId)
        ? current.filter((id) => id !== branchId)
        : [...current, branchId],
    );
  }

  function toggleAll() {
    setSelected(allSelected ? [] : options.map((option) => option.id));
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={!options.length}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3.5 text-left text-sm font-semibold text-slate-700 outline-none transition hover:border-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => {
          if (!open) updateMenuPosition();
          setOpen((current) => !current);
        }}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {selected.map((branchId) => (
        <input key={branchId} name={name} type="hidden" value={branchId} />
      ))}

      {open ? (
        <div
          role="listbox"
          aria-label="Select branch"
          aria-multiselectable="true"
            className="fixed z-[80] overflow-y-auto rounded-lg border border-slate-200 bg-white py-2 font-normal text-slate-700 shadow-xl"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            maxHeight: menuPosition.maxHeight,
          }}
        >
          <button
            type="button"
            role="option"
            aria-selected={allSelected}
            className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-normal transition ${allSelected ? "bg-slate-100" : "hover:bg-slate-50"}`}
            onClick={toggleAll}
          >
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${allSelected ? "border-teal-700 bg-teal-700 text-white" : "border-slate-400 bg-white"}`}>
              {allSelected ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
            </span>
            <span>All branches</span>
          </button>
          <div className="border-t border-slate-100 pt-1">
            {options.map((option) => {
              const checked = selected.includes(option.id);
              return (
                <label
                  key={option.id}
                  role="option"
                  aria-selected={checked}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm transition ${checked ? "bg-slate-100" : "hover:bg-slate-50"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    className="h-5 w-5 shrink-0 rounded border-slate-400 text-teal-700 focus:ring-2 focus:ring-teal-100"
                    onChange={() => toggleBranch(option.id)}
                  />
                  <span className="truncate">{option.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
