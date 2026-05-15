"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { FinanceAccount } from "../services/accountService";
import { updateAccountDetails } from "../services/accountService";

type Props = {
  open: boolean;
  onClose: () => void;
  monthId: string | null;
  account: FinanceAccount | null;
  setAccounts: React.Dispatch<React.SetStateAction<FinanceAccount[]>>;
};

export default function EditAccountModal({
  open,
  onClose,
  monthId,
  account,
  setAccounts,
}: Props) {
  if (!open || !account) return null;

  return (
    <EditAccountForm
      key={account.id}
      onClose={onClose}
      monthId={monthId}
      account={account}
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
  setAccounts,
}: FormProps) {
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

  const parseCurrency = (v: string) => {
    if (!v) return 0;
    return Number(v.replace(/\./g, "").replace(",", "."));
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

  const handleClose = () => {
    setName("");
    setValue("");
    setDueDay("");
    onClose();
  };

  const handleSave = async () => {
    if (!monthId || !account) return;

    const parsedName = name.trim();
    if (!parsedName) {
      toast.error("Informe o nome.");
      return;
    }

    const parsedDueDay = dueDay ? Number(dueDay) : undefined;

    if (
      parsedDueDay !== undefined &&
      (!Number.isInteger(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 31)
    ) {
      toast.error("Informe um dia de vencimento entre 1 e 31.");
      return;
    }

    const parsedValue = parseCurrency(value);
    const updated = await updateAccountDetails(monthId, account.id, {
      name: parsedName,
      value: parsedValue,
      dia_vencimento: parsedDueDay,
    });

    setAccounts((prev) =>
      prev.map((item) =>
        item.id === account.id
          ? {
              ...item,
              name: updated.name,
              value: updated.value,
              dia_vencimento: updated.dia_vencimento,
            }
          : item
      )
    );

    handleClose();
    toast.success("Conta atualizada com sucesso.");
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-zinc-900 p-6 rounded-xl w-80 border border-zinc-800">
        <h2 className="mb-3 text-lg font-bold">Editar conta</h2>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da conta"
          className="w-full p-2 bg-zinc-800 rounded mb-3"
        />

        <input
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ""))}
          placeholder="Valor"
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

        <div className="flex justify-between">
          <button
            onClick={handleSave}
            className="bg-green-600 px-4 py-2 rounded"
            type="button"
          >
            Salvar
          </button>

          <button
            onClick={handleClose}
            className="bg-red-600 px-4 py-2 rounded"
            type="button"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
