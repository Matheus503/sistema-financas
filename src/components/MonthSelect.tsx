"use client";

import SearchSelect, { normalizeSelectSearch } from "./SearchSelect";

type Props = {
  months: { id: string; month: number; year: number }[];
  currentIndex: number;
  onSelect: (index: number) => void;
};
const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const fullMonthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export default function MonthSelect({ months, currentIndex, onSelect }: Props) {
  return <SearchSelect
    compact
    value={months[currentIndex]?.id ?? ""}
    aria-label="Selecionar mês e ano"
    placeholder="Sem meses"
    searchPlaceholder="Buscar mês/ano"
    emptyMessage="Nenhum mês encontrado."
    options={months.map(month => ({ value: month.id, label: monthNames[month.month - 1] + " " + month.year }))}
    onValueChange={value => { const index = months.findIndex(month => month.id === value); if (index >= 0) onSelect(index); }}
    filterOption={(option, search) => {
      const month = months.find(month => month.id === option.value);
      if (!month) return false;
      const terms = normalizeSelectSearch(search).split(/[\s/.-]+/).filter(Boolean);
      const name = normalizeSelectSearch(fullMonthNames[month.month - 1] ?? "");
      return terms.every(term => /^\d+$/.test(term) ? (term.length <= 2 ? Number(term) === month.month : String(month.year).includes(term)) : name.includes(term));
    }}
  />;
}
