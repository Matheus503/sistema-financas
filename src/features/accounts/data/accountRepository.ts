import {
  createAccount,
  updateAccountDetails,
} from "./accountService";
import type { FinanceAccount } from "../../../domain/finance/account";
import { db } from "../../../lib/firestore";

type AccountCreation = Omit<FinanceAccount, "id">;

type AccountUpdate = Parameters<typeof updateAccountDetails>[2];

export const accountRepository = {
  create: (monthId: string, data: AccountCreation) =>
    createAccount(monthId, data, db),
  updateDetails: (
    monthId: string,
    accountId: string,
    data: AccountUpdate,
  ) => updateAccountDetails(monthId, accountId, data, db),
};
