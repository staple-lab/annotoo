import { CodeBlock } from '../components/CodeBlock';

const categories = [
  { cat: 'note', name: 'Note', use: 'Anything general. The default.' },
  { cat: 'interaction', name: 'Interaction', use: 'What happens on click, hover or input, including what isn’t wired up yet.' },
  { cat: 'content', name: 'Content', use: 'What a number means, where copy comes from, edge cases like empty states.' },
  { cat: 'accessibility', name: 'Accessibility', use: 'Focus order, labels, announcements, contrast decisions.' },
  { cat: 'development', name: 'Development', use: 'Endpoints, data shapes, flags, anything an engineer needs to build it for real.' },
];

export function Features() {
  return (
    <article className="prose">
      <h1>Features</h1>
      <p className="lede">
        Everything on this page is something you can try right now with the toolbar in the corner.
      </p>

      <h2>Annotations</h2>
      <p>
        Each annotation is attached to an element. The element gets an outline and a numbered
        badge; the note sits beside it, joined by a line from the element's edge. When notes would
        overlap, they stack. Every note has a category, an optional title and a body.
      </p>
      <table className="table">
        <thead>
          <tr><th>Category</th><th>Use it for</th></tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.cat}>
              <td><span className="cat" data-cat={c.cat}>{c.name}</span></td>
              <td>{c.use}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>The toolbar</h2>
      <p>
        A small yellow tab with the cockatoo hangs off the edge of the page, bottom-right to start
        with. Click it to open the toolbar; click the cockatoo again to put it away. Drag the tab
        towards any corner to move it: it snaps to the nearest one and stays there. In a top corner it
        hangs down from the top edge instead. You can also pick the corner in Settings.
      </p>
      <p>
        Two keyboard shortcuts, both with <kbd>⌥</kbd> (<kbd>Alt</kbd> on Windows) so they never clash
        with keys your prototype uses: <kbd>⌥A</kbd> opens the toolbar and switches Annotate on or off,
        and <kbd>⌥H</kbd> shows or hides every annotation. <kbd>Esc</kbd> steps back out of whatever
        you're doing. They're ignored while you type in a text field, and listed in Settings.
      </p>
      <dl className="defs">
        <dt>Annotate</dt>
        <dd>
          Authors only, and on as soon as you open the toolbar. Hover to see element names, click to
          annotate. The page ignores clicks while this is on; click the button or press <kbd>Esc</kbd> to
          use the prototype again.
        </dd>
        <dt>Show and hide</dt>
        <dd>Hides every annotation, leaving just the button.</dd>
        <dt>List</dt>
        <dd>Every annotation on the page, plus ones on other pages and any whose element has disappeared.</dd>
        <dt>Settings</dt>
        <dd>Display, outlines, theme and toolbar position. Each viewer's choices are remembered in their browser.</dd>
        <dt>Copy as Markdown</dt>
        <dd>Authors only. Every annotation as Markdown, ready to paste into a ticket, a doc or a chat.</dd>
      </dl>

      <h2>Display modes</h2>
      <div data-annotoo-id="features-display">
        <p>
          Notes beside the UI are the point, but on a dense screen they cover things. Viewers
          choose how much they see in Settings:
        </p>
        <dl className="defs">
          <dt>Always</dt>
          <dd>
            Every note is visible beside its element, like Figma Dev Mode. The default. On screens
            narrower than 720px this acts like numbers only, because notes need room.
          </dd>
          <dt>On hover</dt>
          <dd>Only badges show. Hover a badge to read its note.</dd>
          <dt>Numbers only</dt>
          <dd>Only badges show. Click a badge to read its note.</dd>
        </dl>
      </div>
      <p>Set the default for everyone with the <code>display</code> option.</p>

      <h2>Anchoring</h2>
      <p>
        Annotoo remembers each element by a CSS path and a snippet of its text, which survives most
        edits. For elements you'll rework a lot, give them a stable hook:
      </p>
      <CodeBlock code={`<section data-annotoo-id="revenue-card">…</section>`} />
      <p>
        Annotations on that element, or anything inside it, are anchored to the hook. Ids that
        frameworks generate at runtime, like React's <code>useId</code>, are ignored. If an element
        really disappears, its annotation moves to the Unanchored list instead of being lost.
      </p>

      <h2>Pages and routes</h2>
      <p>
        Annotations belong to the page they were made on, and Annotoo follows client-side
        navigation, so each route shows its own notes. This site is an example: every page has
        different annotations.
      </p>

      <h2>Stays out of the way</h2>
      <p>
        All of Annotoo's UI lives in a Shadow DOM, so your styles can't break it and its styles can't
        leak into your prototype. Keystrokes typed into Annotoo don't reach your app. It has no
        runtime dependencies and respects reduced-motion settings.
      </p>
    </article>
  );
}
