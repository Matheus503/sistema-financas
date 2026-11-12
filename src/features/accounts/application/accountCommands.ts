import { accountRepository } from "../data/accountRepository";
import type { FinanceAccount } from "../../../domain/finance/account";

type AccountCreation = Omit<FinanceAccount, "id">;
type AccountUpdate = Parameters<typeof accountRepository.updateDetails>[2];

export function createFinanceAccount(monthId: string, data: AccountCreation) {
  return accountRepository.create(monthId, data);
}

export function updateFinanceAccountDetails(
  monthId: string,
  accountId: string,
  data: AccountUpdate,
) {
  return accountRepository.updateDetails(monthId, accountId, data);
}
