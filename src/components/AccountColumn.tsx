"use client";

type Props = {
  title: string;
  type: string;
  accounts: any[];
  totalValue: number;
  getAccountValue: (acc: any) => number;
  formatMoney: (v: number) => string;
  onDelete: (acc: any) => void;
  onToggle: (acc: any) => void;
  onEdit: (acc: any) => void;
  onAdd: (type: string) => void;
};

export default function AccountColumn({
  title,
  type,
  accounts,
  totalValue,
  getAccountValue,
  formatMoney,
  onDelete,
  onToggle,
  onEdit,
  onAdd,
}: Props) {
  return (
    <div className="bg-zinc-900/70 p-4 rounded-2xl border border-zinc-800">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-zinc-400">
            Total: {formatMoney(totalValue)}
          </p>
        </div>

        <button
          onClick={() => onAdd(type)}
          className="bg-purple-600 hover:bg-purple-700 w-7 h-7 rounded-full transition"
          type="button"
        >
          +
        </button>
      </div>

      <div className="space-y-2">
        {accounts
          .filter((a) => a.type === type)
          .map((acc) => {
            const isNubank = acc.name?.includes("Nubank");

            return (
              <div
                key={acc.id}
                onClick={() => onToggle(acc)}
                className={`flex justify-between items-center p-3 rounded-xl cursor-pointer transition border
                  ${
                    acc.isPaid
                      ? "bg-green-500/18 border-l-4 border-l-green-400 border-green-400/25 hover:bg-green-500/24"
                      : "bg-red-500/18 border-l-4 border-l-red-400 border-red-400/25 hover:bg-red-500/24"
                  }
                `}
              >
                <span className="pr-2">{acc.name}</span>

                <div
                  className="flex gap-2 items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span
                    onClick={() => onEdit(acc)}
                    className="cursor-pointer hover:underline"
                  >
                    {formatMoney(getAccountValue(acc))}
                  </span>

                  {!isNubank && (
                    <button onClick={() => onDelete(acc)} type="button">
                      🗑
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}