import { CodeBlock } from '../components/CodeBlock';

export function Schema() {
  return (
    <article className="prose">
      <h1>Schema</h1>
      <p className="lede">
        <code>annotoo.annotations.json</code> is an array of annotations. It's plain, stable JSON, so
        it diffs well in code review and you can write it by hand or generate it.
      </p>
      <CodeBlock
        id="schema-code"
        label="Annotation"
        code={`type Annotation = {
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
};`}
      />

      <h2>Example</h2>
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
        Unknown fields are ignored.
      </p>
    </article>
  );
}
