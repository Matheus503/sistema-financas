"use client";

type CardStatementDeleteDialogProps = {
  open: boolean;
  isInstallment: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function CardStatementDeleteDialog({
  open,
  isInstallment,
  onConfirm,
  onCancel,
}: CardStatementDeleteDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70">
      <div className="bg-zinc-900 p-6 rounded-xl w-80 text-center border border-zinc-800">
        <h2 className="mb-4 text-lg font-bold">
          {isInstallment ? "Excluir compra parcelada?" : "Deseja excluir este lançamento?"}
        </h2>
        {isInstallment && (
          <p className="mb-5 text-sm text-zinc-400">
            Este lançamento e as próximas parcelas desta compra serão removidos. Parcelas de meses anteriores serão mantidas no histórico.
          </p>
        )}
        <div className="flex justify-between gap-2">
          <button
            onClick={onConfirm}
            className="bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 px-4 py-2 rounded font-semibold transition"
            type="button"
            autoFocus
          >
            Sim
          </button>
          <button
            onClick={onCancel}
            className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition"
            type="button"
          >
            Não
          </button>
        </div>
      </div>
    </div>
  );
}
