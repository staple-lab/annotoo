const faqs: [string, string][] = [
  ['Can the people I share with add annotations?', 'No, on purpose. Annotoo is for explaining a prototype, not for collecting feedback, so viewers can read, list and hide annotations but not change them. If you need two-way notes, write a storage adapter against your own backend.'],
  ['Is there a server or an account?', 'No. Annotations are a JSON file in your repo and travel inside your build. Hosted prototypes make no extra requests.'],
  ['What happens when I change the markup?', 'Annotoo re-finds each element by its CSS path and text, so most edits are fine. Add data-annotoo-id to elements you expect to rework. Anything it can’t find goes to the Unanchored list, not the bin.'],
  ['Will it clash with my styles or shortcuts?', 'It shouldn’t. Its UI is in a Shadow DOM, keystrokes typed into it don’t reach your app, and its only shortcuts (⌥A and ⌥H) need the Option or Alt key and are ignored while you type. Pass shortcuts={false} to turn them off.'],
  ['Does it work on phones?', 'It runs, but it’s designed for desktop. Notes need room beside the elements they describe.'],
  ['Does it work without React?', 'Yes. Use mount() from @staplelab/annotoo, or the script tag for plain HTML pages.'],
  ['What does it cost?', 'Nothing. It’s MIT licensed.'],
];

export function Faq() {
  return (
    <article className="prose">
      <h1>FAQ</h1>
      <div className="faq">
        {faqs.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </article>
  );
}
