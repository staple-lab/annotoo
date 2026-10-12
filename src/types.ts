export type CommentCategory = 'bug' | 'idea' | 'nit' | 'question';

/** How a comment is pinned back to an element after the page reloads. */
export type Anchor = {
  /** Primary locator: an `#id` when unique, else a `tag:nth-of-type(k)` path. */
  selector: string;
  /** First ~40 chars of the element's collapsed text, used to disambiguate / fall back. */
  textSnippet: string;
  /** Click position normalized to 0..1 within the element's box (center by default). */
  offset: { x: number; y: number };
};

export type Comment = {
  id: string;
  /** Display number shown on the pin (1-based, in creation order). */
  n: number;
  anchor: Anchor;
  body: string;
  category?: CommentCategory;
  author: string;
  createdAt: number;
};
