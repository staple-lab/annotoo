import { CodeBlock } from '../components/CodeBlock';

export function Schema() {
  return (
    <article className="prose">
      <h1>Schema</h1>
      <p className="lede">
        Existing <code>annotoo.annotations.json</code> arrays stay supported. Git-backed discussions
        use one versioned JSON envelope per thread in <code>.annotoo.comments/</code>. All new
        discussion fields on an annotation are optional.
      </p>
      <CodeBlock
        id="schema-code"
        label="Annotation"
        code={`type CommentAuthor = { id: string; name: string };

type Annotation = {
  id: string;           // unique, e.g. "a_mv5uszfe_z8efub"
  n: number;            // number on the badge, in creation order
  anchor: {
    selector: string;   // CSS path, preferring [data-annotoo-id] and stable ids
    textSnippet: string;// first 40 characters of the element's text
    offset: { x: number; y: number }; // click position within the element, 0 to 1
  };
  title?: string;
  body: string;
  category?: 'note' | 'interaction' | 'content' | 'accessibility' | 'development';
  route?: string;       // page path; leave it out to show on every page
  createdAt: number;    // ms since epoch
  updatedAt?: number;
  author?: CommentAuthor;
  updatedBy?: CommentAuthor;
  assignee?: CommentAuthor; // omitted = unassigned
  replies?: {
    id: string;
    body: string;
    author: CommentAuthor;
    createdAt: number;
  }[];
  status?: 'open' | 'resolved'; // missing means open
  resolvedAt?: number;
  resolvedBy?: CommentAuthor;
  events?: {
    id: string;
    type: 'resolved' | 'reopened' | 'assigned' | 'unassigned';
    assignee?: CommentAuthor; // target of an assignment event
    author: CommentAuthor;
    createdAt: number;
  }[];
};`}
      />

      <h2>Thread files</h2>
      <p>
        A thread file lives at{' '}
        <code>.annotoo.comments/&lt;project-hash&gt;/&lt;thread-id&gt;.json</code>, relative to the Git
        root. The project is the repo-relative Vite root, using forward slashes, or{' '}
        <code>.</code> when Vite runs at the repo root. Its directory name is the first 16
        characters of the SHA-256 hash of that project. This keeps discussions separate when a
        repository has several apps with the same route.
      </p>
      <p>
        Filename-safe thread IDs are used directly. A legacy ID containing unsafe filename
        characters remains unchanged inside the thread, and its file is named{' '}
        <code>legacy-&lt;sha256-of-id&gt;.json</code>.
      </p>
      <CodeBlock label="Thread file" code={`type ThreadFile = {
  schemaVersion: 1;
  project: string; // e.g. "examples/vite-react" or "."
  thread: Annotation;
  deleted?: true;
};`} />
      <p>
        A change to an old annotation creates a thread file without rewriting its legacy array.
        A deletion keeps a <code>deleted: true</code> record so the old annotation is not restored
        on load. Resolving is different: it retains a readable discussion and its status history.
      </p>

      <h2>Example thread</h2>
      <CodeBlock label=".annotoo.comments/<project-hash>/a_review_1.json" code={`{
  "schemaVersion": 1,
  "project": "examples/vite-react",
  "thread": {
    "id": "a_review_1",
    "n": 1,
    "anchor": {
      "selector": "[data-annotoo-id=\\"new-invoice\\"]",
      "textSnippet": "New invoice",
      "offset": { "x": 0.5, "y": 0.5 }
    },
    "body": "Should this open a draft?",
    "route": "/invoices",
    "createdAt": 1791800000000,
    "author": { "id": "opaque-author-id", "name": "Alex Rivera" },
    "replies": [{
      "id": "r_review_1",
      "body": "Yes, the next prototype will include it.",
      "author": { "id": "another-author-id", "name": "Sam Lee" },
      "createdAt": 1791800100000
    }],
    "status": "resolved",
    "resolvedAt": 1791800200000,
    "resolvedBy": { "id": "opaque-author-id", "name": "Alex Rivera" },
    "events": [{
      "id": "e_review_1",
      "type": "resolved",
      "author": { "id": "opaque-author-id", "name": "Alex Rivera" },
      "createdAt": 1791800200000
    }]
  }
}`} />

      <h2>Legacy array example</h2>
      <CodeBlock
        label="src/annotoo.annotations.json"
        code={`[
  {
    "id": "a_seed_1",
    "n": 1,
    "anchor": {
      "selector": "[data-annotoo-id=\\"new-invoice\\"]",
      "textSnippet": "New invoice",
      "offset": { "x": 0.5, "y": 0.5 }
    },
    "title": "Opens the draft sheet",
    "body": "Not built yet. This button is a stub.",
    "category": "interaction",
    "route": "/invoices",
    "createdAt": 1791800000000
  }
]`}
      />

      <h2>Compatibility</h2>
      <p>
        New fields will only ever be optional, so files written by older versions keep working.
        Missing status means open; a missing author is displayed as Unattributed. Author IDs are
        derived from a hash of configured Git email, while only the Git display name is shown.
        Raw email is not included in these files. Local identity provides attribution, not
        authentication.
      </p>
    </article>
  );
}
