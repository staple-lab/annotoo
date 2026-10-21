import { CodeBlock } from '../components/CodeBlock';

export function Sharing() {
  return (
    <article className="prose">
      <h1>Sharing and collaboration</h1>
      <p className="lede">
        Discuss the prototype in development, exchange threads through Git, and publish a
        read-only review copy. There is no separate Annotoo backend or account.
      </p>

      <h2>Discuss in your local clone</h2>
      <p>
        With the Vite plugin, opening the cockatoo tab turns Annotate on. Click an element, write
        the opening comment and save. Choose <strong>Open thread</strong> on a note, or select it in
        the list, to read the discussion and add a reply. Your Git display name appears on new
        contributions. Both <code>user.name</code> and <code>user.email</code> must be configured
        before Git-backed writes are allowed.
      </p>
      <p>
        <strong>Resolve thread</strong> keeps the replies and records who resolved it and when.
        Find completed discussions with the <strong>Resolved</strong> or <strong>All</strong> list
        filter, and choose <strong>Reopen thread</strong> to continue. Resolved threads leave the
        page's open pins without losing their history.
      </p>

      <h2>Exchange changes through Git</h2>
      <p>
        Threads are separate JSON files inside <code>.annotoo.comments/</code> at the repository
        root. Keep that directory in Git with your prototype. Existing{' '}
        <code>src/annotoo.annotations.json</code> files remain supported and stay intact; changes to
        their notes are saved as thread files too.
      </p>
      <CodeBlock code={`git status --short
git diff -- .annotoo.comments
git add .annotoo.comments
git commit -m "Discuss the prototype flow"
git pull
git push`} />
      <p>
        Follow your team's branch and review conventions. Annotoo never commits or pushes for you.
        Browsers on the same dev server refresh from its files. People using separate clones see
        each other's work after exchanging commits and pulling; they do not share a live session.
      </p>

      <h2>If two people edit the same thread</h2>
      <p>
        Separate files keep unrelated threads apart, but Git can still report a conflict in one
        thread. Use your normal merge tool. Keep one valid JSON envelope, preserve both people's
        replies and resolution events with their original IDs, and decide the current open or
        resolved status. If one side deleted the thread while the other replied, agree which
        outcome to keep. Remove conflict markers, finish the merge, and open the discussion in
        the prototype to check it. Annotoo does not silently resolve Git conflicts for you.
      </p>

      <h2>What happens when you deploy</h2>
      <ol className="steps" data-annotoo-id="sharing-steps">
        <li>
          <strong>You write annotations in <code>vite dev</code>.</strong> The plugin saves them to{' '}
          <code>.annotoo.comments/</code>, with authors, replies and resolution history.
        </li>
        <li>
          <strong>You build.</strong> The plugin merges the legacy annotations and thread files,
          then embeds a snapshot. Existing annotation imports keep working.
        </li>
        <li>
          <strong>Someone opens the link.</strong> Annotoo finds no dev server, starts in viewer mode,
          and shows the discussions read-only. It needs no Git credentials or write endpoint and
          makes no network requests of its own. Rebuild and deploy to publish later Git changes.
        </li>
      </ol>

      <h2>Where to host</h2>
      <p>
        Anywhere that serves static files, including under a sub-path such as{' '}
        <code>example.com/s/my-prototype/</code>. Annotoo works out which page it's on even when the
        prefix differs from your dev server. If you'd rather be explicit, pass <code>basePath</code>.
      </p>

      <h2>A single file</h2>
      <p>
        For plain HTML pages, <strong>Export HTML</strong> downloads one self-contained file with the
        page, your annotations and the widget inlined. It works offline and from any host, and you
        can attach it to an email.
      </p>

      <h2>Showing your own view</h2>
      <p>Anyone can change what they see with a URL parameter:</p>
      <CodeBlock
        code={`?annotoo=viewer   # see exactly what viewers see, even in dev
?annotoo=author   # authoring tools on a deployed build (saves to your browser)
?annotoo=off      # no Annotoo at all, e.g. for screenshots`}
      />
      <p>
        An explicit author override on a hosted page is a personal browser-only copy. It cannot
        write to Git or change the deployed discussion other visitors see. This documentation
        site's sandbox uses the same browser-local approach; the full prototype demo is read-only.
      </p>

      <h2>Keeping it out of production</h2>
      <p>
        If the same build goes to real users, render Annotoo only where you want it, for example{' '}
        <code>{'<Annotoo disabled={!isPreview} />'}</code>.
      </p>
    </article>
  );
}
