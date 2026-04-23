import styles from './RangeSlider.module.scss';

export interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  label?: string;
  displayValue?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  label,
  displayValue,
  disabled,
  'aria-label': ariaLabel,
}: RangeSliderProps): JSX.Element {
  return (
    <div className={styles.container}>
      {label ? <label className={styles.label}>{label}</label> : null}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className={styles.slider}
        aria-label={ariaLabel ?? label}
      />
      {displayValue ? <span className={styles.value}>{displayValue}</span> : null}
    </div>
  );
}
