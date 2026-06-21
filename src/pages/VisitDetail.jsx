import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft, Calendar, MapPin, Briefcase, Users, FileText,
  Mic, Edit
} from 'lucide-react';
import AISummaryPanel from '../components/AISummaryPanel';
import SentimentBadge from '../components/SentimentBadge';
import { getVisitById, updateVisit } from '../services/storage';
import { generateFieldDebrief } from '../services/ai';
import { formatDate } from '../utils/helpers';
import './VisitDetail.css';

/**
 * VisitDetail page — shows a single visit with raw log + AI debrief.
 * AI summary provides macro-level structured analysis.
 */
function VisitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useOutletContext();
  
  const [visit, setVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    loadVisitData();
  }, [id]);

  const loadVisitData = async () => {
    setLoading(true);
    try {
      const visitData = await getVisitById(id);
      if (!visitData) {
        setNotFound(true);
        return;
      }
      setVisit(visitData);
    } catch (err) {
      console.error('Failed to load visit:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!visit) return;
    setIsRegenerating(true);
    try {
      const summary = await generateFieldDebrief(visit);
      await updateVisit(id, { aiSummary: summary });
      setVisit((prev) => ({ ...prev, aiSummary: summary }));
    } catch (err) {
      console.error('Failed to regenerate summary:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else if (user.role === 'manager') {
      navigate('/dashboard');
    } else {
      navigate('/my-visits');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="visit-detail">
        <div className="visit-detail-loading">
          <div className="loading-pulse" />
          <p>{'Loading visit details...'}</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (notFound || !visit) {
    return (
      <div className="visit-detail">
        <div className="visit-detail-not-found card">
          <h2>{'Visit Not Found'}</h2>
          <p>{'This visit may have been deleted or the link is invalid.'}</p>
          <button className="btn btn-primary" onClick={handleBack}>
            <ArrowLeft size={16} />
            {'Go Back'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="visit-detail">
      {/* Header */}
      <div className="visit-detail-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
          <button className="btn btn-ghost visit-detail-back" style={{ marginBottom: 0 }} onClick={handleBack}>
            <ArrowLeft size={18} />
            {'Back'}
          </button>
          
          {user.role === 'field_officer' && visit.officerName === user.name && (
            <button 
              className="btn btn-secondary" 
              onClick={() => navigate(`/edit-visit/${visit.id}`)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Edit size={16} />
              {'Edit Visit'}
            </button>
          )}
        </div>
        <div className="visit-detail-title-block">
          <h1>
            {visit.district}, {visit.state}
          </h1>
          <p className="visit-detail-subtitle">
            {formatDate(visit.date)} · {visit.programArea} · {`Logged by ${visit.officerName}`}
          </p>
        </div>
      </div>

      {/* Visit Info Grid */}
      <div className="visit-info-grid">
        <div className="visit-info-card">
          <Calendar size={18} className="visit-info-icon" />
          <div>
            <span className="visit-info-label">{'Date'}</span>
            <span className="visit-info-value">{formatDate(visit.date)}</span>
          </div>
        </div>
        <div className="visit-info-card">
          <MapPin size={18} className="visit-info-icon" />
          <div>
            <span className="visit-info-label">{'Location'}</span>
            <span className="visit-info-value">
              {[visit.block ? visit.block : '', visit.district ? visit.district : '', visit.state ? visit.state : ''].filter(Boolean).join(', ')}
            </span>
          </div>
        </div>
        <div className="visit-info-card">
          <Briefcase size={18} className="visit-info-icon" />
          <div>
            <span className="visit-info-label">{'Program Area'}</span>
            <span className="visit-info-value">{visit.programArea}</span>
          </div>
        </div>
        <div className="visit-info-card">
          <Users size={18} className="visit-info-icon" />
          <div>
            <span className="visit-info-label">{'Stakeholders Met'}</span>
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
          {'Field Notes'}
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
            {'Voice Transcription'}
          </h2>
          <div className="visit-transcription card">
            <p>{visit.voiceTranscription}</p>
          </div>
        </div>
      )}

      {/* AI Summary — Big Picture */}
      <div className="visit-section">
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
