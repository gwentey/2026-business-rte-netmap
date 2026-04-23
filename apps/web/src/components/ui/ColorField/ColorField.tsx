import styles from './ColorField.module.scss';

export interface ColorFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

export function ColorField({
  value,
  onChange,
  label,
  disabled,
  'aria-label': ariaLabel,
}: ColorFieldProps): JSX.Element {
  return (
    <div className={styles.container}>
      {label ? <label className={styles.label}>{label}</label> : null}
      <input
        type="color"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={styles.picker}
        aria-label={ariaLabel ?? label}
      />
      <span className={styles.hex}>{value.toUpperCase()}</span>
    </div>
  );
}
