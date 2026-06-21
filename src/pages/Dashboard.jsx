import { useState, useEffect, useMemo, useRef } from 'react';
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
import './Dashboard.css';


/**
 * Dashboard page — Manager view showing macro-level patterns.
 * Uses AI text summaries for "Big Picture" pattern spotting.
 */

const SENTIMENT_COLORS = {
  positive: '#10B981',
  mixed: '#F59E0B',
  negative: '#EF4444',
};

function Dashboard() {
  const { user } = useOutletContext();
  const [allVisits, setAllVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [filters, setFilters] = useState(() => {
    const cached = sessionStorage.getItem('dashboardFilters');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // fallback
      }
    }
    return {
      programArea: '',
      state: '',
      district: '',
      dateFrom: '',
      dateTo: '',
    };
  });

  const [patterns, setPatterns] = useState(() => {
    const cached = sessionStorage.getItem('dashboardPatterns');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [loadingPatterns, setLoadingPatterns] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

  useEffect(() => {
    loadData();

    // Listen to background sync completions
    const handleSyncComplete = () => {
      console.log('[Dashboard] Sync completed event received, reloading data...');
      loadData();
    };

    window.addEventListener('sync-completed', handleSyncComplete);

    return () => {
      window.removeEventListener('sync-completed', handleSyncComplete);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const visits = await getVisits();
      setAllVisits(visits);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setFilters({
      programArea: '',
      state: '',
      district: '',
      dateFrom: '',
      dateTo: '',
    });
    await loadData();
  };

  const loadPatterns = async (visitsToAnalyze) => {
    setLoadingPatterns(true);
    try {
      const data = await analyzePatterns(visitsToAnalyze);
      setPatterns(data);
      if (data) {
        sessionStorage.setItem('dashboardPatterns', JSON.stringify(data));
        sessionStorage.setItem('dashboardPatternsFilters', JSON.stringify(filters));
      }
    } catch (err) {
      console.error('Failed to analyze patterns:', err);
    } finally {
      setLoadingPatterns(false);
    }
  };

  // Whenever the filters change, reset AI patterns so the user has to click "Analyze Patterns" for the new view
  useEffect(() => {
    sessionStorage.setItem('dashboardFilters', JSON.stringify(filters));

    const cachedPatternsFilters = sessionStorage.getItem('dashboardPatternsFilters');
    if (cachedPatternsFilters) {
      try {
        const pFilters = JSON.parse(cachedPatternsFilters);
        const match = 
          pFilters.state === filters.state &&
          pFilters.district === filters.district &&
          pFilters.programArea === filters.programArea &&
          pFilters.dateFrom === filters.dateFrom &&
          pFilters.dateTo === filters.dateTo;
        
        if (!match) {
          setPatterns(null);
          sessionStorage.removeItem('dashboardPatterns');
          sessionStorage.removeItem('dashboardPatternsFilters');
        }
      } catch (e) {
        setPatterns(null);
        sessionStorage.removeItem('dashboardPatterns');
        sessionStorage.removeItem('dashboardPatternsFilters');
      }
    } else if (patterns) {
      setPatterns(null);
      sessionStorage.removeItem('dashboardPatterns');
    }
  }, [filters.state, filters.district, filters.programArea, filters.dateFrom, filters.dateTo]);

  // Apply filters
  const filteredVisits = useMemo(() => {
    return allVisits.filter((visit) => {
      if (filters.programArea && visit.programArea !== filters.programArea) return false;
      if (filters.state && visit.state !== filters.state) return false;
      if (filters.district && visit.district !== filters.district) return false;
      if (filters.dateFrom && visit.date < filters.dateFrom) return false;
      if (filters.dateTo && visit.date > filters.dateTo) return false;
      return true;
    });
  }, [allVisits, filters]);

  // Visits with AI summaries
  const summarizedVisits = useMemo(() =>
    filteredVisits.filter((v) => v.aiSummary),
    [filteredVisits]
  );

  // ──────────────── STATS CALCULATIONS ────────────────
  const totalVisits = filteredVisits.length;

  const uniqueOfficers = useMemo(() => {
    return new Set(filteredVisits.map((v) => v.officerName || 'Unknown')).size;
  }, [filteredVisits]);

  const sentimentCounts = useMemo(() => {
    const counts = { positive: 0, mixed: 0, negative: 0 };
    filteredVisits.forEach((v) => {
      const s = v.aiSummary?.community_sentiment;
      if (s && counts.hasOwnProperty(s)) counts[s]++;
    });
    return counts;
  }, [filteredVisits]);

  const summarizedVisitsCount = useMemo(() => 
    filteredVisits.filter((v) => v.aiSummary).length,
    [filteredVisits]
  );

  const positivePercent = useMemo(() => {
    if (summarizedVisitsCount === 0) return 0;
    return Math.round((sentimentCounts.positive / summarizedVisitsCount) * 100);
  }, [sentimentCounts, summarizedVisitsCount]);

  const totalBlockers = useMemo(() => {
    return filteredVisits.reduce((sum, v) => sum + (v.aiSummary?.blockers?.length || 0), 0);
  }, [filteredVisits]);

  // Recent visits (last 3 as requested)

  // Recent visits (last 3 as requested)
  const recentVisits = filteredVisits.slice(0, 3);

  const hasActiveFilters = filters.programArea || filters.state || filters.dateFrom || filters.dateTo;

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-loading">
          <div className="loading-pulse" />
          <p>{'Loading field intelligence...'}</p>
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
          <h1>{'Field Intelligence Dashboard'}</h1>
        </div>
        <div className="dashboard-header-actions">
          <button
            className={`btn btn-secondary btn-filter-trigger ${hasActiveFilters ? 'btn-filter-active' : ''}`}
            onClick={() => setShowFilterModal(true)}
          >
            <Filter size={16} />
            <span className="btn-text">{'Filter'}</span>
            {hasActiveFilters && <span className="filter-badge-dot" />}
          </button>
          <button className="btn btn-ghost" onClick={handleRefresh}>
            <RefreshCw size={16} />
            <span className="btn-text">{'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Filter Modal Pop-up */}
      {showFilterModal && (
        <div className="filter-modal-overlay" onClick={() => setShowFilterModal(false)}>
          <div className="filter-modal-content card" onClick={(e) => e.stopPropagation()}>
            <div className="filter-modal-header">
              <h3>{'Filter Field Reports'}</h3>
              <button className="btn-close" onClick={() => setShowFilterModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="filter-modal-body">
              <div className="form-group">
                <label className="form-label">{'Program Area'}</label>
                <select
                  className="select"
                  value={filters.programArea}
                  onChange={(e) => setFilters({ ...filters, programArea: e.target.value })}
                >
                  <option value="">{'All Programs'}</option>
                  {PROGRAM_AREAS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{'State'}</label>
                <select
                  className="select"
                  value={filters.state}
                  onChange={(e) => setFilters({ ...filters, state: e.target.value, district: '' })}
                >
                  <option value="">{'All States'}</option>
                  {getStates().map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{'District'}</label>
                <select
                  className="select"
                  value={filters.district}
                  onChange={(e) => setFilters({ ...filters, district: e.target.value })}
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
                  <label className="form-label">{'From Date'}</label>
                  <input
                    type="date"
                    className="input"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{'To Date'}</label>
                  <input
                    type="date"
                    className="input"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="filter-modal-footer">
              {hasActiveFilters && (
                <button
                  className="btn btn-ghost"
                  onClick={() => setFilters({ programArea: '', state: '', district: '', dateFrom: '', dateTo: '' })}
                >
                  {'Clear All'}
                </button>
              )}
              <button className="btn btn-primary" onClick={() => setShowFilterModal(false)}>
                {'Apply Filters'}
              </button>
            </div>
          </div>
        </div>
      )}

      {totalVisits === 0 ? (
        <div className="dashboard-empty card">
          <LayoutDashboard size={48} className="dashboard-empty-icon" />
          <h3>{'No field visit data yet'}</h3>
          <p>
            {'Visit data will appear here once field officers start logging their visits. You can load sample data from the Settings page.'}
          </p>
        </div>
      ) : (
        <div className="dashboard-content">
          {/* Dynamic Stat Cards */}
          <div className="dashboard-stats-grid" style={{ marginBottom: 'var(--space-md)' }}>
            <StatCard
              icon={ClipboardList}
              label={'Total Visits'}
              value={totalVisits}
              color="#3B82F6"
            />
            <StatCard
              icon={Users}
              label={'Active Officers'}
              value={uniqueOfficers}
              color="#10B981"
            />
            <StatCard
              icon={Heart}
              label={'Positive Sentiment'}
              value={`${positivePercent}%`}
              color={positivePercent >= 50 ? '#10B981' : '#F59E0B'}
            />
            <StatCard
              icon={AlertTriangle}
              label={'Open Blockers'}
              value={totalBlockers}
              color="#EF4444"
            />
          </div>

          {/* Executive Synthesis */}
          <div className="synthesis-card card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-md)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)' }}>
              <Sparkles size={18} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: '2px' }} />
              <p className="synthesis-text" style={{ margin: 0, fontSize: '0.92rem', fontStyle: 'italic', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                {loadingPatterns ? (
                  <span className="loading-dots">{'Synthesizing field intelligence...'}</span>
                ) : patterns?.synthesis ? (
                  patterns.synthesis
                ) : (
                  'Click "Analyze Patterns" in the Program Insights section to generate executive intelligence synthesis.'
                )}
              </p>
            </div>
          </div>

          {/* Priority Management Actions */}
          {patterns && patterns.priority_actions?.length > 0 && (
            <div className="dashboard-section" style={{ marginBottom: 'var(--space-md)' }}>
              <div className="ai-priority-actions card">
                <h4 className="ai-insights-block-title">{'Priority Management Actions'}</h4>
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

          {/* Program Trends Block */}
          <div className="dashboard-section" style={{ marginBottom: 'var(--space-md)' }}>
            {loadingPatterns ? (
              <div className="ai-patterns-loading card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '220px' }}>
                <Loader2 size={24} className="spin" />
                <p style={{ margin: 0, marginTop: '8px' }}>{'Analyzing field visit patterns...'}</p>
              </div>
            ) : patterns ? (
              <div className="ai-pattern-block card" style={{ display: 'flex', flexDirection: 'column', padding: 'var(--space-lg)' }}>
                <h4 className="ai-insights-block-title" style={{ marginBottom: 'var(--space-md)' }}>{'Program Trends'}</h4>
                <div className="ai-pattern-cards-grid">
                  {patterns.program_trends?.length > 0 ? (
                    patterns.program_trends.map((p, i) => {
                      const trendText = p.trend?.toLowerCase() || '';
                      const isNegative = p.sentiment
                        ? p.sentiment === 'negative'
                        : (
                            trendText.includes('decline') || 
                            trendText.includes('drop') || 
                            trendText.includes('fall') || 
                            trendText.includes('struggle') || 
                            (trendText.includes('block') && !trendText.includes(' block') && !trendText.includes('village')) || 
                            trendText.includes('slow') || 
                            trendText.includes('decrease') || 
                            trendText.includes('freeze') || 
                            trendText.includes('reduce') || 
                            trendText.includes('negative') || 
                            trendText.includes('low')
                          );
                      
                      const icon = isNegative ? TrendingDown : TrendingUp;
                      const severity = isNegative ? 'danger' : 'success';
                      
                      return (
                        <PatternCard
                           key={i}
                           icon={icon}
                           title={p.program}
                           description={p.trend}
                           severity={severity}
                        />
                      );
                    })
                  ) : (
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{'No program trends detected'}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="ai-patterns-generate card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', minHeight: '220px', gap: '12px' }}>
                <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-muted)' }}>{'Generate AI-powered insights across all visits.'}</p>
                <button 
                  className="btn btn-primary" 
                  onClick={() => loadPatterns(summarizedVisits)}
                  disabled={summarizedVisits.length === 0}
                >
                  <Sparkles size={16} />
                  {'Analyze Patterns'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {totalVisits === 0 && (
        <div className="dashboard-empty card">
          <LayoutDashboard size={48} className="dashboard-empty-icon" />
          <h3>{'No field visit data yet'}</h3>
          <p>
            {'Visit data will appear here once field officers start logging their visits. You can load sample data from the Settings page.'}
          </p>
        </div>
      )}

      {/* Interactive Map Tooltip removed */}
    </div>
  );
}



export default Dashboard;
