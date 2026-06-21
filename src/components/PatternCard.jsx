import './PatternCard.css';

/**
 * PatternCard — displays a detected pattern or insight on the dashboard.
 * Has a colored left border based on severity.
 */
function PatternCard({ icon: Icon, title, description, severity = 'info', count }) {
  return (
    <div className={`pattern-card card pattern-card-${severity}`}>
      <div className="pattern-card-header">
        {Icon && <Icon size={18} className="pattern-card-icon" />}
        <h4 className="pattern-card-title">{title}</h4>
        {count !== undefined && (
          <span className="pattern-card-count">{count}×</span>
        )}
      </div>
      {description && (
        <p className="pattern-card-desc">{description}</p>
      )}
    </div>
  );
}

export default PatternCard;
