"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createAccount } from "../services/accountService";
import type { FinanceAccount } from "../services/accountService";
import { useModalKeyboardActions } from "../hooks/useModalKeyboardActions";
import SwitchControl from "./SwitchControl";

type Props = {
  open: boolean;
  onClose: () => void;
  monthId: string | null;
  type: string | null;
  accounts: FinanceAccount[];
  setAccounts: React.Dispatch<React.SetStateAction<FinanceAccount[]>>;
};

export default function CreateAccountModal({
  open,
  onClose,
  monthId,
  type,
  accounts,
  setAccounts,
}: Props) {
  const [name, setName] = useState("");
  const [isCreditCard, setIsCreditCard] = useState(false);
  const [value, setValue] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [closingDay, setClosingDay] = useState("");
  const [installmentTotal, setInstallmentTotal] = useState("");
  const supportsInstallments = type === "FIXED" || type === "CREDIT";
  const fieldLabelClass = "mb-1 block text-xs font-semibold text-zinc-400";

  const parseCurrency = (v: string) => {
    if (!v) return 0;
    return Number(v.replace(/\./g, "").replace(",", "."));
  };

  const formatCurrencyInput = (nextValue: string) => {
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

  useEffect(() => {
    if (!open || type !== "VARIABLE") {
      setIsCreditCard(false);
      setClosingDay("");
    }

    if (!open || !supportsInstallments) {
      setInstallmentTotal("");
    }
  }, [open, supportsInstallments, type]);

  const handleClose = () => {
    setName("");
    setIsCreditCard(false);
    setValue("");
    setDueDay("");
    setClosingDay("");
    setInstallmentTotal("");
    onClose();
  };

  const handleCreate = async () => {
    if (!monthId || !name.trim() || !type) return;

    const parsedDueDay = dueDay ? Number(dueDay) : undefined;
    const parsedClosingDay =
      isCreditCard && closingDay ? Number(closingDay) : undefined;
    const parsedInstallmentTotal =
      supportsInstallments && installmentTotal
        ? Number(installmentTotal)
        : undefined;

    if (
      parsedDueDay !== undefined &&
      (!Number.isInteger(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 31)
    ) {
      toast.error("Informe um dia de vencimento entre 1 e 31.");
      return;
    }

    if (
      isCreditCard &&
      parsedClosingDay === undefined
    ) {
      toast.error("Informe o dia de fechamento do cartao.");
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
      (!Number.isInteger(parsedInstallmentTotal) ||
        parsedInstallmentTotal < 1)
    ) {
      toast.error("Informe um numero de parcelas valido.");
      return;
    }

    const sameTypeAccounts = accounts.filter((acc) => acc.type === type);
    const nextOrder =
      sameTypeAccounts.length > 0
        ? Math.max(
            ...sameTypeAccounts.map((acc, index) =>
              Number.isFinite(Number(acc.order)) ? Number(acc.order) : index
            )
          ) + 1
        : 0;

    const trimmedName = name.trim();
    const shouldUseInstallments =
      supportsInstallments && parsedInstallmentTotal !== undefined;

    const newAcc = await createAccount(monthId, {
      name: shouldUseInstallments
        ? `${trimmedName} - 1/${parsedInstallmentTotal}`
        : trimmedName,
      type,
      value: isCreditCard ? 0 : parseCurrency(value),
      dia_vencimento: parsedDueDay,
      dia_fechamento: parsedClosingDay,
      isCreditCard: type === "VARIABLE" ? isCreditCard : false,
      ...(shouldUseInstallments
        ? {
            installmentBaseName: trimmedName,
            installmentCurrent: 1,
            installmentTotal: parsedInstallmentTotal,
            installmentGroupId: createInstallmentGroupId(),
          }
        : {}),
      isPaid: false,
      order: nextOrder,
    });

    setAccounts((prev) => [...prev, newAcc]);

    handleClose();
    toast.success("Conta criada com sucesso.");
  };

  useModalKeyboardActions({
    enabled: open,
    onCancel: handleClose,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
      <form
        className="bg-zinc-900 p-6 rounded-xl w-80"
        onSubmit={(event) => {
          event.preventDefault();
          handleCreate();
        }}
      >
        <h2 className="mb-3 text-lg font-bold">Nova Conta</h2>

        <div className="text-sm text-zinc-400 mb-3">Tipo: {type}</div>

        <label className="block mb-3">
          <span className={fieldLabelClass}>Nome da conta</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da conta"
            className="w-full p-2 bg-zinc-800 rounded"
          />
        </label>

        {type === "VARIABLE" && (
          <div className="mb-3">
            <SwitchControl
              checked={isCreditCard}
              label="Cartão de crédito"
              onChange={(checked) => {
                setIsCreditCard(checked);

                if (!checked) {
                  setClosingDay("");
                }
              }}
            />
          </div>
        )}

        {!isCreditCard && (
          <label className="block mb-3">
            <span className={fieldLabelClass}>Valor inicial</span>
            <input
              type="tel"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(formatCurrencyInput(e.target.value))}
              placeholder="Ex: 100,00"
              className="w-full p-2 bg-zinc-800 rounded"
            />
          </label>
        )}

        {isCreditCard && (
          <label className="block mb-3">
            <span className={fieldLabelClass}>Fechamento</span>
            <input
              type="number"
              min={1}
              max={31}
              step={1}
              value={closingDay}
              onChange={(e) => handleClosingDayChange(e.target.value)}
              placeholder="1 a 31"
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

        <label className="block mb-3">
          <span className={fieldLabelClass}>Dia de vencimento</span>
          <input
            type="number"
            min={1}
            max={31}
            step={1}
            value={dueDay}
            onChange={(e) => handleDueDayChange(e.target.value)}
            placeholder="1 a 31"
            className="w-full p-2 bg-zinc-800 rounded"
          />
        </label>

        <div className="flex justify-between gap-2">
          <button
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition"
            type="submit"
          >
            Criar
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
    </div>
  );
}
