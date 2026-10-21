import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { mountSiteAnnotoo } from './annotoo';

// First visit: open the Annotoo toolbar so people can see what it is straight away.
try {
  if (localStorage.getItem('annotoo:open') === null) localStorage.setItem('annotoo:open', '1');
} catch {
  /* storage blocked: the toolbar just starts collapsed */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// One framework-agnostic instance, outside component lifecycles.
const annotoo = mountSiteAnnotoo();
import.meta.hot?.dispose(() => annotoo.destroy());
