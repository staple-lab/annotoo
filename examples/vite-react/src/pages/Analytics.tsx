import { Icon, type IconName } from '../icons';

const stats: { label: string; icon: IconName; value: string; sub: string; hook?: string }[] = [
  { label: 'Total spend', icon: 'coins', value: '$8.7k', sub: '542,211,307 tokens', hook: 'stat-spend' },
  { label: 'Time saved', icon: 'hourglass', value: '41h', sub: 'estimated' },
  { label: 'Active operators', icon: 'users', value: '6', sub: 'distinct invokers' },
  { label: 'Runs (7d)', icon: 'activity', value: '318', sub: '12 failed' },
];

// 14 days of spend, in dollars.
const spend = [420, 610, 380, 1240, 560, 300, 720, 1680, 940, 410, 520, 1390, 860, 1110];
const days = ['09-30', '10-01', '10-02', '10-03', '10-04', '10-05', '10-06', '10-07', '10-08', '10-09', '10-10', '10-11', '10-12', '10-13'];

const byAgent = [
  { name: 'Claude Code', cost: 4820 },
  { name: 'Support triage', cost: 2140 },
  { name: 'Release notes writer', cost: 1260 },
  { name: 'Legacy summariser', cost: 480 },
];

function areaPath(values: number[], w: number, h: number): { line: string; area: string } {
  const max = Math.max(...values) * 1.1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - (v / max) * h] as const);
  // Smooth the line with simple cubic segments between midpoints.
  let line = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    line += ` C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`;
  }
  return { line, area: `${line} L ${w} ${h} L 0 ${h} Z` };
}

export function Analytics() {
  const W = 1000;
  const H = 180;
  const { line, area } = areaPath(spend, W, H);
  const maxCost = Math.max(...byAgent.map((a) => a.cost));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <p className="muted">Spend, adoption, and time-saved estimates across the agent fleet. Last 14 days.</p>
        </div>
      </div>

      <section className="stats">
        {stats.map((s) => (
          <div className="stat card" key={s.label} data-annotoo-id={s.hook}>
            <span className="label"><Icon name={s.icon} size={14} /> {s.label}</span>
            <strong>{s.value}</strong>
            <span className="sub">{s.sub}</span>
          </div>
        ))}
      </section>

      <section>
        <div className="section-head">
          <h2>Spend over time</h2>
          <span className="muted small">14-day daily totals</span>
        </div>
        <div className="card chart" data-annotoo-id="spend-chart">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Daily spend, last 14 days">
            <defs>
              <linearGradient id="spend-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="var(--primary)" stopOpacity="0.18" />
                <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="gridline" />
            ))}
            <path d={area} fill="url(#spend-fill)" />
            <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="axis">
            {days.filter((_, i) => i % 2 === 0).map((d) => <span key={d}>{d}</span>)}
          </div>
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Cost by agent</h2>
          <span className="muted small">Last 14 days</span>
        </div>
        <div className="card bars">
          {byAgent.map((a) => (
            <div className="bar-row" key={a.name}>
              <span>{a.name}</span>
              <div className="bar"><i style={{ width: `${(a.cost / maxCost) * 100}%` }} /></div>
              <b>${(a.cost / 1000).toFixed(1)}k</b>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
