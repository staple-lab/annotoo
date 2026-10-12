import type { Comment, Anchor, CommentCategory } from './types';

const STORAGE_PREFIX = 'notate:comments:';
const AUTHOR_KEY = 'notate:author';
const EMBED_ID = 'notate-comments';

function storageKey(): string {
  return STORAGE_PREFIX + location.pathname;
}

/** Comments baked into an exported page, or `null` if this is a live authoring page. */
export function readEmbeddedComments(): Comment[] | null {
  const node = document.getElementById(EMBED_ID);
  if (!node) return null;
  try {
    const parsed = JSON.parse(node.textContent || '[]');
    return Array.isArray(parsed) ? (parsed as Comment[]) : [];
  } catch {
    return [];
  }
}

export type NewComment = {
  anchor: Anchor;
  body: string;
  category?: CommentCategory;
};

export type AuthorStore = {
  list(): Comment[];
  get(id: string): Comment | undefined;
  add(input: NewComment): Comment;
  update(id: string, patch: Partial<Pick<Comment, 'body' | 'category'>>): void;
  remove(id: string): void;
  clear(): void;
  getAuthor(): string;
  setAuthor(name: string): void;
};

/** Author-mode store backed by localStorage, keyed per page path. */
export function createAuthorStore(): AuthorStore {
  let comments: Comment[] = load();
  let seq = comments.reduce((max, c) => Math.max(max, c.n), 0);

  function load(): Comment[] {
    try {
      const raw = localStorage.getItem(storageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as Comment[]) : [];
    } catch {
      return [];
    }
  }

  function persist(): void {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(comments));
    } catch {
      /* storage may be unavailable (private mode / quota) — keep working in-memory */
    }
  }

  return {
    list: () => comments.slice(),
    get: (id) => comments.find((c) => c.id === id),
    add(input) {
      seq += 1;
      const comment: Comment = {
        id: `c_${Date.now()}_${seq}`,
        n: seq,
        anchor: input.anchor,
        body: input.body,
        category: input.category,
        author: this.getAuthor(),
        createdAt: Date.now(),
      };
      comments.push(comment);
      persist();
      return comment;
    },
    update(id, patch) {
      const c = comments.find((x) => x.id === id);
      if (!c) return;
      Object.assign(c, patch);
      persist();
    },
    remove(id) {
      comments = comments.filter((c) => c.id !== id);
      persist();
    },
    clear() {
      comments = [];
      persist();
    },
    getAuthor: () => {
      try {
        return localStorage.getItem(AUTHOR_KEY) || '';
      } catch {
        return '';
      }
    },
    setAuthor(name) {
      try {
        localStorage.setItem(AUTHOR_KEY, name);
      } catch {
        /* ignore */
      }
    },
  };
}
