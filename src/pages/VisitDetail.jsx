import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft, Calendar, MapPin, Briefcase, Users, FileText,
  Mic, Edit, Trash2, AlertTriangle
} from 'lucide-react';
import AISummaryPanel from '../components/AISummaryPanel';
import SentimentBadge from '../components/SentimentBadge';
import { getVisitById, updateVisit, deleteVisit } from '../services/storage';
import { generateFieldDebrief } from '../services/ai';
import { formatDate } from '../utils/helpers';
import './VisitDetail.css';

/**
 * VisitDetail — displays a single visit with raw log and AI debrief.
 */
function VisitDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { user }   = useOutletContext();

  const [visit,         setVisit]         = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [deleteError,   setDeleteError]   = useState('');
  const [regenError,    setRegenError]    = useState('');

  useEffect(() => {
    const loadVisit = async () => {
      setLoading(true);
      try {
        const data = await getVisitById(id);
        setVisit(data ?? null);
      } catch (err) {
        console.error('[VisitDetail] Failed to load visit:', err);
        setVisit(null);
      } finally {
        setLoading(false);
      }
    };
    loadVisit();
  }, [id]);

  const handleRegenerate = async () => {
    if (!visit) return;
    setIsRegenerating(true);
    setRegenError('');
    try {
      const summary = await generateFieldDebrief(visit);
      await updateVisit(id, { aiSummary: summary });
      setVisit((prev) => ({ ...prev, aiSummary: summary }));
    } catch (err) {
      console.error('[VisitDetail] Regenerate failed:', err);
      setRegenError(err.message || 'Failed to regenerate AI summary. Please check your settings/connection and try again.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleBack = () => {
    if (window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate(user.role === 'manager' ? '/dashboard' : '/my-visits');
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    setDeleteError('');
    try {
      await deleteVisit(visit.id);
      navigate(user.role === 'manager' ? '/dashboard' : '/my-visits', { replace: true });
    } catch (err) {
      console.error('[VisitDetail] Delete failed:', err);
      setDeleteError('Failed to delete visit. Please try again.');
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="visit-detail">
        <div className="visit-detail-loading">
          <div className="loading-pulse" />
          <p>Loading visit details...</p>
        </div>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="visit-detail">
        <div className="visit-detail-not-found card">
          <h2>Visit Not Found</h2>
          <p>This visit may have been deleted or the link is invalid.</p>
          <button className="btn btn-primary" onClick={handleBack}>
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const locationParts = [visit.block, visit.district, visit.state].filter(Boolean);

  return (
    <div className="visit-detail">
      {/* Header */}
      <div className="visit-detail-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
          <button className="btn btn-ghost visit-detail-back" style={{ marginBottom: 0 }} onClick={handleBack}>
            <ArrowLeft size={18} />
            Back
          </button>
          {showDeleteConfirm ? (
            <div className="visit-detail-confirm-delete" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', padding: '6px 12px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-md)' }}>
              <AlertTriangle size={16} style={{ color: 'var(--color-danger)' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Delete permanently?</span>
              <div style={{ display: 'flex', gap: 'var(--space-xs)', marginLeft: 'var(--space-sm)' }}>
                <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '0.78rem' }} onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                <button className="btn btn-danger" style={{ padding: '2px 8px', fontSize: '0.78rem' }} onClick={handleDelete}>Delete</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              {user.role === 'field_officer' && visit.officerName === user.name && (
                <button
                  className="btn btn-secondary"
                  onClick={() => navigate(`/edit-visit/${visit.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Edit size={16} />
                  Edit Visit
                </button>
              )}
              {(user.role === 'manager' || (user.role === 'field_officer' && visit.officerName === user.name)) && (
                <button
                  className="btn btn-danger"
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Trash2 size={16} />
                  Delete Visit
                </button>
              )}
            </div>
          )}
        </div>
        <div className="visit-detail-title-block">
          <h1>{visit.district}, {visit.state}</h1>
          <p className="visit-detail-subtitle">
            {formatDate(visit.date)} · {visit.programArea} · Logged by {visit.officerName}
          </p>
        </div>
      </div>

      {deleteError && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--color-danger, #EF4444)',
          borderRadius: 'var(--radius-md, 8px)',
          padding: 'var(--space-md, 16px)',
          marginBottom: 'var(--space-lg, 24px)',
          color: 'var(--color-danger, #EF4444)',
          fontSize: '0.9rem'
        }}>
          {deleteError}
        </div>
      )}

      {/* Info Grid */}
      <div className="visit-info-grid">
        <div className="visit-info-card">
          <Calendar size={18} className="visit-info-icon" />
          <div>
            <span className="visit-info-label">Date</span>
            <span className="visit-info-value">{formatDate(visit.date)}</span>
          </div>
        </div>
        <div className="visit-info-card">
          <MapPin size={18} className="visit-info-icon" />
          <div>
            <span className="visit-info-label">Location</span>
            <span className="visit-info-value">{locationParts.join(', ')}</span>
          </div>
        </div>
        <div className="visit-info-card">
          <Briefcase size={18} className="visit-info-icon" />
          <div>
            <span className="visit-info-label">Program Area</span>
            <span className="visit-info-value">{visit.programArea}</span>
          </div>
        </div>
        <div className="visit-info-card">
          <Users size={18} className="visit-info-icon" />
          <div>
            <span className="visit-info-label">Stakeholders Met</span>
            <div className="visit-stakeholders">
              {visit.stakeholders?.map((s, i) => (
                <span key={i} className="badge">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Field Notes */}
      <div className="visit-section">
        <h2 className="visit-section-title">
          <FileText size={18} />
          Field Notes
        </h2>
        <div className="visit-notes card">
          <p>{visit.notes || 'No notes recorded.'}</p>
        </div>
      </div>

      {/* Voice Transcription */}
      {visit.voiceTranscription && (
        <div className="visit-section">
          <h2 className="visit-section-title">
            <Mic size={18} />
            Voice Transcription
          </h2>
          <div className="visit-transcription card">
            <p>{visit.voiceTranscription}</p>
          </div>
        </div>
      )}

      {/* AI Summary */}
      <div className="visit-section">
        {regenError && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--color-danger, #EF4444)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: 'var(--space-md, 16px)',
            marginBottom: 'var(--space-md, 16px)',
            color: 'var(--color-danger, #EF4444)',
            fontSize: '0.9rem'
          }}>
            {regenError}
          </div>
        )}
        <AISummaryPanel
          summary={visit.aiSummary}
          onRegenerate={handleRegenerate}
          isRegenerating={isRegenerating}
        />
      </div>
    </div>
  );
}

export default VisitDetail;
