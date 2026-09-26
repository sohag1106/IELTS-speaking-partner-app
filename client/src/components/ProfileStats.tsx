export interface ProfileStatsData {
  count: number;
  avgBand: number | null;
}

interface ProfileStatsProps {
  stats: ProfileStatsData;
}

/** Headline numbers: tests taken and the average band across them. */
export function ProfileStats({ stats }: ProfileStatsProps) {
  return (
    <div className="row" style={{ gap: '2rem' }}>
      <div>
        <div className="muted">Tests taken</div>
        <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.count}</div>
      </div>
      <div>
        <div className="muted">Average band</div>
        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>
          {stats.avgBand === null ? '—' : stats.avgBand.toFixed(1)}
        </div>
      </div>
    </div>
  );
}
