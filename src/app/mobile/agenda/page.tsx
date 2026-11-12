import MobileAccountTypePage from "../../../features/accounts/ui/MobileAccountTypePage";

export default function MobileAgendaPage() {
  return (
    <MobileAccountTypePage
      agenda
      accountType="VARIABLE"
      title="Agenda financeira"
      totalLabel="Agenda financeira"
      emptyLabel="Nenhum pagamento pendente"
      deleteTitle="Excluir conta"
      deletedMessage="Conta excluída com sucesso."
    />
  );
}
