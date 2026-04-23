import type { TableHTMLAttributes } from 'react';
import styles from './Table.module.scss';

export type TableProps = TableHTMLAttributes<HTMLTableElement>;

export function Table({ className, children, ...rest }: TableProps): JSX.Element {
  const merged = className ? `${styles.table} ${className}` : styles.table;
  return (
    <table className={merged} {...rest}>
      {children}
    </table>
  );
}
