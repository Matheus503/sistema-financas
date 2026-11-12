import {
  deleteAccount,
  updateAccountExpectedValue,
  updateAccountValue,
  updateAccountsOrder,
} from "../../accounts/data/accountService";
import { createMonth, getAllMonths } from "../../months/data/monthService";
import { db } from "../../../lib/firestore";

const updateExpectedValue = (
  monthId: string,
  accountId: string,
  expectedValue: number,
) => updateAccountExpectedValue(monthId, accountId, expectedValue, db);

const saveAccountsOrder = (
  monthId: string,
  accounts: { id: string; order: number }[],
) => updateAccountsOrder(monthId, accounts, db);

export const dashboardAccountRepository = {
  createMonth: (year: number, month: number, userId: string, groupId: string) =>
    createMonth(year, month, userId, groupId, db),
  getAllMonths: (groupId: string) => getAllMonths(groupId, db),
  updateAccountValue: (monthId: string, accountId: string, value: number) =>
    updateAccountValue(monthId, accountId, value, db),
  updateAccountExpectedValue: updateExpectedValue,
  deleteAccount: (monthId: string, accountId: string) => deleteAccount(monthId, accountId, db),
  updateAccountsOrder: saveAccountsOrder,
};
