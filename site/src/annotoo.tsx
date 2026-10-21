import { Annotoo, type Annotation, type AnnotationStorage } from '@staplelab/annotoo-react';
import seed from './annotoo.annotations.json';

const KEY = 'annotoo-site:annotations';
const snapshot = (window as {
  __ANNOTOO_COMMENTS__?: { annotations: Annotation[]; deletedIds: string[] };
}).__ANNOTOO_COMMENTS__;
const committed = new Map((seed as Annotation[]).map((thread) => [thread.id, thread]));
for (const thread of snapshot?.annotations ?? []) committed.set(thread.id, thread);
for (const id of snapshot?.deletedIds ?? []) committed.delete(id);
const annotations = [...committed.values()].sort((a, b) => a.n - b.n);

/**
 * On the published site, visitors get the real authoring tools. Their changes stay in
 * their browser, starting from the annotations we wrote. In `vite dev` the plugin takes
 * over and edits land in the Git repository's .annotoo.comments directory.
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
