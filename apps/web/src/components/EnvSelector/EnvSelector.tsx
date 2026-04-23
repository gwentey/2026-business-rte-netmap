import { Select } from '@/components/ui';
import { useAppStore } from '../../store/app-store.js';
import styles from './EnvSelector.module.scss';

export function EnvSelector(): JSX.Element {
  const envs = useAppStore((s) => s.envs);
  const activeEnv = useAppStore((s) => s.activeEnv);
  const setActiveEnv = useAppStore((s) => s.setActiveEnv);

  if (envs.length === 0) {
    return <span className={styles.empty}>Aucun env</span>;
  }

  return (
    <Select
      id="env-selector"
      label="Environnement"
      showLabel={false}
      value={activeEnv ?? ''}
      onChange={(value) => {
        void setActiveEnv(value);
      }}
      options={envs.map((env) => ({ value: env, label: env }))}
    />
  );
}
