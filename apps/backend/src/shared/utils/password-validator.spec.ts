import { validatePasswordStrength } from './password-validator';

describe('validatePasswordStrength', () => {
  it('should accept a valid password', () => {
    const result = validatePasswordStrength('Test@1234');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject password shorter than 8 characters', () => {
    const result = validatePasswordStrength('Te@1');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('A senha deve ter no mínimo 8 caracteres');
  });

  it('should reject password without uppercase letter', () => {
    const result = validatePasswordStrength('test@1234');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('A senha deve conter pelo menos 1 letra maiúscula');
  });

  it('should reject password without number', () => {
    const result = validatePasswordStrength('Test@abcd');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('A senha deve conter pelo menos 1 número');
  });

  it('should reject password without special character', () => {
    const result = validatePasswordStrength('Test12345');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('A senha deve conter pelo menos 1 caractere especial');
  });

  it('should return multiple errors for a very weak password', () => {
    const result = validatePasswordStrength('abc');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('should accept password with various special characters', () => {
    expect(validatePasswordStrength('Test@1234').valid).toBe(true);
    expect(validatePasswordStrength('Test#1234').valid).toBe(true);
    expect(validatePasswordStrength('Test!1234').valid).toBe(true);
    expect(validatePasswordStrength('Test$1234').valid).toBe(true);
  });

  it('should accept exactly 8 characters', () => {
    const result = validatePasswordStrength('Te@1abcd');
    expect(result.valid).toBe(true);
  });
});
