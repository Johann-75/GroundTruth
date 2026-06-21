import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import './StatCard.css';

/**
 * StatCard — displays a single metric on the dashboard.
 * Shows an icon, value, label, and optional trend indicator.
 */
function StatCard({ icon: Icon, label, value, trend, trendValue, color, onClick, clickable, active }) {
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend === 'up') return <TrendingUp size={14} />;
    if (trend === 'down') return <TrendingDown size={14} />;
    return <Minus size={14} />;
  };

  const getTrendClass = () => {
    if (trend === 'up') return 'stat-card-trend-up';
    if (trend === 'down') return 'stat-card-trend-down';
    return 'stat-card-trend-neutral';
  };

  const handleCardClick = (e) => {
    console.log(`[StatCard] Click detected on card: "${label}"! hasOnClick:`, !!onClick);
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <div
      className={`stat-card card ${clickable ? 'stat-card--clickable' : ''}`}
      onClick={handleCardClick}
      style={{
        cursor: clickable ? 'pointer' : undefined,
        borderColor: active && color ? color : undefined,
        background: active && color ? `${color}08` : undefined,
        boxShadow: active && color ? `0 0 12px ${color}22` : undefined,
      }}
    >
      <div className="stat-card-header">
        <div
          className="stat-card-icon"
          style={{ background: color ? `${color}15` : undefined, color: color }}
        >
          {Icon && <Icon size={22} />}
        </div>
        {trend && (
          <div className={`stat-card-trend ${getTrendClass()}`}>
            {getTrendIcon()}
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
