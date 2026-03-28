export interface SpedValidationItem {
  severity: 'ERROR' | 'WARNING';
  code: string;
  message: string;
  navigateTo?: string;
}

export interface SpedValidationResult {
  items: SpedValidationItem[];
  hasErrors: boolean;
}
