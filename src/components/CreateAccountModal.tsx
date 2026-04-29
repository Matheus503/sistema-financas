"use client";

import { useState } from "react";
import { createAccount } from "../services/accountService";

type Props = {
  open: boolean;
  onClose: () => void;
  monthId: string | null;
  type: string | null;
  setAccounts: React.Dispatch<React.SetStateAction<any[]>>;
};

export default function CreateAccountModal({
  open,
  onClose,
  monthId,
  type,
  setAccounts,
}: Props) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");

  const parseCurrency = (v: string) => {
    if (!v) return 0;
    return Number(v.replace(/\./g, "").replace(",", "."));
  };

  if (!open) return null;

  const handleCreate = async () => {
    if (!monthId || !name.trim() || !type) return;

    const newAcc = await createAccount(monthId, {
      name: name.trim(),
      type,
      value: parseCurrency(value),
      isPaid: false,
    });

    setAccounts((prev) => [...prev, newAcc]);

    setName("");
    setValue("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
      <div className="bg-zinc-900 p-6 rounded-xl w-80">
        <h2 className="mb-3 text-lg font-bold">Nova Conta</h2>

        <div className="text-sm text-zinc-400 mb-3">Tipo: {type}</div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da conta"
          className="w-full p-2 bg-zinc-800 rounded mb-3"
        />

        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Valor inicial (ex: 100,00)"
          className="w-full p-2 bg-zinc-800 rounded mb-3"
        />

        <div className="flex justify-between">
          <button
            onClick={handleCreate}
            className="bg-green-600 px-4 py-2 rounded"
            type="button"
          >
            Criar
          </button>

          <button
            onClick={() => {
              setName("");
              setValue("");
              onClose();
            }}
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