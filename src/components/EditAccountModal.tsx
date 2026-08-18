"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { FinanceAccount } from "../services/accountService";
import {
  getAccountClosingDay,
  isCalculatedAccount,
  isCreditCardAccount,
  isPixAccount,
  updateAccountDetails,
} from "../services/accountService";
import SwitchControl from "./SwitchControl";

type Props = {
  open: boolean;
  onClose: () => void;
  monthId: string | null;
  account: FinanceAccount | null;
  accounts: FinanceAccount[];
  setAccounts: React.Dispatch<React.SetStateAction<FinanceAccount[]>>;
};

export default function EditAccountModal({
  open,
  onClose,
  monthId,
  account,
  accounts,
  setAccounts,
}: Props) {
  if (!open || !account) return null;
  if (
    isCalculatedAccount(account) &&
    !isCreditCardAccount(account) &&
    !isPixAccount(account)
  ) {
    return null;
  }

  return (
    <EditAccountForm
      key={account.id}
      onClose={onClose}
      monthId={monthId}
      account={account}
      accounts={accounts}
      setAccounts={setAccounts}
    />
  );
}

type FormProps = Omit<Props, "open" | "account"> & {
  account: FinanceAccount;
};

function EditAccountForm({
  onClose,
  monthId,
  account,
  accounts,
  setAccounts,
}: FormProps) {
  const isCreditCard = isCreditCardAccount(account);
  const isPix = isPixAccount(account);
  const isClosingAccount = isCreditCard || isPix;
  const supportsInstallments = account.type === "FIXED" || account.type === "CREDIT";
  const fieldLabelClass = "mb-1 block text-xs font-semibold text-zinc-400";

  const getInstallmentBaseName = () => {
    if (account.installmentBaseName) return account.installmentBaseName;

    return String(account.name || "")
      .replace(/\s-\s\d+\/\d+$/, "")
      .trim();
  };

  const formatCurrencyInput = (v: number) => {
    return Number(v || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const [name, setName] = useState(account.name || "");
  const [value, setValue] = useState(
    formatCurrencyInput(Number(account.value || 0))
  );
  const [dueDay, setDueDay] = useState(
    account.dia_vencimento ? String(account.dia_vencimento) : ""
  );
  const [closingDay, setClosingDay] = useState(
    isClosingAccount ? String(getAccountClosingDay(account)) : ""
  );
  const [isArchived, setIsArchived] = useState(account.isArchived === true);
  const [isPrimaryCreditCard, setIsPrimaryCreditCard] = useState(
    account.isPrimaryCreditCard === true
  );
  const [installmentTotal, setInstallmentTotal] = useState(
    supportsInstallments && account.installmentTotal
      ? String(account.installmentTotal)
      : ""
  );
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showPrimaryConfirm, setShowPrimaryConfirm] = useState(false);

  const parseCurrency = (v: string) => {
    if (!v) return 0;
    return Number(v.replace(/\./g, "").replace(",", "."));
  };

  const formatCurrencyTyping = (nextValue: string) => {
    const numbers = nextValue.replace(/\D/g, "");
    const amount = Number(numbers) / 100;

    return amount.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleDueDayChange = (nextValue: string) => {
    if (!nextValue) {
      setDueDay("");
      return;
    }

    if (!/^\d+$/.test(nextValue)) return;

    const parsed = Math.min(Math.max(Number(nextValue), 1), 31);
    setDueDay(String(parsed));
  };

  const handleClosingDayChange = (nextValue: string) => {
    if (!nextValue) {
      setClosingDay("");
      return;
    }

    if (!/^\d+$/.test(nextValue)) return;

    const parsed = Math.min(Math.max(Number(nextValue), 1), 31);
    setClosingDay(String(parsed));
  };

  const handleInstallmentTotalChange = (nextValue: string) => {
    if (!nextValue) {
      setInstallmentTotal("");
      return;
    }

    if (!/^\d+$/.test(nextValue)) return;

    setInstallmentTotal(String(Math.max(Number(nextValue), 1)));
  };

  const createInstallmentGroupId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const handleClose = () => {
    setName("");
    setValue("");
    setDueDay("");
    setClosingDay("");
    setIsArchived(false);
    setIsPrimaryCreditCard(false);
    setInstallmentTotal("");
    setShowArchiveConfirm(false);
    setShowPrimaryConfirm(false);
    onClose();
  };

  const hasAnotherPrimaryCreditCard = () =>
    accounts.some(
      (item) =>
        item.id !== account.id &&
        item.isPrimaryCreditCard === true &&
        isCreditCardAccount(item)
    );

  const handleSave = async ({
    skipArchiveConfirm = false,
    skipPrimaryConfirm = false,
  } = {}) => {
    if (!monthId || !account) return;

    const parsedName = isPix ? account.name : name.trim();
    if (!parsedName) {
      toast.error("Informe o nome.");
      return;
    }

    const parsedDueDay = dueDay ? Number(dueDay) : undefined;
    const parsedClosingDay =
      isClosingAccount && closingDay ? Number(closingDay) : undefined;
    const parsedInstallmentTotal =
      supportsInstallments && installmentTotal ? Number(installmentTotal) : undefined;
    const parsedInstallmentCurrent =
      Number(account.installmentCurrent || 1) || 1;
    const installmentBaseName = getInstallmentBaseName() || parsedName;
    const installmentGroupId =
      account.installmentGroupId ||
      (parsedInstallmentTotal ? createInstallmentGroupId() : undefined);
    const nameWithInstallment =
      supportsInstallments && parsedInstallmentTotal
        ? `${installmentBaseName} - ${Math.min(
            parsedInstallmentCurrent,
            parsedInstallmentTotal
          )}/${parsedInstallmentTotal}`
        : parsedName;

    if (
      parsedDueDay !== undefined &&
      (!Number.isInteger(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 31)
    ) {
      toast.error("Informe um dia de vencimento entre 1 e 31.");
      return;
    }

    if (isClosingAccount && parsedClosingDay === undefined) {
      toast.error("Informe um dia de fechamento entre 1 e 31.");
      return;
    }

    if (
      parsedClosingDay !== undefined &&
      (!Number.isInteger(parsedClosingDay) ||
        parsedClosingDay < 1 ||
        parsedClosingDay > 31)
    ) {
      toast.error("Informe um dia de fechamento entre 1 e 31.");
      return;
    }

    if (
      parsedInstallmentTotal !== undefined &&
      (!Number.isInteger(parsedInstallmentTotal) || parsedInstallmentTotal < 1)
    ) {
      toast.error("Informe um numero de parcelas valido.");
      return;
    }

    if (
      isCreditCard &&
      isArchived &&
      account.isArchived !== true &&
      !skipArchiveConfirm
    ) {
      setShowArchiveConfirm(true);
      return;
    }

    if (
      isCreditCard &&
      isPrimaryCreditCard &&
      !skipPrimaryConfirm &&
      hasAnotherPrimaryCreditCard()
    ) {
      setShowPrimaryConfirm(true);
      return;
    }

    const parsedValue = isCreditCard || isPix ? undefined : parseCurrency(value);
    const updated = await updateAccountDetails(monthId, account.id, {
      name: nameWithInstallment,
      value: parsedValue,
      dia_vencimento: parsedDueDay,
      dia_fechamento: parsedClosingDay,
      isArchived: isCreditCard ? isArchived : undefined,
      isPrimaryCreditCard: isCreditCard ? isPrimaryCreditCard : undefined,
      ...(supportsInstallments
        ? {
            installmentBaseName: parsedInstallmentTotal
              ? installmentBaseName
              : null,
            installmentCurrent: parsedInstallmentTotal
              ? Math.min(parsedInstallmentCurrent, parsedInstallmentTotal)
              : null,
            installmentTotal: parsedInstallmentTotal ?? null,
            installmentGroupId: parsedInstallmentTotal
              ? installmentGroupId
              : null,
          }
        : {}),
    });

    setAccounts((prev) =>
      prev.map((item) =>
        item.id === account.id
          ? {
              ...item,
              name: updated.name,
              ...(updated.value === undefined ? {} : { value: updated.value }),
              dia_vencimento: updated.dia_vencimento,
              dia_fechamento: updated.dia_fechamento,
              ...(updated.isArchived === undefined
                ? {}
                : { isArchived: updated.isArchived }),
              ...(updated.isPrimaryCreditCard === undefined
                ? {}
                : { isPrimaryCreditCard: updated.isPrimaryCreditCard }),
              ...(supportsInstallments
                ? {
                    installmentBaseName: updated.installmentBaseName,
                    installmentCurrent: updated.installmentCurrent,
                    installmentTotal: updated.installmentTotal,
                    installmentGroupId: updated.installmentGroupId,
                  }
                : {}),
            }
          : isCreditCard && isPrimaryCreditCard && isCreditCardAccount(item)
          ? {
              ...item,
              isPrimaryCreditCard: false,
            }
          : item
      )
    );

    handleClose();
    toast.success("Conta atualizada com sucesso.");
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <form
        className="bg-zinc-900 p-6 rounded-xl w-80 border border-zinc-800"
        onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}
      >
        <h2 className="mb-3 text-lg font-bold">
          {isPix ? "Editar PIX" : isCreditCard ? "Editar cartão" : "Editar conta"}
        </h2>

        {!isPix && (
          <label className="block mb-3">
            <span className={fieldLabelClass}>Nome da conta</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da conta"
              className="w-full p-2 bg-zinc-800 rounded"
            />
          </label>
        )}

        {!isCreditCard && !isPix && (
          <label className="block mb-3">
            <span className={fieldLabelClass}>Valor</span>
            <input
              type="tel"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(formatCurrencyTyping(e.target.value))}
              placeholder="Valor"
              className="w-full p-2 bg-zinc-800 rounded"
            />
          </label>
        )}

        {supportsInstallments && (
          <label className="block mb-3">
            <span className={fieldLabelClass}>Número de parcelas</span>
            <input
              type="number"
              min={1}
              step={1}
              value={installmentTotal}
              onChange={(e) => handleInstallmentTotalChange(e.target.value)}
              placeholder="Número de parcelas"
              className="w-full p-2 bg-zinc-800 rounded"
            />
          </label>
        )}

        {isClosingAccount && (
          <label className="block mb-3">
            <span className={fieldLabelClass}>Fechamento</span>
            <input
              type="number"
              min={1}
              max={31}
              step={1}
              value={closingDay}
              onChange={(e) => handleClosingDayChange(e.target.value)}
              placeholder="Fechamento (1 a 31)"
              className="w-full p-2 bg-zinc-800 rounded"
            />
          </label>
        )}

        {!isPix && (
          <label className="block mb-3">
            <span className={fieldLabelClass}>Dia de vencimento</span>
            <input
              type="number"
              min={1}
              max={31}
              step={1}
              value={dueDay}
              onChange={(e) => handleDueDayChange(e.target.value)}
              placeholder="Dia de vencimento (1 a 31)"
              className="w-full p-2 bg-zinc-800 rounded"
            />
          </label>
        )}

        {isCreditCard && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            <SwitchControl
              checked={isPrimaryCreditCard}
              label="Principal"
              onChange={setIsPrimaryCreditCard}
            />

            <SwitchControl
              checked={isArchived}
              label="Arquivar"
              onChange={setIsArchived}
            />
          </div>
        )}

        <div className="flex justify-between gap-2">
          <button
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition"
            type="submit"
          >
            Salvar
          </button>

          <button
            onClick={handleClose}
            className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition"
            type="button"
          >
            Cancelar
          </button>
        </div>
      </form>

      {showPrimaryConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] px-4">
          <div className="bg-zinc-900 p-6 rounded-xl w-full max-w-sm border border-zinc-800">
            <h2 className="mb-2 text-lg font-bold">Alterar cartão principal?</h2>

            <p className="text-sm text-zinc-400 mb-5">
              Já existe um cartão principal. Deseja alterar para este cartão?
            </p>

            <div className="flex justify-between gap-2">
              <button
                onClick={() => {
                  setShowPrimaryConfirm(false);
                  handleSave({ skipPrimaryConfirm: true });
                }}
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition"
                type="button"
                autoFocus
              >
                Sim
              </button>

              <button
                onClick={() => setShowPrimaryConfirm(false)}
                className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition"
                type="button"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showArchiveConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] px-4">
          <div className="bg-zinc-900 p-6 rounded-xl w-full max-w-sm border border-zinc-800">
            <h2 className="mb-2 text-lg font-bold">Arquivar cartão?</h2>

            <div className="space-y-2 text-sm text-zinc-400 mb-5">
              <p>
                Este cartão será arquivado e não aparecerá automaticamente nos
                próximos meses.
              </p>
              <p>
                Os lançamentos e faturas já existentes serão mantidos no
                histórico.
              </p>
            </div>

            <div className="flex justify-between gap-2">
              <button
                onClick={() => {
                  setShowArchiveConfirm(false);
                  handleSave({ skipArchiveConfirm: true });
                }}
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition"
                type="button"
                autoFocus
              >
                Arquivar
              </button>

              <button
                onClick={() => setShowArchiveConfirm(false)}
                className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition"
                type="button"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
