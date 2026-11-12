"use client";

type MobileDashboardAccountDialogsProps = {
  showOptions: boolean;
  showDeleteAccount: boolean;
  isDeletingAccount: boolean;
  onCloseOptions: () => void;
  onRequestDeleteAccount: () => void;
  onConfirmDeleteAccount: () => void;
  onCancelDeleteAccount: () => void;
};

export default function MobileDashboardAccountDialogs({
  showOptions,
  showDeleteAccount,
  isDeletingAccount,
  onCloseOptions,
  onRequestDeleteAccount,
  onConfirmDeleteAccount,
  onCancelDeleteAccount,
}: MobileDashboardAccountDialogsProps) {
  return (
    <>
      {showOptions && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold">Mais opções</h2>
              <button
                onClick={onCloseOptions}
                className="bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-lg text-sm"
                type="button"
              >
                Fechar
              </button>
            </div>
            <button
              onClick={onRequestDeleteAccount}
              className="w-full bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 py-3 rounded-xl font-semibold transition"
              type="button"
            >
              Excluir conta
            </button>
          </div>
        </div>
      )}

      {showDeleteAccount && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-5">
            <h2 className="text-lg font-bold mb-3">Excluir conta permanentemente</h2>
            <p className="text-sm text-zinc-400">
              Esta ação excluirá permanentemente sua conta do sistema financeiro.
              Se você for administrador de um grupo, todos os dados desse grupo
              serão apagados, incluindo meses, contas, lançamentos, categorias,
              convites e membros. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                className="flex-1 bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 py-3 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={onConfirmDeleteAccount}
                disabled={isDeletingAccount}
                type="button"
                autoFocus
              >
                {isDeletingAccount ? "Excluindo..." : "Excluir conta"}
              </button>
              <button
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 py-3 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={onCancelDeleteAccount}
                disabled={isDeletingAccount}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
