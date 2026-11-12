export const formatCurrencyInput = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return (Number(digits) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const parseCurrencyInput = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
};

export const formatCurrencyAmount = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
