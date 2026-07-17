import { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ClipboardList, Filter, X, PlusCircle, Search, Users, Heart, AlertTriangle, Folder, ChevronDown, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts';
import VisitCard from '../components/VisitCard';
import StatCard from '../components/StatCard';
import { getVisitsByRole } from '../services/storage';
import { PROGRAM_AREAS } from '../utils/constants';
import './MyVisits.css';

const DEFAULT_FILTERS = { programArea: '', dateFrom: '', dateTo: '', search: '' };

/**
 * MyVisits — browse and filter past field visits.
 * Field officers see their own visits; managers see all visits.
 */
function MyVisits() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const isManager = user.role === 'manager';

  const [visits,           setVisits]           = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [showFilterModal,  setShowFilterModal]  = useState(false);
  const [showSentimentModal, setShowSentimentModal] = useState(false);
  const [filters,          setFilters]          = useState(DEFAULT_FILTERS);
  const [isGroupedByOfficer, setIsGroupedByOfficer] = useState(false);
  const [selectedOfficer,  setSelectedOfficer]  = useState(null);

  // Reset officer folder selection when filters change
  useEffect(() => { setSelectedOfficer(null); }, [filters]);

  const loadVisits = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getVisitsByRole(user.role, user.name);
      setVisits(data);
    } catch (err) {
      console.error('[MyVisits] Failed to load visits:', err);
    } finally {
      setLoading(false);
    }
  }, [user.role, user.name]);

  useEffect(() => {
    loadVisits();
    window.addEventListener('sync-completed', loadVisits);
    return () => window.removeEventListener('sync-completed', loadVisits);
  }, [loadVisits]);

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  // ── Derived data ──────────────────────────────────────────────────────────

  const filteredAndSortedVisits = useMemo(() => {
    const searchLower = filters.search.toLowerCase();
    const filtered = visits.filter((visit) => {
      if (filters.programArea && visit.programArea !== filters.programArea) return false;
      if (filters.dateFrom    && visit.date         < filters.dateFrom)     return false;
      if (filters.dateTo      && visit.date         > filters.dateTo)       return false;
      if (searchLower) {
        const hay = [
          visit.notes, visit.state, visit.district,
          visit.block, visit.officerName, visit.programArea,
        ].join(' ').toLowerCase();
        if (!hay.includes(searchLower)) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const tA = new Date(a.createdAt || a.created_at || a.date).getTime();
      const tB = new Date(b.createdAt || b.created_at || b.date).getTime();
      return tB - tA;
    });
  }, [visits, filters]);

  const hasActiveFilters = !!(
    filters.programArea || filters.dateFrom || filters.dateTo || filters.search
  );

  const statsSourceVisits = useMemo(() => {
    if (isGroupedByOfficer && selectedOfficer) {
      return filteredAndSortedVisits.filter(
        (v) => (v.officerName || 'Unknown Officer') === selectedOfficer
      );
    }
    return filteredAndSortedVisits;
  }, [filteredAndSortedVisits, isGroupedByOfficer, selectedOfficer]);

  const totalVisits    = statsSourceVisits.length;

  const uniqueOfficers = useMemo(() => {
    if (isGroupedByOfficer && selectedOfficer) return 1;
    return new Set(filteredAndSortedVisits.map((v) => v.officerName || 'Unknown')).size;
  }, [filteredAndSortedVisits, isGroupedByOfficer, selectedOfficer]);

  const sentimentCounts = useMemo(() => {
    const counts = { positive: 0, mixed: 0, negative: 0 };
    statsSourceVisits.forEach((v) => {
      const s = v.aiSummary?.community_sentiment;
      if (s && s in counts) counts[s]++;
    });
    return counts;
  }, [statsSourceVisits]);

  const summarizedCount = useMemo(
    () => statsSourceVisits.filter((v) => v.aiSummary).length,
    [statsSourceVisits]
  );

  const positivePercent = summarizedCount === 0
    ? 0
    : Math.round((sentimentCounts.positive / summarizedCount) * 100);

  const totalBlockers = useMemo(
    () => statsSourceVisits.reduce((sum, v) => sum + (v.aiSummary?.blockers?.length ?? 0), 0),
    [statsSourceVisits]
  );

  const pieData = useMemo(() => [
    { name: 'Positive', value: sentimentCounts.positive, color: '#10B981' },
    { name: 'Mixed',    value: sentimentCounts.mixed,    color: '#F59E0B' },
    { name: 'Negative', value: sentimentCounts.negative, color: '#EF4444' },
  ].filter((d) => d.value > 0), [sentimentCounts]);

  const visitsByOfficer = useMemo(() => {
    const groups = {};
    filteredAndSortedVisits.forEach((visit) => {
      const name = visit.officerName || 'Unknown Officer';
      if (!groups[name]) groups[name] = [];
      groups[name].push(visit);
    });
    return groups;
  }, [filteredAndSortedVisits]);

  const uniqueOfficersList = useMemo(
    () => Object.keys(visitsByOfficer).sort(),
    [visitsByOfficer]
  );

  const handleOfficersBoxClick = () => {
    setIsGroupedByOfficer((prev) => {
      if (prev) setSelectedOfficer(null);
      return !prev;
    });
  };

  const handleFolderToggle = (officerName) => {
    setSelectedOfficer((prev) => (prev === officerName ? null : officerName));
  };

  const handleDeleteVisit = useCallback((visitId) => {
    if (!visitId) return;
    setVisits((prev) => prev.filter((v) => v.id !== visitId));
  }, []);

  return (
    <div className="my-visits">
      {/* Header */}
      <div className="my-visits-header">
        <div className="my-visits-title">
          <ClipboardList size={24} />
          <h1>{isManager ? 'All Field Visits' : 'My Field Visits'}</h1>
          <span className="my-visits-count badge">{visits.length}</span>
        </div>
        <div className="my-visits-actions">
          <button
            className={`btn btn-secondary btn-filter-trigger${hasActiveFilters ? ' btn-filter-active' : ''}`}
            onClick={() => setShowFilterModal(true)}
            id="filter-modal-btn"
          >
            <Filter size={16} />
            <span className="btn-text">Filters</span>
            {hasActiveFilters && <span className="filter-badge-dot" />}
          </button>
          {!isManager && (
            <button
              className="btn btn-primary"
              onClick={() => navigate('/new-visit')}
              id="new-visit-btn"
            >
              <PlusCircle size={18} />
              <span className="btn-text">New Visit</span>
            </button>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="visits-stats-grid">
        <StatCard icon={ClipboardList} label="Total Visits"       value={totalVisits}    color="#3B82F6" />
        <StatCard
          icon={Users}
          label="Field Officers"
          value={uniqueOfficers}
          color="#10B981"
          onClick={handleOfficersBoxClick}
          clickable
          active={isGroupedByOfficer}
        />
        <StatCard
          icon={Heart}
          label="Positive Sentiment"
          value={`${positivePercent}%`}
          color={positivePercent >= 50 ? '#10B981' : '#F59E0B'}
          onClick={() => setShowSentimentModal(true)}
          clickable
          active={showSentimentModal}
        />
        <StatCard icon={AlertTriangle} label="Blockers Identified" value={totalBlockers} color="#EF4444" />
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="filter-modal-overlay" onClick={() => setShowFilterModal(false)}>
          <div className="filter-modal-content card" onClick={(e) => e.stopPropagation()}>
            <div className="filter-modal-header">
              <h3>Filter Visits</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowFilterModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Search Keyword</label>
              <div className="my-visits-search">
                <Search size={16} className="my-visits-search-icon" />
                <input
                  type="text"
                  className="input my-visits-search-input"
                  placeholder="Search notes, state, district..."
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Program Area</label>
              <select
                className="select"
                value={filters.programArea}
                onChange={(e) => setFilters((f) => ({ ...f, programArea: e.target.value }))}
              >
                <option value="">All Programs</option>
                {PROGRAM_AREAS.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">From Date</label>
                <input type="date" className="input" value={filters.dateFrom}
                  onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">To Date</label>
                <input type="date" className="input" value={filters.dateTo}
                  onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
              </div>
            </div>

            <div className="filter-modal-footer">
              {hasActiveFilters && (
                <button className="btn btn-secondary" onClick={clearFilters}>
                  Clear
                </button>
              )}
              <button className="btn btn-primary" onClick={() => setShowFilterModal(false)}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sentiment Modal */}
      {showSentimentModal && (
        <div className="filter-modal-overlay" onClick={() => setShowSentimentModal(false)}>
          <div className="filter-modal-content card sentiment-modal-card">
            <div className="filter-modal-header">
              <h3>Sentiment Distribution</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowSentimentModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="sentiment-modal-body" style={{ textAlign: 'center' }}>
              {pieData.length > 0 ? (
                <>
                  <div style={{ position: 'relative', height: '200px', marginBottom: 'var(--space-md)' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData} cx="50%" cy="50%"
                          innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="value"
                        >
                          {pieData.map((entry, i) => (
                            <Cell key={`cell-${i}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltip
                          contentStyle={{
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md, 8px)',
                            color: 'var(--color-text)',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translateY(-50%) translateX(-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                      <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)' }}>{positivePercent}%</span>
                      <br />
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Positive</span>
                    </div>
                  </div>

                  <div className="sentiment-legend" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)' }}>
                    {pieData.map((d) => {
                      const total   = pieData.reduce((s, x) => s + x.value, 0);
                      const percent = total > 0 ? Math.round((d.value / total) * 100) : 0;
                      return (
                        <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: d.color, display: 'inline-block' }} />
                            <span style={{ color: 'var(--color-text-secondary)' }}>{d.name}</span>
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                            {d.value} {d.value === 1 ? 'report' : 'reports'} ({percent}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ padding: 'var(--space-xl) 0', color: 'var(--color-text-muted)' }}>
                  <Heart size={36} style={{ opacity: 0.3, marginBottom: 'var(--space-sm)', color: 'var(--color-sentiment-positive)' }} />
                  <p style={{ fontSize: '0.9rem' }}>No AI summaries available to analyze sentiment.</p>
                </div>
              )}
            </div>

            <div style={{ marginTop: 'var(--space-lg)' }}>
              <button className="btn btn-primary" onClick={() => setShowSentimentModal(false)} style={{ width: '100%' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result count */}
      {hasActiveFilters && (
        <p className="my-visits-result-count">
          {`Showing ${filteredAndSortedVisits.length} of ${visits.length} visits`}
        </p>
      )}

      {/* Visit list */}
      {loading ? (
        <div className="my-visits-skeleton">
          {[1, 2, 3].map((i) => (
            <div key={i} className="my-visits-skeleton-card card">
              <div className="skeleton-line skeleton-line-short" />
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-line-medium" />
            </div>
          ))}
        </div>
      ) : filteredAndSortedVisits.length > 0 ? (
        isGroupedByOfficer ? (
          <div className="officer-folders-list">
            {uniqueOfficersList.map((officerName) => {
              const officerVisits = visitsByOfficer[officerName];
              const isOpen        = selectedOfficer === officerName;
              return (
                <div key={officerName} className={`officer-folder${isOpen ? ' officer-folder--open' : ''}`}>
                  <button
                    className="officer-folder-header card"
                    onClick={() => handleFolderToggle(officerName)}
                  >
                    <div className="officer-folder-info">
                      <Folder className="officer-folder-icon" size={20} />
                      <span className="officer-folder-name">{officerName}</span>
                      <span className="officer-folder-count badge">
                        {officerVisits.length} {officerVisits.length === 1 ? 'visit' : 'visits'}
                      </span>
                    </div>
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                  {isOpen && (
                    <div className="officer-folder-content">
                      {officerVisits.map((visit) => (
                        <VisitCard key={visit.id} visit={visit} onDelete={handleDeleteVisit} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="my-visits-list">
            {filteredAndSortedVisits.map((visit) => (
              <VisitCard key={visit.id} visit={visit} onDelete={handleDeleteVisit} />
            ))}
          </div>
        )
      ) : (
        <div className="my-visits-empty card">
          <ClipboardList size={48} className="my-visits-empty-icon" />
          <h3>{hasActiveFilters ? 'No visits match your filters' : 'No field visits logged yet'}</h3>
          <p>
            {hasActiveFilters
              ? 'Try adjusting your filters or clearing them.'
              : 'Start by logging your first field visit to capture ground-level insights.'}
          </p>
          {!hasActiveFilters && !isManager && (
            <button className="btn btn-primary" onClick={() => navigate('/new-visit')}>
              <PlusCircle size={18} />
              Log Your First Visit
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default MyVisits;
