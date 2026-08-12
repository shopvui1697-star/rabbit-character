/**
 * AIInput - AI-aware input component
 *
 * A regular input that also registers itself with the AI system.
 * The AI can fill, clear, and read this input via voice commands.
 *
 * Usage:
 *   <AIInput
 *     id="username"
 *     label="Username"
 *     aiHints={["name", "user name", "my name"]}
 *     value={value}
 *     onChange={setValue}
 *   />
 */

import React, { useCallback, useRef, useEffect } from 'react';
import { useAIField } from '../../hooks/useAIField';

export interface AIInputProps {
  /** Unique ID */
  id: string;
  /** Label displayed to user and used by AI */
  label: string;
  /** Input type */
  type?: string;
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Additional AI hints */
  aiHints?: string[];
  /** Form ID this input belongs to */
  formId?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Validation description */
  validation?: string;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Additional className */
  className?: string;
  /** autoComplete */
  autoComplete?: string;
}

export function AIInput({
  id,
  label,
  type = 'text',
  value,
  onChange,
  aiHints,
  formId,
  placeholder,
  validation,
  disabled = false,
  error,
  className = '',
  autoComplete,
}: AIInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const setValue = useCallback(
    (newValue: string) => {
      onChange(newValue);
      // Also update the DOM element directly for React controlled inputs
      if (inputRef.current) {
        // Trigger React's synthetic event system
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeInputValueSetter?.call(inputRef.current, newValue);
        inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
      }
    },
    [onChange]
  );

  // Register with AI system
  useAIField({
    id,
    type: 'input',
    label,
    inputType: type,
    aiHints,
    formId,
    placeholder,
    validation,
    isActive: !disabled,
    getValue: () => valueRef.current,
    setValue,
  });

  // Visual feedback when AI interacts with this field
  const [aiHighlight, setAiHighlight] = React.useState(false);

  useEffect(() => {
    // Flash highlight when value changes (possibly by AI)
    if (value) {
      setAiHighlight(true);
      const timer = setTimeout(() => setAiHighlight(false), 600);
      return () => clearTimeout(timer);
    }
  }, [value]);

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
      <input
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        className={`ai-field__input ${aiHighlight ? 'ai-field__input--highlight' : ''}`}
        aria-label={label}
        aria-invalid={!!error}
      />
      {error && <span className="ai-field__error">{error}</span>}
    </div>
  );
}
