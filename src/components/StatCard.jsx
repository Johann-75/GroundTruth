import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import './StatCard.css';

const TREND_ICONS = {
  up:      <TrendingUp size={14} />,
  down:    <TrendingDown size={14} />,
  neutral: <Minus size={14} />,
};

const TREND_CLASSES = {
  up:      'stat-card-trend-up',
  down:    'stat-card-trend-down',
  neutral: 'stat-card-trend-neutral',
};

/**
 * StatCard — displays a single metric with an icon, value, label, and optional trend.
 */
function StatCard({ icon: Icon, label, value, trend, trendValue, color, onClick, clickable, active }) {
  return (
    <div
      className={`stat-card card${clickable ? ' stat-card--clickable' : ''}`}
      onClick={onClick}
      style={{
        cursor:      clickable ? 'pointer' : undefined,
        borderColor: active && color ? color : undefined,
        background:  active && color ? `${color}08` : undefined,
        boxShadow:   active && color ? `0 0 12px ${color}22` : undefined,
      }}
    >
      <div className="stat-card-header">
        <div
          className="stat-card-icon"
          style={{ background: color ? `${color}15` : undefined, color }}
        >
          {Icon && <Icon size={22} />}
        </div>
        {trend && (
          <div className={`stat-card-trend ${TREND_CLASSES[trend] ?? TREND_CLASSES.neutral}`}>
            {TREND_ICONS[trend] ?? TREND_ICONS.neutral}
            <span>{trendValue}</span>
          </div>
        )}
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}

export default StatCard;
