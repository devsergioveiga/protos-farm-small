import { useRef, useCallback } from 'react';
import { CheckCircle } from 'lucide-react';

interface NotesTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
  saved: boolean;
  loading: boolean;
}

export default function NotesTextarea({
  value,
  onChange,
  onSave,
  saved,
  loading,
}: NotesTextareaProps) {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      onChange(newValue);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        onSave(newValue);
      }, 2000);
    },
    [onChange, onSave],
  );

  return (
    <div className="notes-textarea">
      <label
        htmlFor="notes-textarea"
        className="notes-textarea__label"
      >
        Notas explicativas adicionais
      </label>
      <p id="notes-helper" className="notes-textarea__helper">
        O sistema gera automaticamente politicas contabeis, CPC 29 e contexto operacional. Use este
        campo para notas do contador.
      </p>
      <textarea
        id="notes-textarea"
        className="notes-textarea__field"
        aria-describedby="notes-helper"
        rows={4}
        value={value}
        onChange={handleChange}
        disabled={loading}
        aria-label="Notas explicativas adicionais"
      />
      <span
        className={`notes-textarea__saved-indicator ${saved ? 'notes-textarea__saved-indicator--visible' : ''}`}
        aria-live="polite"
      >
        <CheckCircle size={14} aria-hidden="true" />
        Notas salvas
      </span>
    </div>
  );
}
