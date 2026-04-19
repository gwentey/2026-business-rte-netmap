import { useAppStore } from '../../store/app-store.js';

export function EnvSelector(): JSX.Element {
  const envs = useAppStore((s) => s.envs);
  const activeEnv = useAppStore((s) => s.activeEnv);
  const setActiveEnv = useAppStore((s) => s.setActiveEnv);

  if (envs.length === 0) {
    return <span className="text-sm text-gray-500">Aucun env</span>;
  }

  return (
    <select
      value={activeEnv ?? ''}
      onChange={(e) => { void setActiveEnv(e.target.value); }}
      className="rounded border border-gray-300 px-2 py-1 text-sm"
    >
      {envs.map((e) => (
        <option key={e} value={e}>{e}</option>
      ))}
    </select>
  );
}
