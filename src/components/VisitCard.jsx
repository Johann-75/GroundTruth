import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Calendar, ChevronRight, Cloud, Check, Trash2, AlertTriangle } from 'lucide-react';
import SentimentBadge from './SentimentBadge';
import { truncateText, getRelativeTime } from '../utils/helpers';
import { deleteVisit } from '../services/storage';
import './VisitCard.css';

/**
 * VisitCard — displays a visit summary in a list.
 * Shows date, location, program area, sentiment, and key finding snippet.
 * Tapping navigates to the visit detail page.
 */
function VisitCard({ visit, onDelete }) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setConfirmDelete(true);
  };

  const handleConfirmDelete = async (e) => {
    e.stopPropagation();
    try {
      await deleteVisit(visit.id);
      onDelete?.(visit.id);
    } catch (err) {
      console.error('[VisitCard] Failed to delete:', err);
      setConfirmDelete(false);
    }
  };

  const handleCancelDelete = (e) => {
    e.stopPropagation();
    setConfirmDelete(false);
  };

  const handleClick = () => {
    if (!confirmDelete) navigate(`/visit/${visit.id}`);
  };

  // Get first key finding from AI summary (if available)
  const keyFinding = visit.aiSummary?.key_findings?.[0] || null;

  return (
    <div className="visit-card card" onClick={handleClick} id={`visit-card-${visit.id}`}>
      {confirmDelete ? (
        <div className="visit-card-confirm-delete" onClick={(e) => e.stopPropagation()}>
          <AlertTriangle size={16} className="visit-card-confirm-icon" />
          <span>Delete this visit permanently?</span>
          <div className="visit-card-confirm-actions">
            <button className="btn btn-ghost" onClick={handleCancelDelete}>Cancel</button>
            <button className="btn btn-danger" onClick={handleConfirmDelete}>Delete</button>
          </div>
        </div>
      ) : (
        <>
          <div className="visit-card-header">
            <div className="visit-card-meta">
              <span className="visit-card-date">
                <Calendar size={14} />
                {getRelativeTime(visit.createdAt || visit.created_at || visit.date)}
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
                <SentimentBadge sentiment={visit.aiSummary.community_sentiment} size="sm" />
              )}
            </div>

            {keyFinding && (
              <p className="visit-card-finding">{truncateText(keyFinding, 120)}</p>
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
                <span className="visit-card-indicator visit-card-indicator-ai" title="AI debrief generated">
                  ✨
                </span>
              )}
              {visit.syncStatus === 'pending' ? (
                <span className="visit-card-indicator visit-card-indicator-pending" title="Pending sync">
                  <Cloud size={14} />
                </span>
              ) : (
                <span className="visit-card-indicator visit-card-indicator-synced" title="Synced to cloud">
                  <Check size={14} />
                </span>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="visit-card-delete-btn"
                  title="Delete visit"
                  onClick={handleDeleteClick}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default VisitCard;
