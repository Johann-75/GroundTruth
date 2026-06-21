import { useState, useMemo, useEffect } from 'react';
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
import './NewVisit.css';


/**
 * NewVisit — the hero page of the app.
 * A lightweight, mobile-first multi-section form for field officers to
 * log a visit and generate an AI-powered debrief.
 */
function NewVisit() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const { id } = useParams();
  
  // ── Form State ─────────────────────────────────────────────
  const [date, setDate] = useState(getTodayISO());
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [block, setBlock] = useState('');
  const [programArea, setProgramArea] = useState('');
  const [customProgramArea, setCustomProgramArea] = useState('');
  const [stakeholders, setStakeholders] = useState([]);
  const [customStakeholder, setCustomStakeholder] = useState('');
  const [customStakeholders, setCustomStakeholders] = useState([]);
  const [notes, setNotes] = useState('');

  // ── UI State ───────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [loadingVisit, setLoadingVisit] = useState(!!id);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!id) return;

    const fetchVisit = async () => {
      setLoadingVisit(true);
      try {
        const visitData = await getVisitById(id);
        if (visitData) {
          setDate(visitData.date);
          setState(visitData.state);
          setDistrict(visitData.district);
          setBlock(visitData.block || '');
          
          if (PROGRAM_AREAS.includes(visitData.programArea)) {
            setProgramArea(visitData.programArea);
          } else {
            setProgramArea('Other');
            setCustomProgramArea(visitData.programArea);
          }
          
          const standardStakeholders = [];
          const loadedCustomStakeholders = [];
          visitData.stakeholders?.forEach((sh) => {
            if (STAKEHOLDER_TYPES.includes(sh)) {
              standardStakeholders.push(sh);
            } else {
              loadedCustomStakeholders.push(sh);
            }
          });
          if (loadedCustomStakeholders.length > 0 && !standardStakeholders.includes('Other')) {
            standardStakeholders.push('Other');
          }
          setStakeholders(standardStakeholders);
          setCustomStakeholders(loadedCustomStakeholders);
          setCustomStakeholder('');
          
          setNotes(visitData.notes || '');
        } else {
          console.error('Visit not found for editing:', id);
          navigate('/my-visits', { replace: true });
        }
      } catch (err) {
        console.error('Failed to load visit for editing:', err);
        navigate('/my-visits', { replace: true });
      } finally {
        setLoadingVisit(false);
      }
    };

    fetchVisit();
  }, [id, navigate]);

  // ── Derived Location Options ───────────────────────────────
  const states = useMemo(() => getStates(), []);
  const districts = useMemo(() => getDistricts(state), [state]);

  // ── Progress Tracking ──────────────────────────────────────
  const section1Filled = !!(
    date &&
    state &&
    district &&
    (programArea === 'Other' ? customProgramArea.trim() : programArea)
  );
  const section2Filled = notes.trim().length > 0;

  /**
   * Add custom stakeholder when pressing Enter.
   */
  const handleCustomStakeholderKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = customStakeholder.trim();
      if (val && !customStakeholders.includes(val) && !STAKEHOLDER_TYPES.includes(val)) {
        setCustomStakeholders((prev) => [...prev, val]);
        setCustomStakeholder('');
      }
    }
  };

  /**
   * Toggle a stakeholder type in the selected list.
   * @param {string} type - stakeholder type to toggle
   */
  const toggleStakeholder = (type) => {
    setStakeholders((prev) =>
      prev.includes(type)
        ? prev.filter((s) => s !== type)
        : [...prev, type]
    );
  };

  /**
   * Handle cascading state → district → block resets.
   * @param {string} newState - the newly selected state
   */
  const handleStateChange = (newState) => {
    setState(newState);
    setDistrict('');
    setBlock('');
  };

  /**
   * Handle cascading district → block reset.
   * @param {string} newDistrict - the newly selected district
   */
  const handleDistrictChange = (newDistrict) => {
    setDistrict(newDistrict);
    setBlock('');
  };

  /**
   * Append transcribed text from voice recorder to notes.
   * @param {string} text - transcribed text
   */
  const handleTranscription = (text) => {
    setNotes((prev) => {
      if (prev.trim().length === 0) return text;
      return prev + '\n\n' + text;
    });
  };



  /**
   * Validate form fields and return an errors object.
   * @returns {object} errors — keys map to field names
   */
  const validate = () => {
    const newErrors = {};
    if (!date) newErrors.date = 'Date is required';
    if (!state) newErrors.state = 'State is required';
    if (!district) newErrors.district = 'District is required';
    if (!programArea) {
      newErrors.programArea = 'Program area is required';
    } else if (programArea === 'Other' && !customProgramArea.trim()) {
      newErrors.programArea = 'Please enter custom program area';
    }
    if (stakeholders.includes('Other') && customStakeholders.length === 0 && !customStakeholder.trim()) {
      newErrors.stakeholders = 'Please enter custom stakeholder name';
    }
    if (!notes.trim()) newErrors.notes = 'Please add some observations';
    return newErrors;
  };

  /**
   * Handle form submission — save data, generate AI debrief, navigate.
   */
  const handleSubmit = async () => {
    // 1. Validate
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Scroll to the first error section
      const firstErrorKey = Object.keys(validationErrors)[0];
      const el = document.getElementById(`field-${firstErrorKey}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const finalProgramArea = programArea === 'Other' ? customProgramArea.trim() : programArea;

      // Combine standard and custom stakeholders
      let finalStakeholders = stakeholders.filter((s) => s !== 'Other');
      
      customStakeholders.forEach((sh) => {
        if (!finalStakeholders.includes(sh)) {
          finalStakeholders.push(sh);
        }
      });

      if (stakeholders.includes('Other') && customStakeholder.trim()) {
        const val = customStakeholder.trim();
        if (!finalStakeholders.includes(val)) {
          finalStakeholders.push(val);
        }
      }

      // 2. Build the visit object
      const visitData = {
        date,
        state,
        district,
        block,
        programArea: finalProgramArea,
        stakeholders: finalStakeholders,
        notes,
        voiceTranscription: null,
        aiSummary: null,
        officerName: user?.name || '',
      };

      let savedVisit;
      if (id) {
        const originalVisit = await getVisitById(id);
        const updatedVisitData = {
          ...originalVisit,
          ...visitData,
          officerName: originalVisit?.officerName || user?.name || '',
          createdAt: originalVisit?.createdAt || new Date().toISOString()
        };
        savedVisit = await updateVisit(id, updatedVisitData);
      } else {
        savedVisit = await saveVisit(visitData);
      }

      // 5. Try AI debrief generation (only when online)
      if (navigator.onLine) {
        try {
          const aiResult = await generateFieldDebrief(visitData);
          if (aiResult) {
            await updateVisit(savedVisit.id, { aiSummary: aiResult });
          }
        } catch (aiError) {
          // AI failed — that's fine, the visit is already saved
          console.warn('[NewVisit] AI summary generation failed:', aiError);
        }
      } else {
        console.log('[NewVisit] Device is offline. Deferring AI summary generation until sync.');
      }

      // Try background sync (non-blocking)
      syncPendingVisits().catch((err) => console.error('[NewVisit] Background sync trigger failed:', err));

      // 6. Navigate to the visit detail page
      navigate(`/visit/${savedVisit.id}`);
    } catch (err) {
      console.error('[NewVisit] Submit failed:', err);
      setSubmitting(false);
    }
  };


  if (loadingVisit) {
    return (
      <div className="new-visit-page">
        <div className="visit-detail-loading" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', gap: 'var(--space-md)' }}>
          <div className="loading-pulse" />
          <p>{'Loading visit data for editing...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="new-visit-page">
      {/* ── Loading Overlay ──────────────────────────────────── */}
      {submitting && (
        <div className="submit-overlay">
          <div className="submit-overlay-content">
            <Sparkles size={40} className="submit-overlay-icon" />
            <div className="submit-spinner" />
            <p className="submit-overlay-text">
              {id ? 'Updating and analyzing observations...' : 'Analyzing your field observations...'}
            </p>
            <p className="submit-overlay-subtext">
              {'Generating AI-powered debrief summary'}
            </p>
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────── */}
      <header className="new-visit-header">
        <h1 className="new-visit-header-title">
          <MapPin size={24} />
          {id ? 'Edit Field Visit' : 'Log Field Visit'}
        </h1>
        <p className="new-visit-header-subtitle">
          {id ? 'Modify your observations and regenerate the AI debrief.' : 'Record your observations and let AI create a structured debrief.'}
        </p>
      </header>

      {/* ── Progress Indicator ───────────────────────────────── */}
      <div className="form-progress">
        <div className="form-progress-step">
          <div
            className={`form-progress-dot ${section1Filled ? 'completed' : 'active'}`}
          >
            {section1Filled ? <CheckCircle size={16} /> : '1'}
          </div>
          <span
            className={`form-progress-label ${section1Filled ? 'completed' : 'active'}`}
          >
            {'Details'}
          </span>
        </div>
        <div
          className={`form-progress-connector ${section1Filled ? 'completed' : ''}`}
        />
        <div className="form-progress-step">
          <div
            className={`form-progress-dot ${
              section2Filled ? 'completed' : section1Filled ? 'active' : ''
            }`}
          >
            {section2Filled ? <CheckCircle size={16} /> : '2'}
          </div>
          <span
            className={`form-progress-label ${
              section2Filled ? 'completed' : section1Filled ? 'active' : ''
            }`}
          >
            {'Observations'}
          </span>
        </div>
        <div
          className={`form-progress-connector ${section2Filled ? 'completed' : ''}`}
        />
        <div className="form-progress-step">
          <div
            className={`form-progress-dot ${
              section1Filled && section2Filled ? 'active' : ''
            }`}
          >
            3
          </div>
          <span
            className={`form-progress-label ${
              section1Filled && section2Filled ? 'active' : ''
            }`}
          >
            {'Submit'}
          </span>
        </div>
      </div>

      {/* ── Section 1: Visit Details ─────────────────────────── */}
      <section className="form-section" id="section-details">
        <div className="form-section-header">
          <div className="form-section-number">1</div>
          <h2 className="form-section-title">
            <MapPin /> {'Visit Details'}
          </h2>
        </div>

        {/* Date + Program Area */}
        <div className="form-row">
          <div className="form-group" id="field-date">
            <label className="form-label form-label-required" htmlFor="visit-date">
              {'Date'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="visit-date"
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            {errors.date && (
              <div className="form-error">
                <AlertCircle /> {errors.date}
              </div>
            )}
          </div>

          <div className="form-group" id="field-programArea">
            <label className="form-label form-label-required" htmlFor="visit-program-area">
              {'Program Area'}
            </label>
            <select
              id="visit-program-area"
              className="select"
              value={programArea}
              onChange={(e) => {
                setProgramArea(e.target.value);
                if (e.target.value !== 'Other') {
                  setCustomProgramArea('');
                }
              }}
            >
              <option value="">{'Select program area'}</option>
              {PROGRAM_AREAS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
              <option value="Other">{'Other (Custom)'}</option>
            </select>
            {programArea === 'Other' && (
              <div style={{ marginTop: '10px' }}>
                <input
                  type="text"
                  className="input"
                  placeholder={'Enter custom program area'}
                  value={customProgramArea}
                  onChange={(e) => setCustomProgramArea(e.target.value)}
                  id="visit-custom-program-area"
                  autoFocus
                />
              </div>
            )}
            {errors.programArea && (
              <div className="form-error">
                <AlertCircle /> {errors.programArea}
              </div>
            )}
          </div>
        </div>

        {/* State + District */}
        <div className="form-row">
          <div className="form-group" id="field-state">
            <label className="form-label form-label-required" htmlFor="visit-state">
              {'State'}
            </label>
            <select
              id="visit-state"
              className="select"
              value={state}
              onChange={(e) => handleStateChange(e.target.value)}
            >
              <option value="">{'Select state'}</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {errors.state && (
              <div className="form-error">
                <AlertCircle /> {errors.state}
              </div>
            )}
          </div>

          <div className="form-group" id="field-district">
            <label className="form-label form-label-required" htmlFor="visit-district">
              {'District'}
            </label>
            <select
              id="visit-district"
              className="select"
              value={district}
              onChange={(e) => handleDistrictChange(e.target.value)}
              disabled={!state}
            >
              <option value="">
                {state ? 'Select district' : 'Select state first'}
              </option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {errors.district && (
              <div className="form-error">
                <AlertCircle /> {errors.district}
              </div>
            )}
          </div>
        </div>

        {/* Block / Village */}
        <div className="form-group" id="field-block">
          <label className="form-label" htmlFor="visit-block">
            {'Block / Village'}
          </label>
          <input
            id="visit-block"
            type="text"
            className="input"
            placeholder={district ? 'Enter block or village name' : 'Select district first'}
            value={block}
            onChange={(e) => setBlock(e.target.value)}
            disabled={!district}
          />
        </div>

        {/* Stakeholders Met */}
        <div className="form-group" id="field-stakeholders">
          <label className="form-label">
            <Users
              size={14}
              style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}
            />
            {'Stakeholders Met'}
          </label>
          <div className="stakeholder-tags">
            {STAKEHOLDER_TYPES.filter(type => type !== 'Other').map((type) => (
              <button
                key={type}
                type="button"
                id={`stakeholder-${type.replace(/[\s/]/g, '-').toLowerCase()}`}
                className={`stakeholder-tag ${
                  stakeholders.includes(type) ? 'selected' : ''
                }`}
                onClick={() => toggleStakeholder(type)}
              >
                {type}
              </button>
            ))}

            {customStakeholders.map((sh) => (
              <button
                key={sh}
                type="button"
                className="stakeholder-tag selected stakeholder-custom-tag"
                onClick={() => {
                  setCustomStakeholders(prev => prev.filter(item => item !== sh));
                }}
                title="Click to remove"
              >
                {sh} <span className="remove-tag-x">&times;</span>
              </button>
            ))}

            <button
              type="button"
              id="stakeholder-other"
              className={`stakeholder-tag ${
                stakeholders.includes('Other') ? 'selected' : ''
              }`}
              onClick={() => {
                toggleStakeholder('Other');
                if (!stakeholders.includes('Other')) {
                  setCustomStakeholder('');
                }
              }}
            >
              Other
            </button>
          </div>

          {stakeholders.includes('Other') && (
            <div className="stakeholder-custom-input-container" style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                className="input stakeholder-custom-input"
                placeholder={'Type name & press Enter to add'}
                value={customStakeholder}
                onChange={(e) => setCustomStakeholder(e.target.value)}
                onKeyDown={handleCustomStakeholderKeyDown}
                style={{ maxWidth: '300px', fontSize: '0.875rem' }}
                id="visit-custom-stakeholder"
                autoFocus
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: '42px', padding: '0 16px', fontSize: '0.875rem' }}
                onClick={() => {
                  const val = customStakeholder.trim();
                  if (val && !customStakeholders.includes(val) && !STAKEHOLDER_TYPES.includes(val)) {
                    setCustomStakeholders(prev => [...prev, val]);
                    setCustomStakeholder('');
                  }
                }}
              >
                Add
              </button>
            </div>
          )}
          {errors.stakeholders && (
            <div className="form-error">
              <AlertCircle /> {errors.stakeholders}
            </div>
          )}
        </div>
      </section>

      {/* ── Section 2: Observations ──────────────────────────── */}
      <section className="form-section" id="section-observations">
        <div className="form-section-header">
          <div className="form-section-number">2</div>
          <h2 className="form-section-title">
            <FileText /> {'Observations'}
          </h2>
        </div>

        {/* Notes textarea */}
        <div className="form-group" id="field-notes">
          <label className="form-label form-label-required" htmlFor="visit-notes">
            {'Field Notes'}
          </label>
          <textarea
            id="visit-notes"
            className="textarea observations-textarea"
            placeholder={'What did you observe? What went well? Any issues? What did community members say?'}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {errors.notes && (
            <div className="form-error">
              <AlertCircle /> {errors.notes}
            </div>
          )}
        </div>

        {/* Voice Recorder */}
        <div className="media-row">
          <VoiceRecorder
            onTranscription={handleTranscription}
          />
        </div>
      </section>

      {/* ── Sticky Submit Bar ────────────────────────────────── */}
      <div className="submit-section">
        <div className="submit-section-inner">
          <button
            id="submit-visit-btn"
            className="submit-btn"
            onClick={handleSubmit}
            disabled={submitting}
          >
            <Sparkles />
            {id ? 'Update & Regenerate AI Debrief' : 'Generate AI Debrief'}
          </button>
          <p className="submit-hint">
            {'Your visit will be saved and analyzed by AI'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default NewVisit;
