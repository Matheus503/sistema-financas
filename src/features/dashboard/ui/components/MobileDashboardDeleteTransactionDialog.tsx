"use client";

import type { FinanceTransaction } from "../../../../domain/finance/transaction";

type MobileDashboardDeleteTransactionDialogProps = {
  transaction: FinanceTransaction | null;
  isInstallment: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function MobileDashboardDeleteTransactionDialog({
  transaction,
  isInstallment,
  onConfirm,
  onCancel,
}: MobileDashboardDeleteTransactionDialogProps) {
  if (!transaction) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-zinc-900 p-5 rounded-2xl w-full max-w-sm">
        <h2 className="text-lg font-bold mb-2">
          {isInstallment ? "Excluir compra parcelada?" : "Excluir lançamento"}
        </h2>
        <p className="text-sm text-zinc-400">
          {isInstallment
            ? "Este lançamento e as próximas parcelas desta compra serão removidos. Parcelas de meses anteriores serão mantidas no histórico."
            : "Deseja realmente excluir este lançamento?"}
        </p>
        <div className="flex gap-2 mt-5">
          <button
            className="flex-1 bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 py-3 rounded-xl font-semibold transition"
            onClick={onConfirm}
            type="button"
            autoFocus
          >
            Confirmar
          </button>
          <button
            className="flex-1 bg-zinc-700 hover:bg-zinc-600 py-3 rounded-xl font-semibold transition"
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
