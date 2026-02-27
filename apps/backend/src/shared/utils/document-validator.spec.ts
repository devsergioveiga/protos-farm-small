import { isValidCPF, isValidCNPJ, validateDocument, cleanDocument } from './document-validator';

describe('document-validator', () => {
  // ─── cleanDocument ──────────────────────────────────────────────

  describe('cleanDocument', () => {
    it('should remove non-digit characters', () => {
      expect(cleanDocument('123.456.789-09')).toBe('12345678909');
      expect(cleanDocument('11.222.333/0001-81')).toBe('11222333000181');
    });
  });

  // ─── isValidCPF ─────────────────────────────────────────────────

  describe('isValidCPF', () => {
    it('should validate a correct CPF', () => {
      expect(isValidCPF('529.982.247-25')).toBe(true);
    });

    it('should validate a correct CPF without formatting', () => {
      expect(isValidCPF('52998224725')).toBe(true);
    });

    it('should reject CPF with all same digits', () => {
      expect(isValidCPF('111.111.111-11')).toBe(false);
      expect(isValidCPF('000.000.000-00')).toBe(false);
    });

    it('should reject CPF with wrong check digits', () => {
      expect(isValidCPF('529.982.247-26')).toBe(false);
    });

    it('should reject CPF with wrong length', () => {
      expect(isValidCPF('1234567890')).toBe(false);
      expect(isValidCPF('123456789012')).toBe(false);
    });
  });

  // ─── isValidCNPJ ────────────────────────────────────────────────

  describe('isValidCNPJ', () => {
    it('should validate a correct CNPJ', () => {
      expect(isValidCNPJ('11.222.333/0001-81')).toBe(true);
    });

    it('should validate a correct CNPJ without formatting', () => {
      expect(isValidCNPJ('11222333000181')).toBe(true);
    });

    it('should reject CNPJ with all same digits', () => {
      expect(isValidCNPJ('11.111.111/1111-11')).toBe(false);
      expect(isValidCNPJ('00.000.000/0000-00')).toBe(false);
    });

    it('should reject CNPJ with wrong check digits', () => {
      expect(isValidCNPJ('11.222.333/0001-82')).toBe(false);
    });

    it('should reject CNPJ with wrong length', () => {
      expect(isValidCNPJ('1122233300018')).toBe(false);
      expect(isValidCNPJ('112223330001811')).toBe(false);
    });
  });

  // ─── validateDocument ───────────────────────────────────────────

  describe('validateDocument', () => {
    it('should validate CPF when type is PF', () => {
      expect(validateDocument('529.982.247-25', 'PF')).toBe(true);
      expect(validateDocument('529.982.247-26', 'PF')).toBe(false);
    });

    it('should validate CNPJ when type is PJ', () => {
      expect(validateDocument('11.222.333/0001-81', 'PJ')).toBe(true);
      expect(validateDocument('11.222.333/0001-82', 'PJ')).toBe(false);
    });
  });
});
