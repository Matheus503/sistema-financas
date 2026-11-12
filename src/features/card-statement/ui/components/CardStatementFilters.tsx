"use client";

import SearchSelect from "../../../../components/SearchSelect";
import type { FinanceAccount } from "../../../../domain/finance/account";
import type { GroupMemberListItem } from "../../../../domain/finance/groupMember";
import type { ReactNode } from "react";

type PeriodOption = { label: string; value: string };

type CardStatementFiltersProps = {
  monthTitle: string;
  selectedCreditCardLabel: string;
  selectedLauncherLabel: string;
  periodLabel: string;
  periodFilter: string;
  periodOptions: PeriodOption[];
  showDateRangePicker: boolean;
  calendarMonth: Date;
  filterStartDate: string;
  filterEndDate: string;
  filterCategory: string;
  filterLauncher: string;
  filterCreditCard: string;
  categories: string[];
  members: GroupMemberListItem[];
  creditCards: FinanceAccount[];
  allLaunchersValue: string;
  allCreditCardsValue: string;
  formatDateLabel: (value: string) => string;
  renderCalendarMonth: (date: Date) => ReactNode;
  onToggleDateRangePicker: () => void;
  onApplyPeriodFilter: (value: string) => void;
  onMoveCalendarMonth: (offset: number) => void;
  onClearDateRange: () => void;
  onApplyDateRange: () => void;
  onFilterCategory: (value: string) => void;
  onFilterLauncher: (value: string) => void;
  onFilterCreditCard: (value: string) => void;
  onClearFilters: () => void;
};

export default function CardStatementFilters({
  monthTitle,
  selectedCreditCardLabel,
  selectedLauncherLabel,
  periodLabel,
  periodFilter,
  periodOptions,
  showDateRangePicker,
  calendarMonth,
  filterStartDate,
  filterEndDate,
  filterCategory,
  filterLauncher,
  filterCreditCard,
  categories,
  members,
  creditCards,
  allLaunchersValue,
  allCreditCardsValue,
  formatDateLabel,
  renderCalendarMonth,
  onToggleDateRangePicker,
  onApplyPeriodFilter,
  onMoveCalendarMonth,
  onClearDateRange,
  onApplyDateRange,
  onFilterCategory,
  onFilterLauncher,
  onFilterCreditCard,
  onClearFilters,
}: CardStatementFiltersProps) {
  const nextCalendarMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    1,
  );

  return (
    <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 mb-6">
      <div className="grid gap-3 md:grid-cols-[240px_1fr_1fr_240px_160px] items-end">
        <div className="relative">
          <label className="block text-xs text-zinc-400 mb-2">Período</label>
          <button
            type="button"
            onClick={onToggleDateRangePicker}
            className="w-full bg-zinc-800 hover:bg-zinc-700 p-2 rounded-lg outline-none text-left transition"
          >
            {periodLabel}
          </button>
          {showDateRangePicker && (
            <div className="absolute left-0 top-[74px] z-50 w-[min(92vw,640px)] rounded-2xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
              <div className="mb-4 grid grid-cols-3 gap-2">
                {periodOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onApplyPeriodFilter(option.value)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      periodFilter === option.value
                        ? "bg-purple-600 text-white"
                        : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mb-4 flex items-center justify-between gap-3 border-t border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={() => onMoveCalendarMonth(-1)}
                  className="rounded-lg bg-zinc-800 px-3 py-2 hover:bg-zinc-700"
                  aria-label="Mês anterior"
                >
                  ←
                </button>
                <div className="text-xs text-zinc-400">
                  {filterStartDate && !filterEndDate
                    ? "Selecione a data final"
                    : "Selecione a data inicial"}
                </div>
                <button
                  type="button"
                  onClick={() => onMoveCalendarMonth(1)}
                  className="rounded-lg bg-zinc-800 px-3 py-2 hover:bg-zinc-700"
                  aria-label="Próximo mês"
                >
                  →
                </button>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                {renderCalendarMonth(calendarMonth)}
                {renderCalendarMonth(nextCalendarMonth)}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-800 pt-4">
                <div className="text-xs text-zinc-400">
                  {filterStartDate
                    ? `${formatDateLabel(filterStartDate)}${
                        filterEndDate ? ` - ${formatDateLabel(filterEndDate)}` : ""
                      }`
                    : "Nenhum período selecionado"}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClearDateRange}
                    className="rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    onClick={onApplyDateRange}
                    className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold hover:bg-purple-700"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs text-zinc-400 mb-2">Categoria</label>
          <SearchSelect
            aria-label="Categoria"
            searchPlaceholder="Buscar categoria"
            value={filterCategory}
            onChange={(event) => onFilterCategory(event.target.value)}
            className="w-full bg-zinc-800 p-2 rounded-lg outline-none"
          >
            <option value="">Todas categorias</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </SearchSelect>
        </div>

        <div>
          <label className="block text-xs text-zinc-400 mb-2">Quem lançou</label>
          <SearchSelect
            aria-label="Quem lançou"
            searchPlaceholder="Buscar quem lançou"
            value={filterLauncher}
            onChange={(event) => onFilterLauncher(event.target.value)}
            className="w-full bg-zinc-800 p-2 rounded-lg outline-none"
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>{`Lancamentos ${member.name || member.email.split("@")[0] || "Sem nome"}`}</option>
            ))}
            <option value={allLaunchersValue}>Todos os Lancamentos</option>
          </SearchSelect>
        </div>

        <div>
          <label className="block text-xs text-zinc-400 mb-2">Cartão de crédito</label>
          <SearchSelect
            aria-label="Cartão de crédito"
            searchPlaceholder="Buscar cartão de crédito"
            value={filterCreditCard}
            onChange={(event) => onFilterCreditCard(event.target.value)}
            className="w-full bg-zinc-800 p-2 rounded-lg outline-none"
          >
            <option value={allCreditCardsValue}>Todos os cartões</option>
            {creditCards.map((card) => (
              <option key={card.id} value={card.id}>{card.name}</option>
            ))}
          </SearchSelect>
        </div>

        <button
          onClick={onClearFilters}
          className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded-xl h-[42px]"
          type="button"
        >
          Limpar filtros
        </button>
      </div>

      <div className="mt-3 text-xs text-zinc-500">
        Fatura: {monthTitle} - {selectedCreditCardLabel}
        {filterStartDate || filterEndDate ? ` • Período: ${periodLabel}` : ""}
        {filterCategory ? ` • Categoria: ${filterCategory}` : ""}
        {` • ${selectedLauncherLabel}`}
      </div>
    </div>
  );
}
