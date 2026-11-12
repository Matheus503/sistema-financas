"use client";

import { Plus, Trash2 } from "lucide-react";
import type { GroupMemberListItem } from "../../../../domain/finance/groupMember";

type Props = {
  showMoreOptions: boolean;
  showDeleteAccount: boolean;
  isDeletingAccount: boolean;
  showMembers: boolean;
  members: GroupMemberListItem[];
  isLoadingMembers: boolean;
  canDeleteMembers: boolean;
  memberToDelete: GroupMemberListItem | null;
  isDeletingMember: boolean;
  showAddMember: boolean;
  memberName: string;
  memberEmail: string;
  isSavingMember: boolean;
  onCloseMoreOptions: () => void;
  onChooseDeleteAccount: () => void;
  onConfirmDeleteAccount: () => void;
  onCancelDeleteAccount: () => void;
  onOpenAddMember: () => void;
  onCloseMembers: () => void;
  onRequestRemoveMember: (member: GroupMemberListItem) => void;
  onConfirmRemoveMember: () => void;
  onCancelRemoveMember: () => void;
  onMemberNameChange: (value: string) => void;
  onMemberEmailChange: (value: string) => void;
  onSaveMember: () => void;
  onCloseAddMember: () => void;
};

const fieldLabelClass = "mb-1 block text-xs font-semibold text-zinc-400";

export default function DashboardProfileDialogs({
  showMoreOptions,
  showDeleteAccount,
  isDeletingAccount,
  showMembers,
  members,
  isLoadingMembers,
  canDeleteMembers,
  memberToDelete,
  isDeletingMember,
  showAddMember,
  memberName,
  memberEmail,
  isSavingMember,
  onCloseMoreOptions,
  onChooseDeleteAccount,
  onConfirmDeleteAccount,
  onCancelDeleteAccount,
  onOpenAddMember,
  onCloseMembers,
  onRequestRemoveMember,
  onConfirmRemoveMember,
  onCancelRemoveMember,
  onMemberNameChange,
  onMemberEmailChange,
  onSaveMember,
  onCloseAddMember,
}: Props) {
  return (
    <>
      {showMoreOptions && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold">Mais opções</h2>
              <button onClick={onCloseMoreOptions} className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded" type="button">Fechar</button>
            </div>
            <button onClick={onChooseDeleteAccount} className="w-full bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 py-3 rounded-xl font-semibold transition" type="button">
              Excluir conta
            </button>
          </div>
        </div>
      )}

      {showDeleteAccount && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-3">Excluir conta permanentemente</h2>
            <p className="text-sm text-zinc-400">
              Esta ação excluirá permanentemente sua conta do sistema financeiro.
              Se você for administrador de um grupo, todos os dados desse grupo
              serão apagados, incluindo meses, contas, lançamentos, categorias,
              convites e membros. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2 mt-5">
              <button className="flex-1 bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 py-3 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed" onClick={onConfirmDeleteAccount} disabled={isDeletingAccount} type="button" autoFocus>
                {isDeletingAccount ? "Excluindo..." : "Excluir conta"}
              </button>
              <button className="flex-1 bg-zinc-700 hover:bg-zinc-600 py-3 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed" onClick={onCancelDeleteAccount} disabled={isDeletingAccount} type="button">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showMembers && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-bold">Membros</h2>
              <div className="flex items-center gap-2">
                <button onClick={onOpenAddMember} className="bg-purple-600 hover:bg-purple-700 p-2 rounded" type="button" title="Cadastrar membro" aria-label="Cadastrar membro">
                  <Plus size={18} />
                </button>
                <button onClick={onCloseMembers} className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded" type="button">Fechar</button>
              </div>
            </div>
            {isLoadingMembers ? (
              <div className="text-zinc-400">Carregando...</div>
            ) : members.length === 0 ? (
              <div className="text-zinc-400">Nenhum membro encontrado.</div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div key={member.id} className="bg-zinc-800/70 border border-zinc-700 rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">{member.name || member.email.split("@")[0]}</div>
                      <div className="flex items-center gap-2">
                        {member.role === "admin" && <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-semibold text-purple-100 border border-purple-400/20">Admin</span>}
                        {member.status === "pending" && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-200 border border-amber-400/20">Pendente</span>}
                        {canDeleteMembers && member.role !== "admin" && (
                          <button type="button" onClick={() => onRequestRemoveMember(member)} className="p-1 text-zinc-500 hover:text-red-300 transition" title="Remover membro" aria-label={`Remover membro ${member.name || member.email}`}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-zinc-400 break-words">{member.email}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {memberToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-2">Remover membro</h2>
            <p className="text-sm text-zinc-400">
              Deseja remover {memberToDelete.name || memberToDelete.email.split("@")[0]} do grupo?
            </p>
            <div className="flex gap-2 mt-5">
              <button className="flex-1 bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 py-3 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed" onClick={onConfirmRemoveMember} disabled={isDeletingMember} type="button" autoFocus>
                {isDeletingMember ? "Removendo..." : "Remover"}
              </button>
              <button className="flex-1 bg-zinc-700 hover:bg-zinc-600 py-3 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed" onClick={onCancelRemoveMember} disabled={isDeletingMember} type="button">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showAddMember && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] px-4">
          <form className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm p-6" onSubmit={(event) => { event.preventDefault(); onSaveMember(); }}>
            <h2 className="text-lg font-bold mb-4">Cadastrar membro</h2>
            <label className="block mb-3">
              <span className={fieldLabelClass}>Nome</span>
              <input value={memberName} onChange={(event) => onMemberNameChange(event.target.value)} placeholder="Nome" disabled={isSavingMember} className="w-full bg-zinc-800 border border-zinc-700 rounded p-3 outline-none" autoFocus />
            </label>
            <label className="block mb-4">
              <span className={fieldLabelClass}>E-mail</span>
              <input type="email" value={memberEmail} onChange={(event) => onMemberEmailChange(event.target.value)} placeholder="email@exemplo.com" disabled={isSavingMember} className="w-full bg-zinc-800 border border-zinc-700 rounded p-3 outline-none" />
            </label>
            <div className="flex justify-between gap-2">
              <button className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed" disabled={isSavingMember} type="submit">{isSavingMember ? "Salvando..." : "Salvar"}</button>
              <button onClick={onCloseAddMember} className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed" disabled={isSavingMember} type="button">Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
