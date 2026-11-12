"use client";

import type { ComponentProps } from "react";
import TransactionList from "./TransactionList";

type TransactionListProps = ComponentProps<typeof TransactionList>;
type CardStatementTransactionsProps = TransactionListProps & { loading: boolean };

export default function CardStatementTransactions({
  loading,
  groups,
  ...listProps
}: CardStatementTransactionsProps) {
  if (loading) return <div className="text-zinc-400">Carregando...</div>;
  if (!groups[0]?.items?.length) {
    return (
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 text-zinc-400">
        Nenhum lançamento encontrado com os filtros atuais.
      </div>
    );
  }

  return <TransactionList groups={groups} {...listProps} />;
}
