import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';

// A deliberately tiny pushState router, so the example has real client-side routes
// without pulling in a routing library.
const listeners = new Set<() => void>();

/** Path within the app, ignoring whatever prefix the build is hosted under. */
function appPath(): string {
  const base = new URL(import.meta.env.BASE_URL, location.href).pathname.replace(/\/$/, '');
  const path = location.pathname.startsWith(base) ? location.pathname.slice(base.length) : location.pathname;
  return path.replace(/\/index\.html$/, '') || '/';
}

function appBase(): string {
  return new URL(import.meta.env.BASE_URL, location.href).pathname.replace(/\/$/, '');
}

export function navigate(to: string): void {
  history.pushState(null, '', appBase() + to);
  listeners.forEach((l) => l());
}

export function usePath(): string {
  const [path, setPath] = useState(appPath);
  useEffect(() => {
    const update = () => setPath(appPath());
    listeners.add(update);
    window.addEventListener('popstate', update);
    return () => {
      listeners.delete(update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  return path;
}

export function Link({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  const onClick = (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={appBase() + to} onClick={onClick} className={className}>
      {children}
    </a>
  );
}
