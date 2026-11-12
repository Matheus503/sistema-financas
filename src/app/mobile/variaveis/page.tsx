"use client";

import MobileAccountTypePage from "../../../features/accounts/ui/MobileAccountTypePage";

export default function MobileVariableAccountsPage() {
  return (
    <MobileAccountTypePage
      accountType="VARIABLE"
      title="Contas Variáveis"
      totalLabel="Total de contas variáveis"
      emptyLabel="Nenhuma conta variável cadastrada"
      deleteTitle="Excluir conta variável"
      deletedMessage="Conta variavel excluida com sucesso."
    />
  );
}
