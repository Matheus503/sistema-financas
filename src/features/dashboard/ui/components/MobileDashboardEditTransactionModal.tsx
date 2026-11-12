"use client";

import type { FinanceTransaction } from "../../../../domain/finance/transaction";
import SwitchControl from "../../../../components/SwitchControl";

type MobileDashboardEditTransactionModalProps = {
  transaction: FinanceTransaction | null;
  value: string;
  onValueChange: (value: string) => void;
  formatCurrencyInput: (value: string) => string;
  canAnticipate: boolean;
  anticipateInstallments: boolean;
  onAnticipateChange: (checked: boolean) => void;
  anticipationInstallments: string;
  onAnticipationInstallmentsChange: (value: string) => void;
  remainingInstallments: number;
  anticipationPaidValue: string;
  onAnticipationPaidValueChange: (value: string) => void;
  originalAmount: number;
  discountAmount: number;
  formatMoney: (value: number) => string;
  onSave: () => void;
  onClose: () => void;
};

export default function MobileDashboardEditTransactionModal({
  transaction,
  value,
  onValueChange,
  formatCurrencyInput,
  canAnticipate,
  anticipateInstallments,
  onAnticipateChange,
  anticipationInstallments,
  onAnticipationInstallmentsChange,
  remainingInstallments,
  anticipationPaidValue,
  onAnticipationPaidValueChange,
  originalAmount,
  discountAmount,
  formatMoney,
  onSave,
  onClose,
}: MobileDashboardEditTransactionModalProps) {
  if (!transaction) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-zinc-900 p-5 rounded-2xl w-full max-w-sm border border-zinc-800">
        <h2 className="text-lg font-bold mb-4">Editar valor</h2>
        <input
          type="tel"
          inputMode="decimal"
          value={value}
          onChange={(event) => onValueChange(formatCurrencyInput(event.target.value))}
          className="w-full bg-zinc-800 rounded-xl p-3 outline-none"
        />

        {canAnticipate && (
          <div className="mt-4 space-y-3 border-t border-zinc-800 pt-4">
            <SwitchControl
              checked={anticipateInstallments}
              label="Antecipar parcelas"
              onChange={onAnticipateChange}
            />
            {anticipateInstallments && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-[11px] text-zinc-400">
                  <label className="rounded-xl bg-zinc-800/70 p-3">
                    <span className="block">Antecipar</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={anticipationInstallments}
                      onChange={(event) => {
                        const nextValue = event.target.value.replace(/\D/g, "");
                        if (!nextValue) {
                          onAnticipationInstallmentsChange("");
                          return;
                        }
                        onAnticipationInstallmentsChange(
                          String(Math.min(Number(nextValue), remainingInstallments)),
                        );
                      }}
                      className="mt-1 w-full bg-transparent p-0 text-sm font-semibold text-purple-300 outline-none"
                      placeholder="0"
                    />
                  </label>
                  <div className="rounded-xl bg-zinc-800/70 p-3">
                    <div>Atual</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-100">
                      {transaction.installmentCurrent}/{transaction.installmentTotal}
                    </div>
                  </div>
                  <div className="rounded-xl bg-zinc-800/70 p-3">
                    <div>Restantes</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-100">{remainingInstallments}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-zinc-400">
                  <label className="rounded-xl bg-zinc-800/70 p-3">
                    <span className="block">Valor pago</span>
                    <input
                      type="tel"
                      inputMode="decimal"
                      value={anticipationPaidValue}
                      onChange={(event) => onAnticipationPaidValueChange(formatCurrencyInput(event.target.value))}
                      className="mt-1 w-full bg-transparent p-0 text-sm font-semibold text-zinc-100 outline-none"
                      placeholder="R$ 0,00"
                    />
                  </label>
                  <div className="rounded-xl bg-zinc-800/70 p-3">
                    <div>Original</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-100">{formatMoney(originalAmount)}</div>
                  </div>
                  <div className="rounded-xl bg-zinc-800/70 p-3">
                    <div>Desconto</div>
                    <div className="mt-1 text-sm font-semibold text-emerald-300">{formatMoney(discountAmount)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            className="flex-1 bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-semibold transition"
            onClick={onSave}
            type="button"
          >
            Salvar
          </button>
          <button
            className="flex-1 bg-zinc-700 hover:bg-zinc-600 py-3 rounded-xl font-semibold transition"
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
