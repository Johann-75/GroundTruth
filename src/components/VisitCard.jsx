import { useNavigate } from 'react-router-dom';
import { MapPin, Calendar, ChevronRight, Cloud, Check } from 'lucide-react';
import SentimentBadge from './SentimentBadge';
import { formatDate, truncateText, formatTime } from '../utils/helpers';
import './VisitCard.css';

/**
 * VisitCard — displays a visit summary in a list.
 * Shows date, location, program area, sentiment, and key finding snippet.
 * Tapping navigates to the visit detail page.
 */
function VisitCard({ visit }) {
  const navigate = useNavigate();
  
  const handleClick = () => {
    navigate(`/visit/${visit.id}`);
  };

  // Get first key finding from AI summary (if available)
  const keyFinding = visit.aiSummary?.key_findings?.[0] || null;

  return (
    <div className="visit-card card" onClick={handleClick} id={`visit-card-${visit.id}`}>
      <div className="visit-card-header">
        <div className="visit-card-meta">
          <span className="visit-card-date">
            <Calendar size={14} />
            {formatDate(visit.date)} {formatTime(visit.createdAt || visit.created_at)}
          </span>
          <span className="visit-card-location">
            <MapPin size={14} />
            {visit.district}, {visit.state}
          </span>
        </div>
        <ChevronRight size={18} className="visit-card-arrow" />
      </div>

      <div className="visit-card-body">
        <div className="visit-card-program-row">
          <span className="visit-card-program badge">{visit.programArea}</span>
          {visit.aiSummary?.community_sentiment && (
            <SentimentBadge
              sentiment={visit.aiSummary.community_sentiment}
              size="sm"
            />
          )}
        </div>

        {keyFinding && (
          <p className="visit-card-finding">
            {truncateText(keyFinding, 120)}
          </p>
        )}

        {!keyFinding && visit.notes && (
          <p className="visit-card-finding visit-card-finding-raw">
            {truncateText(visit.notes, 120)}
          </p>
        )}
      </div>

      <div className="visit-card-footer">
        <span className="visit-card-officer">{visit.officerName}</span>
        <div className="visit-card-indicators">
          {visit.aiSummary && (
            <span className="visit-card-indicator visit-card-indicator-ai" title={'AI debrief generated'}>
              ✨
            </span>
          )}
          {visit.syncStatus === 'pending' ? (
            <span className="visit-card-indicator visit-card-indicator-pending" title={'Pending Sync'}>
              <Cloud size={14} />
            </span>
          ) : (
            <span className="visit-card-indicator visit-card-indicator-synced" title={'Synced to Cloud'}>
              <Check size={14} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default VisitCard;
