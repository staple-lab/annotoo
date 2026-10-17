import { useState } from 'react';
import { Icon } from '../icons';

type Status = 'Active' | 'Beta' | 'Deprecated';
type Team = 'Personal' | 'Platform' | 'Productivity' | 'Research';

const agents: { id: string; initials: string; name: string; desc: string; tags: string[]; team: Team; status: Status; seen: string }[] = [
  { id: 'claude-code', initials: 'CC', name: 'Claude Code', desc: 'Terminal pair-programmer. Reads files, runs shells, edits code with your approval and logs every session.', tags: ['Anthropic API', 'Bash', 'Filesystem', 'Git'], team: 'Personal', status: 'Active', seen: '2m ago' },
  { id: 'support-triage', initials: 'ST', name: 'Support triage', desc: 'Reads new tickets, tags them by product area and drafts a first reply for a human to send.', tags: ['Zendesk', 'Slack'], team: 'Productivity', status: 'Active', seen: '14m ago' },
  { id: 'release-notes', initials: 'RN', name: 'Release notes writer', desc: 'Turns merged pull requests into customer-facing release notes every Friday.', tags: ['GitHub', 'Linear'], team: 'Platform', status: 'Beta', seen: '3d ago' },
  { id: 'legacy-summariser', initials: 'LS', name: 'Legacy summariser', desc: 'Summarises long research docs. Being replaced by the new research assistant.', tags: ['Google Drive'], team: 'Research', status: 'Deprecated', seen: '21d ago' },
];

const teams = ['All', 'Personal', 'Platform', 'Productivity', 'Research'] as const;
const statuses = ['All', 'Active', 'Beta', 'Deprecated'] as const;

function Segmented<T extends string>({ value, options, onChange, label, hook }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string; hook?: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label} data-annotoo-id={hook}>
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={o === value} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function Agents() {
  const [query, setQuery] = useState('');
  const [team, setTeam] = useState<(typeof teams)[number]>('All');
  const [status, setStatus] = useState<(typeof statuses)[number]>('All');

  const q = query.trim().toLowerCase();
  const shown = agents.filter(
    (a) =>
      (team === 'All' || a.team === team) &&
      (status === 'All' || a.status === status) &&
      (!q || [a.name, a.desc, ...a.tags].some((t) => t.toLowerCase().includes(q))),
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Agents</h1>
          <p className="muted">{agents.length} agents across 4 teams. Browse, monitor, and configure.</p>
        </div>
        <button type="button" className="btn-primary" data-annotoo-id="new-agent">
          <Icon name="plus" size={15} /> New agent
        </button>
      </div>

      <div className="filters">
        <label className="search">
          <Icon name="search" size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search agents, capabilities, MCP servers…" aria-label="Search agents" />
        </label>
        <Segmented label="Team" value={team} options={teams} onChange={setTeam} />
        <Segmented label="Status" value={status} options={statuses} onChange={setStatus} hook="status-filter" />
      </div>

      <div className="agent-list" data-annotoo-id="agent-list">
        {shown.map((a) => (
          <article className="card agent" key={a.id}>
            <div className="agent-top">
              <span className="agent-mark">{a.initials}</span>
              <div>
                <div className="agent-name">
                  {a.name} <span className={`dot dot-${a.status.toLowerCase()}`} title={a.status} />
                </div>
                <p className="agent-desc">{a.desc}</p>
              </div>
            </div>
            <div className="tags">
              {a.tags.slice(0, 3).map((t) => <span className="tag" key={t}>{t}</span>)}
              {a.tags.length > 3 && <span className="tag">+{a.tags.length - 3}</span>}
            </div>
            <div className="agent-foot">
              <span>{a.team}</span>
              <span>{a.status === 'Active' ? `Seen ${a.seen}` : `${a.status} · ${a.seen}`}</span>
            </div>
          </article>
        ))}
        {shown.length === 0 && <p className="empty">No agents match these filters.</p>}
      </div>
    </>
  );
}
