import { Annotoo, type Annotation, type AnnotationStorage } from '@staplelab/annotoo-react';
import seed from './annotoo.annotations.json';

const KEY = 'annotoo-site:annotations';
const annotations = seed as Annotation[];

/**
 * On the published site, visitors get the real authoring tools. Their changes stay in
 * their browser, starting from the annotations we wrote. In `vite dev` the plugin takes
 * over and edits land in annotoo.annotations.json.
 */
const visitorStorage: AnnotationStorage = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Annotation[]) : annotations;
    } catch {
      return annotations;
    }
  },
  save(next) {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage blocked: changes last until reload */
    }
  },
  describe: () => 'Your changes are saved in this browser only',
};

export function hasLocalChanges(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function resetAnnotations(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to reset */
  }
  location.reload();
}

export function SiteAnnotoo() {
  return (
    <Annotoo
      annotations={annotations}
      basePath={import.meta.env.BASE_URL}
      storage={import.meta.env.DEV ? undefined : visitorStorage}
    />
  );
}
