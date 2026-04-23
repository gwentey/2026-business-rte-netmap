import type { CSSProperties, HTMLAttributes } from 'react';
import styles from './Skeleton.module.scss';

export type SkeletonVariant = 'text' | 'title' | 'card' | 'circle' | 'rect';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  lines = 1,
  className,
  style,
  ...rest
}: SkeletonProps): JSX.Element {
  const inlineStyle: CSSProperties = {
    ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
    ...(height !== undefined
      ? { height: typeof height === 'number' ? `${height}px` : height }
      : {}),
    ...style,
  };

  const variantClass = styles[variant] ?? styles.text;
  const combinedClass = className ? `${styles.base} ${variantClass} ${className}` : `${styles.base} ${variantClass}`;

  if (variant === 'text' && lines > 1) {
    return (
      <div className={styles.group} role="status" aria-label="Chargement" aria-live="polite" {...rest}>
        {Array.from({ length: lines }).map((_, idx) => (
          <div
            key={idx}
            className={combinedClass}
            style={{
              ...inlineStyle,
              width: idx === lines - 1 ? '60%' : inlineStyle.width ?? '100%',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={combinedClass}
      style={inlineStyle}
      role="status"
      aria-label="Chargement"
      aria-live="polite"
      {...rest}
    />
  );
}
