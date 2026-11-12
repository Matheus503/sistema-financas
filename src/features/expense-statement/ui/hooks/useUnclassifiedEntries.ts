import { useEffect, useMemo, useState } from "react";
import type { FinanceAccount } from "../../../../domain/finance/account";
import type { StatementTransaction } from "../../../../domain/finance/expenseStatement";
import {
  getAccountsForUnclassifiedEntries,
  getUnclassifiedEntryKey,
  linkUnclassifiedExpenseEntry,
} from "../../application/unclassifiedEntries";

export function useUnclassifiedEntries(
  entries: StatementTransaction[],
  onLinked: (entry: StatementTransaction, account: FinanceAccount) => void,
) {
  const [accounts, setAccounts] = useState<Record<string, FinanceAccount[]>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState("");
  const [loadedMonthIds, setLoadedMonthIds] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<{ monthIds: string; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const monthIds = useMemo(() => [...new Set(
    entries.map((entry) => entry.monthId).filter((id): id is string => Boolean(id)),
  )].sort(), [entries]);
  const monthIdsKey = JSON.stringify(monthIds);

  useEffect(() => {
    let active = true;
    void getAccountsForUnclassifiedEntries(JSON.parse(monthIdsKey) as string[])
      .then((loadedAccounts) => {
        if (active) {
          setAccounts(loadedAccounts);
          setLoadError(null);
          setLoadedMonthIds(monthIdsKey);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError({ monthIds: monthIdsKey, message: "Não foi possível carregar as contas." });
          setLoadedMonthIds(monthIdsKey);
        }
      });
    return () => {
      active = false;
    };
  }, [monthIdsKey, retry]);

  async function linkEntry(entry: StatementTransaction) {
    const key = getUnclassifiedEntryKey(entry);
    const accountId = choices[key];
    if (!entry.monthId || !accountId || saving) return;
    setSaving(key);
    setLoadError(null);
    try {
      const account = await linkUnclassifiedExpenseEntry(entry.monthId, entry.id, accountId);
      onLinked(entry, account);
    } catch (cause) {
      setLoadError({ monthIds: monthIdsKey, message: cause instanceof Error ? cause.message : "Não foi possível vincular a conta." });
    } finally {
      setSaving("");
    }
  }

  return {
    accounts,
    choices,
    setChoice: (entry: StatementTransaction, accountId: string) => {
      const key = getUnclassifiedEntryKey(entry);
      setChoices((current) => ({ ...current, [key]: accountId }));
    },
    loading: loadedMonthIds !== monthIdsKey,
    saving,
    error: loadError?.monthIds === monthIdsKey ? loadError.message : "",
    retry: () => {
      setLoadedMonthIds(null);
      setRetry((current) => current + 1);
    },
    linkEntry,
  };
}
