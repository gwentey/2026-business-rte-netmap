import styles from './DateTimeField.module.scss';

export interface DateTimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  'aria-label'?: string;
}

export function DateTimeField({
  value,
  onChange,
  label,
  disabled,
  min,
  max,
  'aria-label': ariaLabel,
}: DateTimeFieldProps): JSX.Element {
  return (
    <div className={styles.container}>
      {label ? <label className={styles.label}>{label}</label> : null}
      <input
        type="datetime-local"
        value={value}
        disabled={disabled}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className={styles.input}
        aria-label={ariaLabel ?? label}
      />
    </div>
  );
}
