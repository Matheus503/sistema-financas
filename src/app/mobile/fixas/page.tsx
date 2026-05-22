"use client";

import MobileAccountTypePage from "../../../components/MobileAccountTypePage";

export default function MobileFixedAccountsPage() {
  return (
    <MobileAccountTypePage
      accountType="FIXED"
      title="Contas Fixas"
      totalLabel="Total de contas fixas"
      emptyLabel="Nenhuma conta fixa cadastrada"
      deleteTitle="Excluir conta fixa"
      deletedMessage="Conta fixa excluida com sucesso."
    />
  );
}
