const faqs: [string, string][] = [
  ['Can my team reply to annotations?', 'Yes, in a local Vite development setup. Open a thread to reply, resolve or reopen it. Contributions use the configured Git name. Commit the .annotoo.comments directory and exchange changes with normal Git pull, commit and push. Hosted viewers read the published discussion without changing it.'],
  ['Is this live collaboration across clones?', 'No. Browsers on the same dev server refresh from its files. Separate clones exchange commits through Git. Different threads live in separate files, but concurrent changes to the same thread can still need a normal Git conflict resolution. Annotoo never commits or pushes automatically.'],
  ['Is there a server or an account?', 'No separate Annotoo backend or account is required. The Vite plugin writes thread files locally and can embed a discussion snapshot when you opt in to viewer builds. Hosted viewers need no Git credentials and make no extra requests.'],
  ['Why do I need a Git name and email?', 'Git-backed writing uses git config user.name as the default displayed name (you can change it under Your name in Settings) and a hash of git config user.email for a stable author ID. Both must be set locally. Raw email is not stored in comment files or published. This is attribution, not verified identity or authentication.'],
  ['What happens to existing annotation files?', 'Existing annotoo.annotations.json arrays remain supported and are not rewritten. New or modified threads are saved in .annotoo.comments at the Git repository root. All discussion fields are optional, so older notes without authors or status still work.'],
  ['Does resolving delete the discussion?', 'No. Replies and resolve/reopen history are retained. Resolved threads leave the open pins on the page and remain available through the Resolved or All list filter. You can reopen them in development.'],
  ['Can visitors change a deployed prototype?', 'The normal hosted viewer is read-only. An explicit ?annotoo=author override makes personal changes in that browser only; it cannot write to Git or update what anyone else sees. This documentation site, which doubles as the live demo, is a browser-local sandbox.'],
  ['What happens when I change the markup?', 'Annotoo re-finds each element by its CSS path and text, so most edits are fine. Add data-annotoo-id to elements you expect to rework. Anything it can’t find goes to the Unanchored list, not the bin.'],
  ['Will it clash with my styles or shortcuts?', 'It shouldn’t. Its UI is in a Shadow DOM, keystrokes typed into it don’t reach your app, and its only shortcuts (⌥A and ⌥H) need the Option or Alt key and are ignored while you type. Use the browser option shortcuts: false to turn them off.'],
  ['Does it work on phones?', 'It runs, but it’s designed for desktop. Notes need room beside the elements they describe.'],
  ['Does it work without React?', 'Yes. The included @staplelab/annotoo/vite integration works with JavaScript, React and Vue. Non-Vite apps can use the browser mount() API or script tag.'],
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
