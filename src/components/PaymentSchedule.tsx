"use client";

import { groupAccountsByDay } from "../lib/accountSchedule";
import { isPixAccount } from "../services/accountService";
import type { FinanceAccount } from "../services/accountService";

type Props = {
  accounts: FinanceAccount[];
  getAccountValue: (account: FinanceAccount) => number;
  formatMoney: (value: number) => string;
  onClose: () => void;
};

export default function PaymentSchedule({ accounts, getAccountValue, formatMoney, onClose }: Props) {
  const scheduledAccounts = accounts.filter(account => !isPixAccount(account));
  const sections = [
    { title: "Créditos por dia", credit: true, groups: groupAccountsByDay(scheduledAccounts.filter(a => a.type === "CREDIT"), 0) },
    { title: "Pagamentos · Fixas e variáveis", credit: false, groups: groupAccountsByDay(scheduledAccounts.filter(a => a.type === "FIXED" || a.type === "VARIABLE")) },
  ];

  return (
    <section id="payment-schedule" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Agenda de pagamentos</h2>
          <p className="text-sm text-zinc-400">Mês selecionado · Créditos na data de recebimento; pagamentos agrupados até 3 dias após o primeiro vencimento.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl bg-zinc-800 px-4 py-2 hover:bg-zinc-700">Voltar às contas</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map(({ title, credit, groups }) => (
          <div key={title} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-4 font-semibold">{title}</h3>
            {groups.length === 0 && <p className="text-sm text-zinc-400">{credit ? "Nenhum crédito neste mês." : "Nenhuma conta neste mês."}</p>}
            <div className="space-y-3">
              {groups.map(({ day, accounts: group }) => {
                const total = group.reduce((sum, account) => sum + getAccountValue(account), 0);
                const pending = group.filter(account => !account.isPaid).reduce((sum, account) => sum + getAccountValue(account), 0);
                return (
                  <div key={day} className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-semibold">{day === 32 ? "Sem data definida" : `Dia ${day}`}</h4>
                      <span className="text-sm text-zinc-400">Total: {formatMoney(total)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm">{credit ? "A receber" : "Falta pagar"}</span>
                      <strong className={`tabular-nums ${credit ? "text-green-300" : "text-orange-300"}`}>{formatMoney(pending)}</strong>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">{credit ? "Recebido" : "Pago"}: {formatMoney(total - pending)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
