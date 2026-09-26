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
    <div className="stats-grid">
      <div className="stat-tile">
        <div className="stat-label">Tests taken</div>
        <div className="stat-value">{stats.count}</div>
      </div>
      <div className="stat-tile">
        <div className="stat-label">Average band</div>
        <div className="stat-value accent">
          {stats.avgBand === null ? '—' : stats.avgBand.toFixed(1)}
        </div>
      </div>
    </div>
  );
}
