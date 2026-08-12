/**
 * AICheckbox - AI-aware checkbox component
 *
 * A regular checkbox that registers itself with the AI system.
 * The AI can check/uncheck this via voice commands.
 */

import React, { useCallback, useRef } from 'react';
import { useAIField } from '../../hooks/useAIField';

export interface AICheckboxProps {
  /** Unique ID */
  id: string;
  /** Label displayed to user and used by AI */
  label: string;
  /** Current checked state */
  checked: boolean;
  /** Change handler */
  onChange: (checked: boolean) => void;
  /** Additional AI hints */
  aiHints?: string[];
  /** Form ID this checkbox belongs to */
  formId?: string;
  /** Whether checkbox is disabled */
  disabled?: boolean;
  /** Additional className */
  className?: string;
}

export function AICheckbox({
  id,
  label,
  checked,
  onChange,
  aiHints,
  formId,
  disabled = false,
  className = '',
}: AICheckboxProps) {
  const checkedRef = useRef(checked);
  checkedRef.current = checked;

  const toggle = useCallback(() => {
    onChange(!checkedRef.current);
  }, [onChange]);

  // Register with AI system
  useAIField({
    id,
    type: 'checkbox',
    label,
    aiHints,
    formId,
    isActive: !disabled,
    getValue: () => (checkedRef.current ? 'checked' : 'unchecked'),
    setValue: (val) => onChange(val === 'checked' || val === 'true'),
    triggerAction: () => toggle(),
  });

  return (
    <label className={`ai-checkbox ${className}`} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="ai-checkbox__input"
      />
      <span className="ai-checkbox__checkmark" />
      <span className="ai-checkbox__label">{label}</span>
    </label>
  );
}
