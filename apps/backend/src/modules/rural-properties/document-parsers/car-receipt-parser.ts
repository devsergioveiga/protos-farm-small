export interface CarReceiptData {
  carCode: string | null;
  status: string | null;
}

export function parseCarReceipt(text: string): CarReceiptData {
  const result: CarReceiptData = {
    carCode: null,
    status: null,
  };

  // CAR code — pattern: UF-HASH (e.g., MG-3144607-4C039834C1AB47388FDEB2C2ECFE4355)
  const carMatch = text.match(/([A-Z]{2}-[\dA-F-]{7,}[\dA-F]+)/i);
  if (carMatch) result.carCode = carMatch[1].toUpperCase();

  // Status — "ATIVO", "PENDENTE", "CANCELADO", "SUSPENSO"
  const statusMatch = text.match(
    /(?:status|situa[çc][ãa]o)[:\s]*(ATIVO|PENDENTE|CANCELADO|SUSPENSO)/i,
  );
  if (statusMatch) result.status = statusMatch[1].toUpperCase();

  return result;
}
