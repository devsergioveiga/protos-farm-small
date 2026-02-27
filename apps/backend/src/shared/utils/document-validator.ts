export function cleanDocument(document: string): string {
  return document.replace(/\D/g, '');
}

export function isValidCPF(cpf: string): boolean {
  const cleaned = cleanDocument(cpf);

  if (cleaned.length !== 11) return false;

  // Rejeita todos os dígitos iguais (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  // Valida primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned[9])) return false;

  // Valida segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned[10])) return false;

  return true;
}

export function isValidCNPJ(cnpj: string): boolean {
  const cleaned = cleanDocument(cnpj);

  if (cleaned.length !== 14) return false;

  // Rejeita todos os dígitos iguais
  if (/^(\d)\1{13}$/.test(cleaned)) return false;

  // Valida primeiro dígito verificador
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cleaned[12])) return false;

  // Valida segundo dígito verificador
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(cleaned[13])) return false;

  return true;
}

export function validateDocument(document: string, type: 'PF' | 'PJ'): boolean {
  if (type === 'PF') return isValidCPF(document);
  return isValidCNPJ(document);
}
