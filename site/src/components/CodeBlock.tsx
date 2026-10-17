import { useState } from 'react';

type Props = {
  code: string | Record<string, string>;
  label?: string;
  id?: string;
  /** Accessible name for the tab list. */
  tabsLabel?: string;
  /** Wrap long lines instead of scrolling (for prose, like an agent prompt). */
  wrap?: boolean;
};

/** Code with a copy button. Pass an object to get tabs (e.g. npm / pnpm / yarn). */
export function CodeBlock({ code, label, id, tabsLabel = 'Package manager', wrap = false }: Props) {
  const tabs = typeof code === 'string' ? null : Object.keys(code);
  const [tab, setTab] = useState(tabs?.[0] ?? '');
  const [copied, setCopied] = useState(false);
  const text = typeof code === 'string' ? code : code[tab];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  };

  return (
    <figure className={wrap ? 'code is-wrap' : 'code'} data-annotoo-id={id}>
      {(tabs || label) && (
        <div className="code-bar">
          {tabs ? (
            <div className="code-tabs" role="tablist" aria-label={tabsLabel}>
              {tabs.map((t) => (
                <button key={t} type="button" role="tab" aria-selected={t === tab} onClick={() => setTab(t)}>
                  {t}
                </button>
              ))}
            </div>
          ) : (
            <figcaption>{label}</figcaption>
          )}
        </div>
      )}
      <pre>
        <code>{text}</code>
      </pre>
      <button type="button" className="copy" onClick={copy} aria-label={copied ? 'Copied' : 'Copy code'}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </figure>
  );
}
