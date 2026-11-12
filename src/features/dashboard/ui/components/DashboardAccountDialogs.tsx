"use client";

import type { FinanceAccount } from "../../../../domain/finance/account";

type Props = {
  showEdit: boolean;
  editValue: string;
  onEditValueChange: (value: string) => void;
  onSaveEdit: () => void;
  onCloseEdit: () => void;
  showExpectedEdit: boolean;
  expectedAccount: FinanceAccount | null;
  expectedValue: string;
  onExpectedValueChange: (value: string) => void;
  onSaveExpectedEdit: () => void;
  onCloseExpectedEdit: () => void;
  showDelete: boolean;
  deletingInstallmentAccount: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  showCreateMonth: boolean;
  onConfirmCreateMonth: () => void;
  onCancelCreateMonth: () => void;
};

const fieldLabelClass = "mb-1 block text-xs font-semibold text-zinc-400";

export default function DashboardAccountDialogs({
  showEdit,
  editValue,
  onEditValueChange,
  onSaveEdit,
  onCloseEdit,
  showExpectedEdit,
  expectedAccount,
  expectedValue,
  onExpectedValueChange,
  onSaveExpectedEdit,
  onCloseExpectedEdit,
  showDelete,
  deletingInstallmentAccount,
  onConfirmDelete,
  onCancelDelete,
  showCreateMonth,
  onConfirmCreateMonth,
  onCancelCreateMonth,
}: Props) {
  return (
    <>
      {showEdit && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
          <form
            className="bg-zinc-900 p-6 rounded-xl w-80"
            onSubmit={(event) => {
              event.preventDefault();
              onSaveEdit();
            }}
          >
            <h2 className="mb-3 text-lg font-bold">Editar valor</h2>
            <label className="block mb-3">
              <span className={fieldLabelClass}>Novo valor</span>
              <input
                type="tel"
                inputMode="decimal"
                value={editValue}
                onChange={(event) => onEditValueChange(event.target.value)}
                className="w-full p-2 bg-zinc-800 rounded"
                placeholder="Novo valor"
              />
            </label>
            <div className="flex justify-between gap-2">
              <button className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition" type="submit">
                Salvar
              </button>
              <button onClick={onCloseEdit} className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition" type="button">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {showExpectedEdit && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <form
            className="bg-zinc-900 p-6 rounded-xl w-80 border border-zinc-800"
            onSubmit={(event) => {
              event.preventDefault();
              onSaveExpectedEdit();
            }}
          >
            <h2 className="mb-3 text-lg font-bold">Editar valor previsto</h2>
            <p className="text-sm text-zinc-400 mb-3">{expectedAccount?.name}</p>
            <label className="block mb-3">
              <span className={fieldLabelClass}>Valor previsto</span>
              <input
                type="tel"
                inputMode="decimal"
                value={expectedValue}
                onChange={(event) => onExpectedValueChange(event.target.value)}
                className="w-full p-2 bg-zinc-800 rounded"
                placeholder="Valor previsto"
              />
            </label>
            <div className="flex justify-between gap-2">
              <button className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition" type="submit">
                Salvar
              </button>
              <button onClick={onCloseExpectedEdit} className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition" type="button">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {showDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
          <div className="bg-zinc-900 p-6 rounded-xl w-80 text-center">
            <h2 className="mb-4 text-lg font-bold">
              {deletingInstallmentAccount ? "Excluir conta parcelada?" : "Deseja realmente excluir?"}
            </h2>
            {deletingInstallmentAccount && (
              <p className="mb-5 text-sm text-zinc-400">
                Esta conta e as próximas parcelas dela serão removidas dos meses
                futuros. Parcelas de meses anteriores serão mantidas no
                histórico.
              </p>
            )}
            <div className="flex justify-between gap-2">
              <button onClick={onConfirmDelete} className="bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 px-4 py-2 rounded font-semibold transition" type="button" autoFocus>
                Sim
              </button>
              <button onClick={onCancelDelete} className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition" type="button">
                Não
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateMonth && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-6 rounded-xl w-80 text-center border border-zinc-800">
            <h2 className="mb-3 text-lg font-bold">Criar novo mes?</h2>
            <p className="text-sm text-zinc-400 mb-5">Deseja realmente criar um novo mes?</p>
            <div className="flex justify-between gap-2">
              <button onClick={onConfirmCreateMonth} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition" type="button" autoFocus>
                Sim
              </button>
              <button onClick={onCancelCreateMonth} className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition" type="button">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
