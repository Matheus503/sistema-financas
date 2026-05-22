"use client";

import MobileAccountTypePage from "../../../components/MobileAccountTypePage";

export default function MobileCreditsPage() {
  return (
    <MobileAccountTypePage
      accountType="CREDIT"
      title="Créditos"
      totalLabel="Total de créditos"
      emptyLabel="Nenhum crédito cadastrado"
      deleteTitle="Excluir crédito"
      deletedMessage="Credito excluido com sucesso."
    />
  );
}
