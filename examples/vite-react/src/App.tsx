import { Annotoo, type Annotation } from '@staplelab/annotoo-react';
import annotations from './annotoo.annotations.json';
import { Link, usePath } from './router';
import { Icon, type IconName } from './icons';
import { Analytics } from './pages/Analytics';
import { Agents } from './pages/Agents';

// The Striker Eureka shell: warm stone chrome, a floating white canvas, icon sidebar.
const nav: { to: string; label: string; icon: IconName; badge?: number; built?: boolean }[] = [
  { to: '/inbox', label: 'Inbox', icon: 'inbox', badge: 2 },
  { to: '/', label: 'Analytics', icon: 'analytics', built: true },
  { to: '/agents', label: 'Agents', icon: 'agents', built: true },
  { to: '/runs', label: 'Runs', icon: 'runs' },
  { to: '/feedback', label: 'Feedback', icon: 'feedback' },
  { to: '/workflows', label: 'Workflows', icon: 'workflows' },
  { to: '/mcp', label: 'MCP servers', icon: 'mcp' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

export function App() {
  const path = usePath();
  const current = nav.find((n) => n.to === path) ?? nav[1];
  const Page = path === '/agents' ? Agents : Analytics;

  return (
    <div className="chrome">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 7 4M9 12l3-8M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </span>
          Striker Eureka
          <button type="button" className="icon-button collapse" aria-label="Collapse sidebar"><Icon name="panel" /></button>
        </div>
        <nav aria-label="Main">
          {nav.map((n) =>
            n.built ? (
              <Link key={n.to} to={n.to} className={`nav-item${n.to === current.to ? ' active' : ''}`}>
                <Icon name={n.icon} /> {n.label}
              </Link>
            ) : (
              <span key={n.to} className="nav-item disabled" title="Not in this prototype">
                <Icon name={n.icon} /> {n.label}
                {n.badge ? <span className="nav-badge">{n.badge}</span> : null}
              </span>
            ),
          )}
        </nav>
        <div className="system-status">
          <span className="dot dot-active" /> All systems operational
        </div>
      </aside>

      <div className="canvas">
        <header className="topbar">
          <span className="crumb">{current.label}</span>
          <div className="topbar-actions">
            <button type="button" className="search-pill" data-annotoo-id="command-search">
              <Icon name="search" /> Search…
              <span className="kbd-group"><kbd>⌘</kbd><kbd>K</kbd></span>
            </button>
            <button type="button" className="icon-button" aria-label="Notifications">
              <Icon name="bell" />
              <span className="bell-badge">2</span>
            </button>
            <button type="button" className="icon-button" aria-label="Dark mode"><Icon name="moon" /></button>
            <span className="avatar">PD</span>
          </div>
        </header>
        <main className="page">
          <Page />
        </main>
      </div>

      <Annotoo annotations={annotations as Annotation[]} />
    </div>
  );
}
