/**
 * AISelect - AI-aware select/dropdown component
 *
 * A regular select that also registers itself with the AI system.
 * The AI can select options via voice commands.
 */

import React, { useCallback, useRef } from 'react';
import { useAIField } from '../../hooks/useAIField';

export interface AISelectOption {
  value: string;
  label: string;
}

export interface AISelectProps {
  /** Unique ID */
  id: string;
  /** Label displayed to user and used by AI */
  label: string;
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Options */
  options: AISelectOption[];
  /** Additional AI hints */
  aiHints?: string[];
  /** Form ID this select belongs to */
  formId?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether select is disabled */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Additional className */
  className?: string;
}

export function AISelect({
  id,
  label,
  value,
  onChange,
  options,
  aiHints,
  formId,
  placeholder,
  disabled = false,
  error,
  className = '',
}: AISelectProps) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const setValue = useCallback(
    (newValue: string) => {
      onChange(newValue);
    },
    [onChange]
  );

  // Register with AI system
  useAIField({
    id,
    type: 'select',
    label,
    aiHints,
    formId,
    placeholder,
    isActive: !disabled,
    getValue: () => valueRef.current,
    setValue,
    options,
  });

  return (
    <div className={`ai-field ${className} ${error ? 'ai-field--error' : ''}`}>
      <label htmlFor={id} className="ai-field__label">
        {label}
        <span className="ai-field__ai-badge" title="Voice-enabled field">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        </span>
      </label>
      <select
        ref={selectRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="ai-field__select"
        aria-label={label}
        aria-invalid={!!error}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="ai-field__error">{error}</span>}
    </div>
  );
}
