"use client";

import AccountColumn from "../../../accounts/ui/AccountColumn";
import PaymentSchedule from "../../../../components/PaymentSchedule";
import type { FinanceAccount } from "../../../../domain/finance/account";

type Props = {
  accounts: FinanceAccount[];
  showPaymentSchedule: boolean;
  active: boolean;
  getAccountValue: (account: FinanceAccount) => number;
  formatMoney: (value: number) => string;
  onToggle: (account: FinanceAccount) => void;
  onDelete: (account: FinanceAccount) => void;
  onEdit: (account: FinanceAccount) => void;
  onEditDetails: (account: FinanceAccount) => void;
  onAdd: (type: string) => void;
  onOpenStatement: (account: FinanceAccount) => void;
  onOpenPixHistory: (account: FinanceAccount) => void;
  onEditExpectedValue: (account: FinanceAccount) => void;
  onReorder: (type: string, draggedId: string, targetId: string) => void;
  onClosePaymentSchedule: () => void;
};

export default function DashboardFinanceArea({
  accounts,
  showPaymentSchedule,
  active,
  getAccountValue,
  formatMoney,
  onToggle,
  onDelete,
  onEdit,
  onEditDetails,
  onAdd,
  onOpenStatement,
  onOpenPixHistory,
  onEditExpectedValue,
  onReorder,
  onClosePaymentSchedule,
}: Props) {
  const columns = [
    { title: "Créditos", type: "CREDIT" },
    { title: "Contas fixas", type: "FIXED" },
    { title: "Contas variáveis", type: "VARIABLE" },
  ];

  return (
    <>
      {showPaymentSchedule && active && (
        <PaymentSchedule
          accounts={accounts}
          getAccountValue={getAccountValue}
          formatMoney={formatMoney}
          onClose={onClosePaymentSchedule}
        />
      )}
      <div className={showPaymentSchedule ? "hidden" : "grid grid-cols-1 items-start gap-4 md:grid-cols-3"}>
        {columns.map(({ title, type }) => (
          <AccountColumn
            key={type}
            title={title}
            type={type}
            accounts={accounts}
            getAccountValue={getAccountValue}
            formatMoney={formatMoney}
            onDelete={onDelete}
            onToggle={onToggle}
            onEdit={onEdit}
            onEditDetails={onEditDetails}
            onAdd={onAdd}
            onOpenStatement={type === "VARIABLE" ? onOpenStatement : undefined}
            onOpenPixHistory={type === "VARIABLE" ? onOpenPixHistory : undefined}
            onEditExpectedValue={type === "VARIABLE" ? onEditExpectedValue : undefined}
            onReorder={onReorder}
          />
        ))}
      </div>
    </>
  );
}
