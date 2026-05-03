"use client";

type TransactionItem = {
  id: string;
  transactionId: string;
  monthId: string;
  date: string;
  value: number;
  monthLabel: string;
  monthOrder: number;
  note?: string;
  category?: string;
  userId?: string;
  userName?: string;
  launcherId?: string;
  launcherName?: string;
};

type TransactionGroup = {
  monthLabel: string;
  items: TransactionItem[];
};

type Props = {
  groups: TransactionGroup[];
  showValues: boolean;
  formatMoney: (value: number) => string;
  onEdit: (item: TransactionItem) => void;
  onDelete: (item: TransactionItem) => void;
};

export default function TransactionList({
  groups,
  showValues,
  formatMoney,
  onEdit,
  onDelete,
}: Props) {
  const formatDate = (dateString: string) => {
    const dateKey = String(dateString || "").slice(0, 10);
    const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (match) {
      return `${match[3]}/${match[2]}`;
    }

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "--/--";

    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div
          key={group.monthLabel}
          className="bg-zinc-900/70 border border-zinc-800 rounded-2xl overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-zinc-800">
            <h2 className="font-semibold text-zinc-100">{group.monthLabel}</h2>
          </div>

          <div className="divide-y divide-zinc-800">
            {group.items.map((item) => {
              const hasCategory = item.category?.trim();
              const hasNote = item.note?.trim();

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[90px_1fr_140px_30px] gap-3 px-4 py-3 items-center hover:bg-zinc-800/40 transition"
                >
                  <span className="text-sm text-zinc-300">
                    {formatDate(item.date)}
                  </span>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {hasCategory ? item.category : "Lançamento"}
                    </p>

                    {hasNote && (
                      <p className="text-xs text-zinc-400 truncate">
                        {item.note}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <span
                      onClick={() => onEdit(item)}
                      className="text-red-400 font-semibold cursor-pointer hover:underline"
                    >
                      {showValues ? formatMoney(item.value) : "R$ ••••••"}
                    </span>
                  </div>

                  <button
                    onClick={() => onDelete(item)}
                    className="text-zinc-400 hover:text-red-400"
                    title="Excluir"
                    type="button"
                  >
                    🗑
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
