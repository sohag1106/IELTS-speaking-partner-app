interface Props {
  remainingSec: number;
  totalSec: number;
  label: string;
}

/** SVG countdown ring driven by useServerTimer. */
export function CountdownRing({ remainingSec, totalSec, label }: Props) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const fraction =
    totalSec > 0 ? Math.min(1, Math.max(0, 1 - remainingSec / totalSec)) : 0;
  const mins = Math.floor(remainingSec / 60);
  const secs = Math.floor(remainingSec % 60);
  const urgent = remainingSec <= 10;

  return (
    <div className={`countdown${urgent ? ' urgent' : ''}`} role="timer" aria-live="off">
      <svg viewBox="0 0 100 100" width="112" height="112" aria-hidden="true">
        <circle
          className="countdown-track"
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="7"
        />
        <circle
          className="countdown-fill"
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="7"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * fraction}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="countdown-time">
        {mins}:{String(secs).padStart(2, '0')}
      </div>
      <div className="countdown-label">{label}</div>
    </div>
  );
}
