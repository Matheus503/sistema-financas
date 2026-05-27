"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createAccount } from "../services/accountService";
import type { FinanceAccount } from "../services/accountService";

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
  const [value, setValue] = useState("");
  const [dueDay, setDueDay] = useState("");

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

  if (!open) return null;

  const handleCreate = async () => {
    if (!monthId || !name.trim() || !type) return;

    const parsedDueDay = dueDay ? Number(dueDay) : undefined;

    if (
      parsedDueDay !== undefined &&
      (!Number.isInteger(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 31)
    ) {
      toast.error("Informe um dia de vencimento entre 1 e 31.");
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

    const newAcc = await createAccount(monthId, {
      name: name.trim(),
      type,
      value: parseCurrency(value),
      dia_vencimento: parsedDueDay,
      isPaid: false,
      order: nextOrder,
    });

    setAccounts((prev) => [...prev, newAcc]);

    setName("");
    setValue("");
    setDueDay("");
    onClose();
    toast.success("Conta criada com sucesso.");
  };

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

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da conta"
          className="w-full p-2 bg-zinc-800 rounded mb-3"
        />

        <input
          type="tel"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(formatCurrencyInput(e.target.value))}
          placeholder="Valor inicial (ex: 100,00)"
          className="w-full p-2 bg-zinc-800 rounded mb-3"
        />

        <input
          type="number"
          min={1}
          max={31}
          step={1}
          value={dueDay}
          onChange={(e) => handleDueDayChange(e.target.value)}
          placeholder="Dia de vencimento (1 a 31)"
          className="w-full p-2 bg-zinc-800 rounded mb-3"
        />

        <div className="flex justify-between gap-2">
          <button
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition"
            type="submit"
          >
            Criar
          </button>

          <button
            onClick={() => {
              setName("");
              setValue("");
              setDueDay("");
              onClose();
            }}
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
