"use client";

import type { FormEvent } from "react";
import type { GroupMemberListItem } from "../../../../domain/finance/groupMember";
import { Plus, Trash2 } from "lucide-react";

type MobileDashboardMembersDialogsProps = {
  showMembers: boolean;
  showAddMember: boolean;
  members: GroupMemberListItem[];
  isLoadingMembers: boolean;
  canDeleteMembers: boolean;
  memberToDelete: GroupMemberListItem | null;
  isDeletingMember: boolean;
  isSavingMember: boolean;
  memberName: string;
  memberEmail: string;
  onOpenAddMember: () => void;
  onCloseMembers: () => void;
  onRequestDelete: (member: GroupMemberListItem) => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onMemberNameChange: (name: string) => void;
  onMemberEmailChange: (email: string) => void;
  onSaveMember: () => void;
  onCancelAddMember: () => void;
};

const getMemberDisplayName = (member: GroupMemberListItem) =>
  member.name || member.email.split("@")[0];

export default function MobileDashboardMembersDialogs({
  showMembers,
  showAddMember,
  members,
  isLoadingMembers,
  canDeleteMembers,
  memberToDelete,
  isDeletingMember,
  isSavingMember,
  memberName,
  memberEmail,
  onOpenAddMember,
  onCloseMembers,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onMemberNameChange,
  onMemberEmailChange,
  onSaveMember,
  onCancelAddMember,
}: MobileDashboardMembersDialogsProps) {
  const submitMember = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaveMember();
  };

  return (
    <>
      {showMembers && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold">Membros</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenAddMember}
                  className="bg-purple-600 hover:bg-purple-700 p-2 rounded-lg"
                  type="button"
                  title="Cadastrar membro"
                  aria-label="Cadastrar membro"
                >
                  <Plus size={18} />
                </button>
                <button
                  onClick={onCloseMembers}
                  className="bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-lg text-sm"
                  type="button"
                >
                  Fechar
                </button>
              </div>
            </div>

            {isLoadingMembers ? (
              <div className="text-sm text-zinc-400">Carregando...</div>
            ) : members.length === 0 ? (
              <div className="text-sm text-zinc-400">Nenhum membro encontrado.</div>
            ) : (
              <div className="max-h-[58vh] overflow-y-auto pr-1 space-y-2">
                {members.map((member) => (
                  <div key={member.id} className="bg-zinc-800/70 border border-zinc-700 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 font-semibold truncate">{getMemberDisplayName(member)}</div>
                      <div className="flex shrink-0 items-center gap-2">
                        {member.role === "admin" && (
                          <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[11px] font-semibold text-purple-100 border border-purple-400/20">
                            Admin
                          </span>
                        )}
                        {member.status === "pending" && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200 border border-amber-400/20">
                            Pendente
                          </span>
                        )}
                        {canDeleteMembers && member.role !== "admin" && (
                          <button
                            type="button"
                            onClick={() => onRequestDelete(member)}
                            className="p-1 text-zinc-500 hover:text-red-300 transition"
                            title="Remover membro"
                            aria-label={`Remover membro ${member.name || member.email}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-zinc-400 break-words mt-1">{member.email}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {memberToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-5">
            <h2 className="text-lg font-bold mb-2">Remover membro</h2>
            <p className="text-sm text-zinc-400">
              Deseja remover {getMemberDisplayName(memberToDelete)} do grupo?
            </p>
            <div className="flex gap-2 mt-5">
              <button
                className="flex-1 bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 py-3 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={onConfirmDelete}
                disabled={isDeletingMember}
                type="button"
                autoFocus
              >
                {isDeletingMember ? "Removendo..." : "Remover"}
              </button>
              <button
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 py-3 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={onCancelDelete}
                disabled={isDeletingMember}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddMember && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] px-4">
          <form
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-5"
            onSubmit={submitMember}
          >
            <h2 className="text-lg font-bold mb-4">Cadastrar membro</h2>
            <label className="block mb-3">
              <span className="mb-1 block text-xs font-semibold text-zinc-400">Nome</span>
              <input
                value={memberName}
                onChange={(event) => onMemberNameChange(event.target.value)}
                placeholder="Nome"
                disabled={isSavingMember}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 outline-none"
                autoFocus
              />
            </label>
            <label className="block mb-4">
              <span className="mb-1 block text-xs font-semibold text-zinc-400">E-mail</span>
              <input
                type="email"
                value={memberEmail}
                onChange={(event) => onMemberEmailChange(event.target.value)}
                placeholder="email@exemplo.com"
                disabled={isSavingMember}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 outline-none"
              />
            </label>
            <div className="flex justify-between gap-2">
              <button
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isSavingMember}
                type="submit"
              >
                {isSavingMember ? "Salvando..." : "Salvar"}
              </button>
              <button
                onClick={onCancelAddMember}
                className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isSavingMember}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
