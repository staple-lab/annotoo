import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { mount, type Annotation } from '@staplelab/annotoo';
import annotations from './annotoo.annotations.json';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Initialize once at the application boundary, independent of React rendering.
// This public demo keeps the read-only viewer in production. For a dev-only
// integration, see the dynamic import example in the README.
const annotoo = mount({
  annotations: annotations as Annotation[],
  // Relative Vite builds infer their hosting prefix from the known routes.
  basePath: import.meta.env.BASE_URL.startsWith('/') ? import.meta.env.BASE_URL : undefined,
});
import.meta.hot?.dispose(() => annotoo.destroy());
