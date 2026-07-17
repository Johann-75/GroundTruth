import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  MapPin,
  Calendar,
  Users,
  FileText,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Info,
  Mic,
  Map,
} from 'lucide-react';
import {
  PROGRAM_AREAS,
  STAKEHOLDER_TYPES,
  getStates,
  getDistricts,
} from '../utils/constants';
import { getTodayISO } from '../utils/helpers';
import { saveVisit, getVisitById, updateVisit } from '../services/storage';
import { generateFieldDebrief } from '../services/ai';
import { syncPendingVisits } from '../services/sync';
import VoiceRecorder from '../components/VoiceRecorder';
import MapSelectorModal from '../components/MapSelectorModal';
import './NewVisit.css';

/**
 * NewVisit — multi-section form for logging or editing a field visit.
 * Saves locally first, then generates an AI debrief when online.
 */
function NewVisit() {
  const { user }   = useOutletContext();
  const navigate   = useNavigate();
  const { id }     = useParams();

  // ── Form state ──────────────────────────────────────────────────────────
  const [date,              setDate]              = useState(getTodayISO());
  const [state,             setState]             = useState('');
  const [district,          setDistrict]          = useState('');
  const [block,             setBlock]             = useState('');
  const [programArea,       setProgramArea]       = useState('');
  const [customProgramArea, setCustomProgramArea] = useState('');
  const [stakeholders,      setStakeholders]      = useState([]);
  const [customStakeholder, setCustomStakeholder] = useState('');
  const [customStakeholders, setCustomStakeholders] = useState([]);
  const [notes,             setNotes]             = useState('');
  const [voiceTranscription, setVoiceTranscription] = useState('');

  // ── UI state ────────────────────────────────────────────────────────────
  const [submitting,    setSubmitting]    = useState(false);
  const [loadingVisit,  setLoadingVisit]  = useState(!!id);
  const [errors,        setErrors]        = useState({});
  const [submitError,   setSubmitError]   = useState('');
  const [recentLocations, setRecentLocations] = useState([]);
  const [isRecording,   setIsRecording]   = useState(false);
  const [isRecorderVisible, setIsRecorderVisible] = useState(true);
  const [isOnlineState, setIsOnlineState] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  const originalVisitRef = useRef(null);
  const recorderContainerRef = useRef(null);
  const voiceRecorderRef = useRef(null);

  // Monitor online status to update UI buttons reactively
  useEffect(() => {
    const handleStatusChange = () => {
      setIsOnlineState(navigator.onLine);
    };
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // Load recent locations from localStorage on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('recentLocations');
      if (cached) {
        setRecentLocations(JSON.parse(cached));
      }
    } catch (e) {
      console.warn('Failed to load recent locations from localStorage:', e);
    }
  }, []);

  // Monitor visibility of the voice recorder container inside the viewport
  useEffect(() => {
    let rafPending = false;
    const checkVisibility = () => {
      if (!recorderContainerRef.current) return;
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        if (!recorderContainerRef.current) return;
        const rect = recorderContainerRef.current.getBoundingClientRect();
        
        // Card is visible if it is partially inside the browser viewport bounds
        const isVisible = rect.bottom > 80 && rect.top < window.innerHeight - 80;
        setIsRecorderVisible(isVisible);
      });
    };

    // Capture scroll events at window level from any scrolling containers on the page
    window.addEventListener('scroll', checkVisibility, { capture: true, passive: true });
    window.addEventListener('resize', checkVisibility, { passive: true });
    
    // Initial run
    checkVisibility();

    return () => {
      window.removeEventListener('scroll', checkVisibility, { capture: true });
      window.removeEventListener('resize', checkVisibility);
    };
  }, [loadingVisit, isRecording]);

  useEffect(() => {
    if (!id) return;
    const fetchVisit = async () => {
      setLoadingVisit(true);
      try {
        const visitData = await getVisitById(id);
        if (!visitData) {
          navigate('/my-visits', { replace: true });
          return;
        }

        originalVisitRef.current = visitData; // cache for submit

        setDate(visitData.date);
        setState(visitData.state);
        setDistrict(visitData.district);
        setBlock(visitData.block || '');
        setVoiceTranscription(visitData.voiceTranscription || '');

        if (PROGRAM_AREAS.includes(visitData.programArea)) {
          setProgramArea(visitData.programArea);
        } else {
          setProgramArea('Other');
          setCustomProgramArea(visitData.programArea);
        }

        const standard = [];
        const custom   = [];
        visitData.stakeholders?.forEach((sh) => {
          if (STAKEHOLDER_TYPES.includes(sh)) standard.push(sh);
          else custom.push(sh);
        });
        if (custom.length > 0 && !standard.includes('Other')) standard.push('Other');
        setStakeholders(standard);
        setCustomStakeholders(custom);
        setNotes(visitData.notes || '');
      } catch (err) {
        console.error('[NewVisit] Failed to load visit for editing:', err);
        navigate('/my-visits', { replace: true });
      } finally {
        setLoadingVisit(false);
      }
    };
    fetchVisit();
  }, [id, navigate]);

  // ── Derived values ──────────────────────────────────────────────────────
  const states    = useMemo(() => getStates(), []);
  const districts = useMemo(() => getDistricts(state), [state]);

  const section1Filled = !!(
    date && state && district &&
    (programArea === 'Other' ? customProgramArea.trim() : programArea)
  );
  const section2Filled = notes.trim().length > 0;

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleStateChange    = (v) => { setState(v);    setDistrict(''); setBlock(''); };
  const handleDistrictChange = (v) => { setDistrict(v); setBlock(''); };

  const toggleStakeholder = (type) => {
    setStakeholders((prev) =>
      prev.includes(type) ? prev.filter((s) => s !== type) : [...prev, type]
    );
  };

  const handleCustomStakeholderKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const val = customStakeholder.trim();
    if (val && !customStakeholders.includes(val) && !STAKEHOLDER_TYPES.includes(val)) {
      setCustomStakeholders((prev) => [...prev, val]);
      setCustomStakeholder('');
    }
  };

  const addCustomStakeholder = () => {
    const val = customStakeholder.trim();
    if (val && !customStakeholders.includes(val) && !STAKEHOLDER_TYPES.includes(val)) {
      setCustomStakeholders((prev) => [...prev, val]);
      setCustomStakeholder('');
    }
  };

  const handleTranscription = (text) => {
    setVoiceTranscription((prev) => prev.trim() ? `${prev}\n\n${text}` : text);
    setNotes((prev) => prev.trim() ? `${prev}\n\n${text}` : text);
  };

  const validate = () => {
    const errs = {};
    if (!date)        errs.date = 'Date is required';
    if (!state)       errs.state = 'State is required';
    if (!district)    errs.district = 'District is required';
    if (!programArea) {
      errs.programArea = 'Program area is required';
    } else if (programArea === 'Other' && !customProgramArea.trim()) {
      errs.programArea = 'Please enter a custom program area';
    }
    if (stakeholders.includes('Other') && customStakeholders.length === 0 && !customStakeholder.trim()) {
      errs.stakeholders = 'Please enter a custom stakeholder name';
    }
    if (!notes.trim()) errs.notes = 'Please add some observations';
    return errs;
  };

  const handleMapConfirm = (selectedState, selectedDistrict) => {
    handleStateChange(selectedState);
    handleDistrictChange(selectedDistrict);
  };

  const handleFloatingMicClick = () => {
    // 1. Toggle recording state inside VoiceRecorder (same start/stop functionality)
    if (voiceRecorderRef.current) {
      if (isRecording) {
        voiceRecorderRef.current.stopRecording();
      } else {
        voiceRecorderRef.current.startRecording();
      }
    }

    // 2. Scroll .layout-main (the actual overflow container) to the voice recorder
    const scrollEl  = document.querySelector('.layout-main');
    const targetEl  = document.getElementById('voice-recorder');
    if (scrollEl && targetEl) {
      const scrollRect = scrollEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const offset     = targetRect.top - scrollRect.top + scrollEl.scrollTop - 80;
      scrollEl.scrollTo({ top: offset, behavior: 'smooth' });
    } else {
      targetEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSubmit = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      const firstKey = Object.keys(validationErrors)[0];
      document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setErrors({});
    setSubmitError('');
    setSubmitting(true);

    try {
      const finalProgramArea = programArea === 'Other' ? customProgramArea.trim() : programArea;

      // Merge standard + custom stakeholders (deduplicated)
      const finalStakeholders = [
        ...stakeholders.filter((s) => s !== 'Other'),
        ...customStakeholders,
        ...(stakeholders.includes('Other') && customStakeholder.trim() ? [customStakeholder.trim()] : []),
      ].filter((s, i, arr) => arr.indexOf(s) === i);

      const visitPayload = {
        date,
        state,
        district,
        block,
        programArea:       finalProgramArea,
        stakeholders:      finalStakeholders,
        notes,
        voiceTranscription: voiceTranscription || null,
        aiSummary:         originalVisitRef.current?.aiSummary || null,
        officerName:       user?.name || '',
      };

      let savedVisit;
      if (id) {
        const original = originalVisitRef.current;
        const merged   = {
          ...original,
          ...visitPayload,
          officerName: original?.officerName || user?.name || '',
          createdAt:   original?.createdAt   || new Date().toISOString(),
        };
        savedVisit = await updateVisit(id, merged);
      } else {
        savedVisit = await saveVisit(visitPayload);
      }

      // Save recent location to cache
      try {
        const currentLoc = { state, district, block };
        const cached = localStorage.getItem('recentLocations');
        let list = cached ? JSON.parse(cached) : [];
        list = list.filter(loc => 
          !(loc.state === state && loc.district === district && loc.block === block)
        );
        list.unshift(currentLoc);
        list = list.slice(0, 3);
        localStorage.setItem('recentLocations', JSON.stringify(list));
      } catch (e) {
        console.warn('Failed to save recent location to cache:', e);
      }

      // Generate AI debrief if online (non-blocking on failure)
      if (navigator.onLine) {
        try {
          const aiResult = await generateFieldDebrief(visitPayload);
          if (aiResult) await updateVisit(savedVisit.id, { aiSummary: aiResult });
        } catch (aiErr) {
          console.warn('[NewVisit] AI summary failed (non-critical):', aiErr);
        }
      }

      // Kick off background sync (non-blocking)
      syncPendingVisits().catch((err) =>
        console.error('[NewVisit] Background sync trigger failed:', err)
      );

      navigate(`/visit/${savedVisit.id}`);
    } catch (err) {
      console.error('[NewVisit] Submit failed:', err);
      setSubmitError(err.message || 'Submission failed. Please check your connection and try again.');
      setSubmitting(false);
    }
  };

  if (loadingVisit) {
    return (
      <div className="new-visit-page">
        <div className="visit-detail-loading" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', gap: 'var(--space-md)' }}>
          <div className="loading-pulse" />
          <p>Loading visit data for editing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="new-visit-page">
      {/* Submit overlay */}
      {submitting && (
        <div className="submit-overlay">
          <div className="submit-overlay-content">
            <Sparkles size={40} className="submit-overlay-icon" />
            <div className="submit-spinner" />
            <p className="submit-overlay-text">
              {id ? 'Updating and analyzing observations...' : 'Analyzing your field observations...'}
            </p>
            <p className="submit-overlay-subtext">Generating AI-powered debrief summary</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="new-visit-header">
        <h1 className="new-visit-header-title">
          <MapPin size={24} />
          {id ? 'Edit Field Visit' : 'Log Field Visit'}
        </h1>
        <p className="new-visit-header-subtitle">
          {id
            ? 'Modify your observations and regenerate the AI debrief.'
            : 'Record your observations and let AI create a structured debrief.'}
        </p>
      </header>

      {submitError && (
        <div className="form-submit-error-banner" style={{
          background: 'var(--color-danger-light, rgba(239, 68, 68, 0.1))',
          border: '1px solid var(--color-danger, #EF4444)',
          borderRadius: 'var(--radius-md, 8px)',
          padding: 'var(--space-md, 16px)',
          marginBottom: 'var(--space-lg, 24px)',
          color: 'var(--color-danger, #EF4444)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm, 12px)'
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <span>{submitError}</span>
        </div>
      )}

      {/* Progress */}
      <div className="form-progress">
        <div className="form-progress-step">
          <div className={`form-progress-dot ${section1Filled ? 'completed' : 'active'}`}>
            {section1Filled ? <CheckCircle size={16} /> : '1'}
          </div>
          <span className={`form-progress-label ${section1Filled ? 'completed' : 'active'}`}>
            Details
          </span>
        </div>
        <div className={`form-progress-connector ${section1Filled ? 'completed' : ''}`} />
        <div className="form-progress-step">
          <div className={`form-progress-dot ${section2Filled ? 'completed' : section1Filled ? 'active' : ''}`}>
            {section2Filled ? <CheckCircle size={16} /> : '2'}
          </div>
          <span className={`form-progress-label ${section2Filled ? 'completed' : section1Filled ? 'active' : ''}`}>
            Observations
          </span>
        </div>
        <div className={`form-progress-connector ${section2Filled ? 'completed' : ''}`} />
        <div className="form-progress-step">
          <div className={`form-progress-dot ${section1Filled && section2Filled ? 'active' : ''}`}>
            {section1Filled && section2Filled ? <CheckCircle size={16} /> : '3'}
          </div>
          <span className={`form-progress-label ${section1Filled && section2Filled ? 'active' : ''}`}>
            Submit
          </span>
        </div>
      </div>

      {/* Section 1: Visit Details */}
      <section className="form-section" id="section-details">
        <div className="form-section-header">
          <div className="form-section-number">1</div>
          <h2 className="form-section-title"><MapPin /> Visit Details</h2>
        </div>

        {recentLocations.length > 0 && (
          <div className="recent-locations-container" style={{
            marginBottom: 'var(--space-md, 16px)',
            padding: '12px',
            background: 'var(--color-surface-alt, #273549)',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px dashed var(--color-border, #334155)'
          }}>
            <span className="recent-locations-label" style={{
              display: 'block',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text-muted, #64748B)',
              marginBottom: '8px',
              fontWeight: 600
            }}>
              Quick-Fill Recent Locations:
            </span>
            <div className="recent-locations-pills" style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-sm, 8px)'
            }}>
              {recentLocations.map((loc, idx) => {
                const label = [loc.block, loc.district, loc.state].filter(Boolean).join(', ');
                const isActive = state === loc.state && district === loc.district && block === (loc.block || '');
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    style={{
                      fontSize: '0.8rem',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm, 6px)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: isActive ? 'var(--color-primary, #3B82F6)' : undefined,
                      borderColor: isActive ? 'var(--color-primary-dark, #2563EB)' : undefined,
                      color: isActive ? '#FFFFFF' : undefined
                    }}
                    onClick={() => {
                      if (isActive) {
                        setState('');
                        setDistrict('');
                        setBlock('');
                      } else {
                        setState(loc.state);
                        setDistrict(loc.district);
                        setBlock(loc.block || '');
                      }
                    }}
                  >
                    <MapPin size={12} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="form-row">
          <div className="form-group" id="field-date">
            <label className="form-label form-label-required" htmlFor="visit-date">Date</label>
            <input
              id="visit-date" type="date" className="input"
              value={date} onChange={(e) => setDate(e.target.value)}
            />
            {errors.date && <div className="form-error"><AlertCircle /> {errors.date}</div>}
          </div>

          <div className="form-group" id="field-programArea">
            <label className="form-label form-label-required" htmlFor="visit-program-area">Program Area</label>
            <select
              id="visit-program-area" className="select" value={programArea}
              onChange={(e) => {
                setProgramArea(e.target.value);
                if (e.target.value !== 'Other') setCustomProgramArea('');
              }}
            >
              <option value="">Select program area</option>
              {PROGRAM_AREAS.map((area) => <option key={area} value={area}>{area}</option>)}
              <option value="Other">Other (Custom)</option>
            </select>
            {programArea === 'Other' && (
              <input
                type="text" className="input" style={{ marginTop: '10px' }}
                placeholder="Enter custom program area"
                value={customProgramArea}
                onChange={(e) => setCustomProgramArea(e.target.value)}
                id="visit-custom-program-area"
                autoFocus
              />
            )}
            {errors.programArea && <div className="form-error"><AlertCircle /> {errors.programArea}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group" id="field-state">
            <label className="form-label form-label-required" htmlFor="visit-state">State</label>
            <select
              id="visit-state" className="select" value={state}
              onChange={(e) => handleStateChange(e.target.value)}
            >
              <option value="">Select state</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {errors.state && <div className="form-error"><AlertCircle /> {errors.state}</div>}
          </div>

          <div className="form-group" id="field-district">
            <label className="form-label form-label-required" htmlFor="visit-district">District</label>
            <select
              id="visit-district" className="select" value={district}
              onChange={(e) => handleDistrictChange(e.target.value)}
              disabled={!state}
            >
              <option value="">{state ? 'Select district' : 'Select state first'}</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            {errors.district && <div className="form-error"><AlertCircle /> {errors.district}</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-md)', alignItems: 'end', marginBottom: 'var(--space-md)' }}>
          <div className="form-group" id="field-block" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="visit-block">Block / Village</label>
            <input
              id="visit-block" type="text" className="input"
              placeholder={district ? 'Enter block or village name' : 'Select district first'}
              value={block}
              onChange={(e) => setBlock(e.target.value)}
              disabled={!district}
            />
          </div>

          <div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 16px',
                borderStyle: 'dashed',
                borderWidth: '1px',
                borderColor: 'var(--color-primary-light)',
                background: 'rgba(59, 130, 246, 0.05)',
                whiteSpace: 'nowrap'
              }}
              onClick={() => setIsMapModalOpen(true)}
            >
              <Map size={15} style={{ color: 'var(--color-primary-light)' }} />
              <span>Open Map</span>
            </button>
          </div>
        </div>

        <div className="form-group" id="field-stakeholders">
          <label className="form-label">
            <Users size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            Stakeholders Met
          </label>
          <div className="stakeholder-tags">
            {STAKEHOLDER_TYPES.filter((t) => t !== 'Other').map((type) => (
              <button
                key={type}
                type="button"
                id={`stakeholder-${type.replace(/[\s/]/g, '-').toLowerCase()}`}
                className={`stakeholder-tag${stakeholders.includes(type) ? ' selected' : ''}`}
                onClick={() => toggleStakeholder(type)}
              >
                {type}
              </button>
            ))}

            {customStakeholders.map((sh) => (
              <button
                key={sh} type="button"
                className="stakeholder-tag selected stakeholder-custom-tag"
                onClick={() => setCustomStakeholders((prev) => prev.filter((x) => x !== sh))}
                title="Click to remove"
              >
                {sh} <span className="remove-tag-x">&times;</span>
              </button>
            ))}

            <button
              type="button"
              id="stakeholder-other"
              className={`stakeholder-tag${stakeholders.includes('Other') ? ' selected' : ''}`}
              onClick={() => {
                toggleStakeholder('Other');
                if (!stakeholders.includes('Other')) setCustomStakeholder('');
              }}
            >
              Other
            </button>
          </div>

          {stakeholders.includes('Other') && (
            <div className="stakeholder-custom-input-container">
              <input
                type="text" className="input stakeholder-custom-input"
                placeholder="Type name & press Enter to add"
                value={customStakeholder}
                onChange={(e) => setCustomStakeholder(e.target.value)}
                onKeyDown={handleCustomStakeholderKeyDown}
                id="visit-custom-stakeholder"
                autoFocus
              />
              <button type="button" className="btn btn-secondary" onClick={addCustomStakeholder}>
                Add
              </button>
            </div>
          )}
          {errors.stakeholders && (
            <div className="form-error"><AlertCircle /> {errors.stakeholders}</div>
          )}
        </div>
      </section>

      {/* Section 2: Observations */}
      <section className="form-section" id="section-observations">
        <div className="form-section-header">
          <div className="form-section-number">2</div>
          <h2 className="form-section-title"><FileText /> Observations</h2>
        </div>

        <div className="media-row" ref={recorderContainerRef} style={{ marginBottom: 'var(--space-md, 16px)' }}>
          <VoiceRecorder
            ref={voiceRecorderRef}
            onTranscription={handleTranscription}
            onRecordingStateChange={setIsRecording}
          />
        </div>

        <div className="form-group" id="field-notes">
          <label className="form-label form-label-required" htmlFor="visit-notes">Field Notes (or speak above to transcribe)</label>
          <textarea
            id="visit-notes" className="textarea observations-textarea"
            placeholder="What did you observe? What went well? Any issues? What did community members say?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {errors.notes && <div className="form-error"><AlertCircle /> {errors.notes}</div>}
        </div>
      </section>

      {/* Submit */}
      <div className="submit-section">
        <div className="submit-section-inner">
          <button id="submit-visit-btn" className="submit-btn" onClick={handleSubmit} disabled={submitting}>
            <Sparkles />
            {isOnlineState 
              ? (id ? 'Update & Regenerate AI Debrief' : 'Generate AI Debrief') 
              : (id ? 'Save Changes (Offline)' : 'Save & Queue (Offline)')}
          </button>
          <p className="submit-hint">
            {isOnlineState 
              ? 'Your visit will be saved and analyzed by AI' 
              : 'Saved locally. AI debrief will generate once online.'}
          </p>
        </div>
      </div>

      {!isRecorderVisible && createPortal(
        <button
          type="button"
          onClick={handleFloatingMicClick}
          aria-label={isRecording ? "Recording in progress — tap to scroll back to mic" : "Scroll down to observations & voice dictation"}
          style={{
            position: 'fixed',
            bottom: '88px',
            right: '20px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: isRecording 
              ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
              : 'linear-gradient(135deg, var(--color-primary, #3B82F6) 0%, var(--color-primary-dark, #2563EB) 100%)',
            color: '#FFFFFF',
            border: '3px solid rgba(255, 255, 255, 0.25)',
            boxShadow: isRecording
              ? '0 4px 24px rgba(239,68,68,0.6), 0 2px 8px rgba(0,0,0,0.4)'
              : '0 4px 20px rgba(59,130,246,0.4), 0 2px 8px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            zIndex: 9999,
            cursor: 'pointer',
            animation: isRecording ? 'floatingMicPulse 1.4s ease-in-out infinite' : 'none',
            outline: 'none',
            transition: 'all 0.3s ease',
          }}
        >
          <Mic size={22} />
        </button>,
        document.body
      )}

      <MapSelectorModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        initialState={state}
        initialDistrict={district}
        onConfirm={handleMapConfirm}
      />
    </div>
  );
}

export default NewVisit;
