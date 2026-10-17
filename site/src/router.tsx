import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';

const listeners = new Set<() => void>();
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

function currentPath(): string {
  const path = location.pathname.startsWith(base) ? location.pathname.slice(base.length) : location.pathname;
  return path.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';
}

export function navigate(to: string): void {
  history.pushState(null, '', base + to);
  window.scrollTo({ top: 0 });
  listeners.forEach((l) => l());
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const update = () => setPath(currentPath());
    listeners.add(update);
    window.addEventListener('popstate', update);
    return () => {
      listeners.delete(update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  return path;
}

export function Link({ to, children, className, onClick }: { to: string; children: ReactNode; className?: string; onClick?: () => void }) {
  const handle = (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onClick?.();
    navigate(to);
  };
  return (
    <a href={base + to} onClick={handle} className={className}>
      {children}
    </a>
  );
}
