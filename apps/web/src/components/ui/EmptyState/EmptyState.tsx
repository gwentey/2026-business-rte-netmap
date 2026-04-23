import type { HTMLAttributes, ReactNode } from 'react';
import styles from './EmptyState.module.scss';

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'md',
  className,
  ...rest
}: EmptyStateProps): JSX.Element {
  const rootClass = `${styles.root} ${styles[`size${size[0]?.toUpperCase()}${size.slice(1)}`] ?? ''} ${className ?? ''}`.trim();

  return (
    <div className={rootClass} {...rest}>
      {icon ? <div className={styles.icon} aria-hidden="true">{icon}</div> : null}
      <h2 className={styles.title}>{title}</h2>
      {description ? <p className={styles.description}>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
