/** Annotation categories, after Figma Dev Mode's: each gets its own colour on the page. */
export type AnnotationCategory = 'note' | 'interaction' | 'content' | 'accessibility' | 'development';

export const CATEGORIES: { value: AnnotationCategory; label: string }[] = [
  { value: 'note', label: 'Note' },
  { value: 'interaction', label: 'Interaction' },
  { value: 'content', label: 'Content' },
  { value: 'accessibility', label: 'Accessibility' },
  { value: 'development', label: 'Development' },
];

/** How an annotation is attached back to an element after the page reloads. */
export type Anchor = {
  /**
   * Primary locator. Prefers `[data-annotoo-id="…"]`, then a unique `#id`, else a
   * `tag:nth-of-type(k)` path rooted at the nearest of those.
   */
  selector: string;
  /** First ~40 chars of the element's collapsed text, used to disambiguate / fall back. */
  textSnippet: string;
  /** Click position normalized to 0..1 within the element's box (center by default). */
  offset: { x: number; y: number };
};

/** A Git display name and stable identifier derived from the configured Git email. */
export type CommentAuthor = { id: string; name: string };

export type AnnotationReply = {
  id: string;
  body: string;
  author: CommentAuthor;
  createdAt: number;
};

/** Append-only record of a thread being resolved or reopened. */
export type ThreadEvent = {
  id: string;
  type: 'resolved' | 'reopened';
  author: CommentAuthor;
  createdAt: number;
};

export type Annotation = {
  id: string;
  /** Display number shown on the marker (1-based, in creation order). */
  n: number;
  anchor: Anchor;
  /** Optional short heading, shown in bold above the body. */
  title?: string;
  body: string;
  /** Defaults to `'note'`. */
  category?: AnnotationCategory;
  createdAt: number;
  updatedAt?: number;
  /**
   * The route the annotation was made on (by default `location.pathname`). Annotations
   * without a route show on every page.
   */
  route?: string;
  /** Older, unattributed annotations remain valid. */
  author?: CommentAuthor;
  updatedBy?: CommentAuthor;
  replies?: AnnotationReply[];
  /** Missing status means open, for compatibility with existing annotation files. */
  status?: 'open' | 'resolved';
  resolvedAt?: number;
  resolvedBy?: CommentAuthor;
  events?: ThreadEvent[];
};

export type Mode = 'author' | 'viewer';
