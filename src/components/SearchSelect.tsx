"use client";

import { Children, isValidElement, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Search } from "lucide-react";

export type SelectOption = { value: string; label: string; disabled?: boolean; keywords?: string };
type Props = {
  value?: string | number;
  options?: SelectOption[];
  children?: ReactNode;
  onValueChange?: (value: string) => void;
  onChange?: (event: { target: { value: string }; currentTarget: { value: string } }) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  title?: string;
  "aria-label"?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  compact?: boolean;
  searchable?: boolean;
  inputStyle?: boolean;
  menuMinWidth?: number;
  filterOption?: (option: SelectOption, search: string) => boolean;
};
export const normalizeSelectSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const textContent = (children: ReactNode): string => Children.toArray(children).map(child => isValidElement<{ children?: ReactNode }>(child) ? textContent(child.props.children) : String(child)).join("");
function readOptions(children: ReactNode): SelectOption[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(child)) return [];
    if (child.type !== "option") return readOptions(child.props.children);
    const label = textContent(child.props.children);
    return [{ value: String(child.props.value ?? label), label, disabled: child.props.disabled }];
  });
}

export default function SearchSelect({ value, options, children, onValueChange, onChange, disabled, className = "", id, title, "aria-label": ariaLabel, placeholder = "Selecione", searchPlaceholder = "Buscar opção", emptyMessage = "Nenhuma opção encontrada.", compact = false, searchable = true, inputStyle = false, menuMinWidth, filterOption }: Props) {
  const choices = options ?? readOptions(children);
  const selected = choices.find(option => option.value === String(value ?? ""));
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState({ left: 0, top: 0, width: 176, maxHeight: 288, transform: "none" });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuId = useId();
  const filtered = choices.filter(option => filterOption ? filterOption(option, search) : normalizeSelectSearch(option.label + " " + (option.keywords ?? "")).includes(normalizeSelectSearch(search).trim()));
  const label = ariaLabel ?? title ?? "Selecionar opção";

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
      const width = Math.min(Math.max(rect.width, menuMinWidth ?? (compact ? 176 : 224)), viewportWidth - 24);
      const below = viewportBottom - rect.bottom - 16;
      const above = rect.top - viewportTop - 16;
      const upwards = below < 200 && above > below;
      const maxHeight = Math.max(80, Math.min(288, upwards ? above : below));
      // The portal uses document coordinates, so keyboard-driven viewport
      // panning does not detach it from its trigger on mobile Safari.
      setPosition({ left: window.scrollX + Math.max(viewportLeft + 12, Math.min(rect.left + (rect.width - width) / 2, viewportLeft + viewportWidth - width - 12)), top: window.scrollY + (upwards ? rect.top - 8 : rect.bottom + 8), width, maxHeight, transform: upwards ? "translateY(-100%)" : "none" });
    };
    updatePosition();
    const touchDevice = window.matchMedia("(any-pointer: coarse)").matches;
    if (searchable && !touchDevice) inputRef.current?.focus({ preventScroll: true });
    else if (!searchable && !touchDevice) {
      const option = panelRef.current?.querySelector<HTMLButtonElement>('button[aria-current="true"]:not(:disabled)') ?? panelRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)');
      option?.focus({ preventScroll: true });
      option?.scrollIntoView({ block: "nearest" });
    }
    const dismiss = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    // Safari may blur an input with relatedTarget=null before a tapped
    // option receives its click. Only dismiss on actual outside interaction.
    const dismissOnFocus = (event: FocusEvent) => {
      if (!panelRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismissOnFocus);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismissOnFocus);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [open, compact, searchable, menuMinWidth]);

  const close = () => { setOpen(false); triggerRef.current?.focus({ preventScroll: true }); };
  const choose = (option: SelectOption) => {
    if (option.disabled) return;
    close();
    if (option.value === String(value ?? "")) return;
    onValueChange?.(option.value);
    onChange?.({ target: { value: option.value }, currentTarget: { value: option.value } });
  };

  return <>
    <button ref={triggerRef} id={id} type="button" disabled={disabled || choices.length === 0} aria-label={label} title={title ?? label} aria-expanded={open} aria-controls={open ? menuId : undefined}
      onClick={() => { setSearch(""); setOpen(current => !current); }}
      className={className.replace(/\brounded(?:-[a-z0-9]+)?\b/g, "") + " flex min-w-0 cursor-pointer items-center transition hover:bg-zinc-700/60 focus-visible:outline-2 focus-visible:outline-purple-400 disabled:cursor-not-allowed disabled:opacity-50 " + (inputStyle ? "justify-start text-left font-normal " : "justify-center text-center text-zinc-200 ") + (compact ? "rounded-full px-2 py-1 text-sm font-semibold " : inputStyle ? "rounded " : "rounded-xl ") + (open ? " bg-purple-500/10" : "")}
    ><span className={"truncate " + (inputStyle && !selected ? "text-current/50" : "")}>{selected?.label ?? placeholder}</span></button>
    {open && createPortal(
      <div ref={panelRef} id={menuId} aria-label={label} style={position}
        className="absolute z-[200] flex flex-col overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-900 p-1.5 text-white shadow-xl shadow-black/50"
        onKeyDown={event => {
          event.stopPropagation();
          if (event.key === "Escape") { event.preventDefault(); close(); return; }
          const buttons = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
          if (event.target === inputRef.current && event.key === "Enter") { event.preventDefault(); buttons[0]?.click(); return; }
          if (event.target === inputRef.current && event.key !== "ArrowDown") return;
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          let next = index;
          if (event.key === "ArrowDown") next = Math.min(index + 1, buttons.length - 1);
          else if (event.key === "ArrowUp") { if (index === 0 && searchable) { event.preventDefault(); inputRef.current?.focus(); return; } next = Math.max(0, index - 1); }
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = buttons.length - 1;
          else return;
          event.preventDefault(); buttons[next]?.focus();
        }}
      >
        {searchable && <label className="mb-1.5 flex shrink-0 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-2 focus-within:border-purple-400">
          <Search size={14} className="shrink-0 text-zinc-500" aria-hidden="true" />
          <input ref={inputRef} type="text" value={search} onChange={event => setSearch(event.target.value)} aria-label={searchPlaceholder} placeholder={searchPlaceholder} className="h-10 w-full min-w-0 bg-transparent text-base text-zinc-200 outline-none placeholder:text-zinc-500" />
        </label>}
        <div className="category-scroll min-h-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable_both-edges]">
          {filtered.length === 0 && <p role="status" className="px-2 py-4 text-center text-xs text-zinc-400">{emptyMessage}</p>}
          {filtered.map(option => <button key={option.value} type="button" disabled={option.disabled} aria-current={option.value === String(value ?? "") ? "true" : undefined} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}
            className={"grid min-h-11 w-full grid-cols-[1rem_minmax(0,1fr)_1rem] items-center gap-1 rounded-xl px-2 py-2 text-sm transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-purple-400 disabled:opacity-40 " + (option.value === String(value ?? "") ? "bg-purple-500/20 font-semibold text-purple-200" : "text-zinc-300 hover:bg-zinc-800 hover:text-white")}
          ><span aria-hidden="true" /><span className="break-words text-center">{option.label}</span><span aria-hidden="true">{option.value === String(value ?? "") && <Check size={16} />}</span></button>)}
        </div>
      </div>, document.body
    )}
  </>;
}
