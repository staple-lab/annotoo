import { useEffect, useState } from 'react';
import { Link, usePath } from './router';
import { Overview } from './pages/Overview';
import { Install } from './pages/Install';
import { Features } from './pages/Features';
import { Sharing } from './pages/Sharing';
import { Schema } from './pages/Schema';
import { Api } from './pages/Api';
import { Faq } from './pages/Faq';
import { Changelog } from './pages/Changelog';

const GITHUB = 'https://github.com/staple-lab/annotoo';

const nav = [
  { group: 'Guide', items: [
    { to: '/', label: 'Overview', page: Overview },
    { to: '/install', label: 'Install', page: Install },
    { to: '/features', label: 'Features', page: Features },
    { to: '/sharing', label: 'Sharing', page: Sharing },
  ] },
  { group: 'Reference', items: [
    { to: '/schema', label: 'Schema', page: Schema },
    { to: '/api', label: 'API', page: Api },
  ] },
  { group: 'Resources', items: [
    { to: '/faq', label: 'FAQ', page: Faq },
    { to: '/changelog', label: 'Changelog', page: Changelog },
  ] },
];

const pages = nav.flatMap((g) => g.items);

export function App() {
  const path = usePath();
  const [menuOpen, setMenuOpen] = useState(false);
  const index = Math.max(0, pages.findIndex((p) => p.to === path));
  const current = pages.find((p) => p.to === path);
  const Page = current?.page ?? NotFound;
  const prev = pages[index - 1];
  const next = pages[index + 1];

  useEffect(() => {
    document.title = current && current.to !== '/' ? `${current.label} | Annotoo` : 'Annotoo: annotations for prototypes';
  }, [current]);

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="wordmark" onClick={() => setMenuOpen(false)}>
          <Mark /> Annotoo
        </Link>
        <button type="button" className="menu-btn" aria-expanded={menuOpen} aria-controls="sidebar" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? 'Close' : 'Menu'}
        </button>
      </header>

      <nav id="sidebar" className={`sidebar${menuOpen ? ' open' : ''}`} aria-label="Docs">
        <Link to="/" className="wordmark desktop-only">
          <Mark /> Annotoo
        </Link>
        {nav.map((g) => (
          <div className="nav-group" key={g.group}>
            <span className="nav-label">{g.group}</span>
            {g.items.map((item) => (
              <Link key={item.to} to={item.to} className={item.to === path ? 'active' : undefined} onClick={() => setMenuOpen(false)}>
                {item.label}
              </Link>
            ))}
          </div>
        ))}
        <div className="nav-foot">
          <a href={GITHUB}>GitHub</a>
          <span className="version">v0.5.0</span>
        </div>
      </nav>

      <main className="main" key={path}>
        <Page />
        {current && (
          <nav className="pager" aria-label="Pages">
            {prev ? <Link to={prev.to} className="prev"><small>Previous</small>{prev.label}</Link> : <span />}
            {next ? <Link to={next.to} className="next"><small>Next</small>{next.label}</Link> : <span />}
          </nav>
        )}
        <footer className="footer">
          <p>
            MIT licensed. Made by <a href="https://github.com/staple-lab">Staple Lab</a>.
          </p>
          <p>
            Inspired by <a href="https://www.agentation.com/">agentation</a>.
          </p>
        </footer>
      </main>

    </div>
  );
}

function NotFound() {
  return (
    <article className="prose">
      <h1>Page not found</h1>
      <p>
        There's no page at this address. Start from the <Link to="/">overview</Link>.
      </p>
    </article>
  );
}

const logo = (h: number) => `${import.meta.env.BASE_URL}logo-${h}.png`;

/** The cockatoo. Exported at 1x/2x/3x of its 40px display height, so it stays sharp. */
function Mark() {
  return (
    <img
      className="mark"
      src={logo(40)}
      srcSet={`${logo(40)} 1x, ${logo(80)} 2x, ${logo(120)} 3x`}
      width={32}
      height={40}
      alt=""
      decoding="async"
    />
  );
}
