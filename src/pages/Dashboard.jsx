import { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Users, Heart,
  AlertTriangle, Filter, RefreshCw, Sparkles,
  TrendingUp, TrendingDown, Loader2, X
} from 'lucide-react';
import VisitCard from '../components/VisitCard';
import PatternCard from '../components/PatternCard';
import StatCard from '../components/StatCard';
import { getVisits } from '../services/storage';
import { analyzePatterns } from '../services/ai';
import { PROGRAM_AREAS, getStates, getDistricts } from '../utils/constants';
import { getRelativeTime } from '../utils/helpers';
import './Dashboard.css';

const DEFAULT_FILTERS = {
  programArea: '',
  state: '',
  district: '',
  dateFrom: '',
  dateTo: '',
};

/**
 * Dashboard — manager view showing macro-level field intelligence.
 */
function Dashboard() {
  const { user } = useOutletContext();
  const [allVisits, setAllVisits] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const [filters, setFilters] = useState(() => {
    try {
      const cached = sessionStorage.getItem('dashboardFilters');
      return cached ? JSON.parse(cached) : DEFAULT_FILTERS;
    } catch {
      return DEFAULT_FILTERS;
    }
  });

  const [patterns, setPatterns] = useState(() => {
    try {
      const cached = sessionStorage.getItem('dashboardPatterns');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [patternsTimestamp, setPatternsTimestamp] = useState(() => {
    return sessionStorage.getItem('dashboardPatternsTimestamp') || null;
  });

  const [timeTick, setTimeTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeTick((t) => t + 1);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const [loadingPatterns, setLoadingPatterns] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

  // ── Derived data (Declared early to prevent ReferenceErrors in hooks) ─────

  const filteredVisits = useMemo(() => {
    return allVisits.filter((visit) => {
      if (filters.programArea && visit.programArea !== filters.programArea) return false;
      if (filters.state      && visit.state       !== filters.state)       return false;
      if (filters.district   && visit.district    !== filters.district)    return false;
      if (filters.dateFrom   && visit.date        <  filters.dateFrom)     return false;
      if (filters.dateTo     && visit.date        >  filters.dateTo)       return false;
      return true;
    });
  }, [allVisits, filters]);

  const summarizedVisits = useMemo(
    () => filteredVisits.filter((v) => v.aiSummary),
    [filteredVisits]
  );

  const totalVisits    = filteredVisits.length;
  const recentVisits   = filteredVisits.slice(0, 3);

  const uniqueOfficers = useMemo(
    () => new Set(filteredVisits.map((v) => v.officerName || 'Unknown')).size,
    [filteredVisits]
  );

  const sentimentCounts = useMemo(() => {
    const counts = { positive: 0, mixed: 0, negative: 0 };
    filteredVisits.forEach((v) => {
      const s = v.aiSummary?.community_sentiment;
      if (s && s in counts) counts[s]++;
    });
    return counts;
  }, [filteredVisits]);

  const positivePercent = useMemo(() => {
    const total = summarizedVisits.length;
    return total === 0 ? 0 : Math.round((sentimentCounts.positive / total) * 100);
  }, [sentimentCounts, summarizedVisits.length]);

  const totalBlockers = useMemo(
    () => filteredVisits.reduce((sum, v) => sum + (v.aiSummary?.blockers?.length ?? 0), 0),
    [filteredVisits]
  );

  const hasActiveFilters = !!(
    filters.programArea || filters.state || filters.district ||
    filters.dateFrom    || filters.dateTo
  );

  // ── Effects & Callbacks ──────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const visits = await getVisits();
      setAllVisits(visits);
    } catch (err) {
      console.error('[Dashboard] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    window.addEventListener('sync-completed', loadData);
    return () => window.removeEventListener('sync-completed', loadData);
  }, [loadData]);

  // Helper to generate a unique string signature/hash of the current visits list
  const getVisitsHash = useCallback((visits) => {
    return visits.map((v) => `${v.id}:${v.createdAt || v.created_at || v.date}`).join(',');
  }, []);

  // Persist filters and invalidate cached patterns when filters change
  useEffect(() => {
    sessionStorage.setItem('dashboardFilters', JSON.stringify(filters));

    // Check filters match
    const cachedFiltersRaw = sessionStorage.getItem('dashboardPatternsFilters');

    let match = true;
    if (cachedFiltersRaw) {
      try {
        const cachedFilters = JSON.parse(cachedFiltersRaw);
        match = Object.keys(DEFAULT_FILTERS).every(
          (k) => cachedFilters[k] === filters[k]
        );
      } catch {
        match = false;
      }
    } else {
      match = false;
    }

    // Invalidate if filters don't match
    if (!match) {
      setPatterns(null);
      setPatternsTimestamp(null);
      sessionStorage.removeItem('dashboardPatterns');
      sessionStorage.removeItem('dashboardPatternsFilters');
      sessionStorage.removeItem('dashboardPatternsVisitsHash');
      sessionStorage.removeItem('dashboardPatternsTimestamp');
    }
  }, [filters]);

  const handleRefresh = useCallback(async () => {
    setFilters(DEFAULT_FILTERS);
    await loadData();
  }, [loadData]);

  const loadPatterns = async (visitsToAnalyze) => {
    setLoadingPatterns(true);
    try {
      const data = await analyzePatterns(visitsToAnalyze);
      setPatterns(data);
      const timestamp = new Date().toISOString();
      setPatternsTimestamp(timestamp);
      if (data) {
        sessionStorage.setItem('dashboardPatterns', JSON.stringify(data));
        sessionStorage.setItem('dashboardPatternsFilters', JSON.stringify(filters));
        sessionStorage.setItem('dashboardPatternsVisitsHash', getVisitsHash(visitsToAnalyze));
        sessionStorage.setItem('dashboardPatternsTimestamp', timestamp);
      }
    } catch (err) {
      console.error('[Dashboard] Pattern analysis failed:', err);
    } finally {
      setLoadingPatterns(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-loading">
          <div className="loading-pulse" />
          <p>Loading field intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-title">
          <LayoutDashboard size={26} />
          <h1>Field Intelligence Dashboard</h1>
        </div>
        <div className="dashboard-header-actions">
          <button
            className={`btn btn-secondary btn-filter-trigger${hasActiveFilters ? ' btn-filter-active' : ''}`}
            onClick={() => setShowFilterModal(true)}
          >
            <Filter size={16} />
            <span className="btn-text">Filter</span>
            {hasActiveFilters && <span className="filter-badge-dot" />}
          </button>
          <button className="btn btn-ghost" onClick={handleRefresh}>
            <RefreshCw size={16} />
            <span className="btn-text">Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="filter-modal-overlay" onClick={() => setShowFilterModal(false)}>
          <div className="filter-modal-content card" onClick={(e) => e.stopPropagation()}>
            <div className="filter-modal-header">
              <h3>Filter Field Reports</h3>
              <button className="btn-close" onClick={() => setShowFilterModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="filter-modal-body">
              <div className="form-group">
                <label className="form-label">Program Area</label>
                <select
                  className="select"
                  value={filters.programArea}
                  onChange={(e) => setFilters((f) => ({ ...f, programArea: e.target.value }))}
                >
                  <option value="">All Programs</option>
                  {PROGRAM_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <select
                  className="select"
                  value={filters.state}
                  onChange={(e) => setFilters((f) => ({ ...f, state: e.target.value, district: '' }))}
                >
                  <option value="">All States</option>
                  {getStates().map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">District</label>
                <select
                  className="select"
                  value={filters.district}
                  onChange={(e) => setFilters((f) => ({ ...f, district: e.target.value }))}
                  disabled={!filters.state}
                >
                  <option value="">{filters.state ? 'All Districts' : 'Select state first'}</option>
                  {filters.state && getDistricts(filters.state).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">From Date</label>
                  <input
                    type="date" className="input" value={filters.dateFrom}
                    onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">To Date</label>
                  <input
                    type="date" className="input" value={filters.dateTo}
                    onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="filter-modal-footer">
              {hasActiveFilters && (
                <button className="btn btn-ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>
                  Clear All
                </button>
              )}
              <button className="btn btn-primary" onClick={() => setShowFilterModal(false)}>
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {totalVisits === 0 ? (
        <div className="dashboard-empty card">
          <LayoutDashboard size={48} className="dashboard-empty-icon" />
          <h3>No field visit data yet</h3>
          <p>
            Visit data will appear here once field officers start logging their visits.
          </p>
        </div>
      ) : (
        <div className="dashboard-content">
          {/* Stats */}
          <div className="dashboard-stats-grid" style={{ marginBottom: 'var(--space-md)' }}>
            <StatCard icon={ClipboardList} label="Total Visits"       value={totalVisits}          color="#3B82F6" />
            <StatCard icon={Users}         label="Active Officers"    value={uniqueOfficers}        color="#10B981" />
            <StatCard
              icon={Heart}
              label="Positive Sentiment"
              value={`${positivePercent}%`}
              color={positivePercent >= 50 ? '#10B981' : '#F59E0B'}
            />
            <StatCard icon={AlertTriangle} label="Open Blockers"      value={totalBlockers}         color="#EF4444" />
          </div>

          {/* Executive Synthesis */}
          <div className="synthesis-card card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} style={{ color: 'var(--color-warning)' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Executive Synthesis</span>
              </div>
              {patterns && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  {patternsTimestamp && <span>{`Generated ${getRelativeTime(patternsTimestamp)}`}</span>}
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={() => loadPatterns(summarizedVisits)}
                    disabled={loadingPatterns || summarizedVisits.length === 0}
                    title="Regenerate Insights"
                    style={{ padding: 0, width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 'auto' }}
                  >
                    <RefreshCw size={12} className={loadingPatterns ? 'animate-spin' : ''} />
                  </button>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)' }}>
              <p className="synthesis-text" style={{ margin: 0, fontSize: '0.92rem', fontStyle: 'italic', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                {loadingPatterns ? (
                  <span className="loading-dots">Synthesizing field intelligence...</span>
                ) : patterns?.synthesis ? (
                  patterns.synthesis
                ) : (
                  'Click "Analyze Patterns" in the Program Insights section to generate executive intelligence synthesis.'
                )}
              </p>
            </div>
          </div>

          {/* Priority Actions */}
          {patterns?.priority_actions?.length > 0 && (
            <div className="dashboard-section" style={{ marginBottom: 'var(--space-md)' }}>
              <div className="ai-priority-actions card">
                <h4 className="ai-insights-block-title">Priority Management Actions</h4>
                <ul className="priority-actions-list">
                  {patterns.priority_actions.slice(0, 3).map((action, i) => (
                    <li key={i} className="priority-action-item">
                      <span className="priority-action-bullet">{i + 1}</span>
                      <p>{action}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Program Trends */}
          <div className="dashboard-section" style={{ marginBottom: 'var(--space-md)' }}>
            {loadingPatterns ? (
              <div className="ai-patterns-loading card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '220px' }}>
                <Loader2 size={24} className="spin" />
                <p style={{ margin: 0, marginTop: '8px' }}>Analyzing field visit patterns...</p>
              </div>
            ) : patterns ? (
              <div className="ai-pattern-block card" style={{ display: 'flex', flexDirection: 'column', padding: 'var(--space-lg)' }}>
                <h4 className="ai-insights-block-title" style={{ marginBottom: 'var(--space-md)' }}>Program Trends</h4>
                <div className="ai-pattern-cards-grid">
                  {patterns.program_trends?.length > 0 ? (
                    patterns.program_trends.map((p, i) => {
                      const isNegative = p.sentiment === 'negative';
                      return (
                        <PatternCard
                          key={i}
                          icon={isNegative ? TrendingDown : TrendingUp}
                          title={p.program}
                          description={p.trend}
                          severity={isNegative ? 'danger' : 'success'}
                        />
                      );
                    })
                  ) : (
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                      No program trends detected.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="ai-patterns-generate card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', minHeight: '220px', gap: '12px' }}>
                <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-muted)' }}>
                  Generate AI-powered insights across all visits.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => loadPatterns(summarizedVisits)}
                  disabled={summarizedVisits.length === 0}
                >
                  <Sparkles size={16} />
                  Analyze Patterns
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
