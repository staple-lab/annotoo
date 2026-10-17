const icon = {
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  analytics: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  agents: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  runs: '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>',
  mcp: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
};

function I({ name }: { name: keyof typeof icon }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon[name] }} />
  );
}

const agents = [
  { initials: 'CC', name: 'Claude Code', desc: 'Terminal pair-programmer. Edits code with your approval.', tags: ['Anthropic API', 'Bash', 'Git'], status: 'active' },
  { initials: 'ST', name: 'Support triage', desc: 'Tags new tickets and drafts a first reply.', tags: ['Zendesk', 'Slack'], status: 'active' },
  { initials: 'RN', name: 'Release notes writer', desc: 'Turns merged PRs into release notes.', tags: ['GitHub'], status: 'beta' },
];

/** A compact Striker Eureka screen for the hero, annotated with real Annotoo annotations. */
export function Demo() {
  return (
    <div className="demo" aria-label="Example prototype">
      <div className="demo-chrome" aria-hidden="true">
        <span className="dots"><i /><i /><i /></span>
        <span className="url">localhost:5173/agents</span>
      </div>
      <div className="se">
        <div className="se-rail" aria-hidden="true">
          <span className="se-logo" />
          <span className="se-ico"><I name="inbox" /></span>
          <span className="se-ico"><I name="analytics" /></span>
          <span className="se-ico on"><I name="agents" /></span>
          <span className="se-ico"><I name="runs" /></span>
          <span className="se-ico"><I name="mcp" /></span>
        </div>
        <div className="se-canvas">
          <div className="se-head">
            <div>
              <div className="se-title">Agents</div>
              <div className="se-sub">3 agents across 3 teams</div>
            </div>
            <button type="button" className="se-btn" data-annotoo-id="demo-new" tabIndex={-1}>
              <I name="plus" /> New agent
            </button>
          </div>
          <div className="se-filters">
            <span className="se-search"><I name="search" /> Search agents…</span>
            <span className="se-seg" data-annotoo-id="demo-status">
              <b>All</b><span>Active</span><span>Beta</span>
            </span>
          </div>
          <div className="se-list" data-annotoo-id="demo-agents">
            {agents.map((a) => (
              <div className="se-card" key={a.name}>
                <span className="se-mark">{a.initials}</span>
                <div className="se-main">
                  <div className="se-name">{a.name} <i className={`se-dot ${a.status}`} /></div>
                  <div className="se-desc">{a.desc}</div>
                  <div className="se-tags">{a.tags.map((t) => <span key={t}>{t}</span>)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
