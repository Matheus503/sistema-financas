"use client";

import SwitchControl from "../../../../components/SwitchControl";

type EditableCardStatementItem = {
  category?: string;
  installmentCurrent?: number;
  installmentTotal?: number;
};

type CardStatementEditDialogProps = {
  open: boolean;
  item: EditableCardStatementItem | null;
  value: string;
  saving: boolean;
  canAnticipate: boolean;
  anticipateInstallments: boolean;
  remainingInstallments: number;
  anticipationInstallments: string;
  anticipationPaidValue: string;
  originalAmount: number;
  discountAmount: number;
  formatMoney: (value: number) => string;
  formatCurrencyTyping: (value: string) => string;
  onValueChange: (value: string) => void;
  onAnticipateChange: (checked: boolean) => void;
  onAnticipationInstallmentsChange: (value: string) => void;
  onAnticipationPaidValueChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
};

export default function CardStatementEditDialog({
  open,
  item,
  value,
  saving,
  canAnticipate,
  anticipateInstallments,
  remainingInstallments,
  anticipationInstallments,
  anticipationPaidValue,
  originalAmount,
  discountAmount,
  formatMoney,
  formatCurrencyTyping,
  onValueChange,
  onAnticipateChange,
  onAnticipationInstallmentsChange,
  onAnticipationPaidValueChange,
  onSave,
  onClose,
}: CardStatementEditDialogProps) {
  if (!open || !item) return null;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70">
      <form
        className="bg-zinc-900 p-6 rounded-xl w-full max-w-md border border-zinc-800"
        onSubmit={submit}
      >
        <h2 className="mb-3 text-lg font-bold">Editar valor lançado</h2>
        <p className="text-sm text-zinc-400 mb-3">{item.category || "Lançamento"}</p>
        <input
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          className="w-full p-2 bg-zinc-800 rounded mb-3"
          placeholder="Novo valor"
        />

        {canAnticipate && (
          <div className="mb-4 space-y-3 border-t border-zinc-800 pt-3">
            <SwitchControl
              checked={anticipateInstallments}
              label="Antecipar parcelas"
              onChange={onAnticipateChange}
            />
            {anticipateInstallments && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs text-zinc-400">
                  <label className="rounded-lg bg-zinc-800/70 p-3">
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
                  <div className="rounded-lg bg-zinc-800/70 p-3">
                    <div>Atual</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-100">
                      {item.installmentCurrent}/{item.installmentTotal}
                    </div>
                  </div>
                  <div className="rounded-lg bg-zinc-800/70 p-3">
                    <div>Restantes</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-100">{remainingInstallments}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-zinc-400">
                  <label className="rounded-lg bg-zinc-800/70 p-3">
                    <span className="block">Valor pago</span>
                    <input
                      type="tel"
                      inputMode="decimal"
                      value={anticipationPaidValue}
                      onChange={(event) => onAnticipationPaidValueChange(formatCurrencyTyping(event.target.value))}
                      className="mt-1 w-full bg-transparent p-0 text-sm font-semibold text-zinc-100 outline-none"
                      placeholder="R$ 0,00"
                    />
                  </label>
                  <div className="rounded-lg bg-zinc-800/70 p-3">
                    <div>Original</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-100">{formatMoney(originalAmount)}</div>
                  </div>
                  <div className="rounded-lg bg-zinc-800/70 p-3">
                    <div>Desconto</div>
                    <div className="mt-1 text-sm font-semibold text-emerald-300">{formatMoney(discountAmount)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between gap-2">
          <button
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition disabled:opacity-60"
            disabled={saving}
            type="submit"
          >
            Salvar
          </button>
          <button
            onClick={onClose}
            className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition"
            type="button"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
