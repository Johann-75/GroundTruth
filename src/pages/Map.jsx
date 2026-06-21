import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  Map as MapIcon, Filter, RefreshCw, X, ArrowLeft, ClipboardList, Info
} from 'lucide-react';
import IndiaMap from '@svg-maps/india';
import { getVisits } from '../services/storage';
import { PROGRAM_AREAS, getStates, getDistricts } from '../utils/constants';
import { getSentimentColor, formatTime } from '../utils/helpers';
import './Map.css';

const SENTIMENT_COLORS = {
  positive: '#10B981',
  mixed: '#F59E0B',
  negative: '#EF4444',
};

function MapPage() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const [allVisits, setAllVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [tooltip, setTooltip] = useState({
    show: false,
    x: 0,
    y: 0,
    content: null
  });
  
  const [filters, setFilters] = useState({
    programArea: '',
    state: '',
    district: '',
    dateFrom: '',
    dateTo: '',
  });

  const [zoomedState, setZoomedState] = useState(null);
  const [zoomParams, setZoomParams] = useState(null);
  const [districtData, setDistrictData] = useState(null);

  // Lazy-load district boundary JSON data when a state is zoomed
  useEffect(() => {
    if (zoomedState && !districtData) {
      import('../utils/state_districts_data.json')
        .then((module) => {
          setDistrictData(module.default);
        })
        .catch((err) => {
          console.error('Failed to lazy-load district boundary JSON:', err);
        });
    }
  }, [zoomedState, districtData]);

  // Load visits data on mount and listen for background sync completions
  useEffect(() => {
    loadData();

    const handleSyncComplete = () => {
      console.log('[MapPage] Sync completed, reloading data...');
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
      console.error('Failed to load map page visits:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setZoomedState(null);
    setZoomParams(null);
    setTooltip({ show: false, x: 0, y: 0, content: null });
    setFilters({
      programArea: '',
      state: '',
      district: '',
      dateFrom: '',
      dateTo: '',
    });
    await loadData();
  };

  // Reset state zoom and clear corresponding state filter
  const handleResetZoom = () => {
    setZoomedState(null);
    setZoomParams(null);
    setTooltip({ show: false, x: 0, y: 0, content: null });
    setFilters(prev => ({ ...prev, state: '', district: '' }));
  };

  // Zoom into state on double click
  const handleStateDoubleClick = (loc, event) => {
    event.preventDefault();
    const bbox = event.currentTarget.getBBox();
    const viewBoxParts = IndiaMap.viewBox.split(' ').map(Number);
    const svgWidth = viewBoxParts[2] || 650;
    const svgHeight = viewBoxParts[3] || 700;
    
    // Scale up to fit viewport with padding
    const scale = Math.min(svgWidth / bbox.width, svgHeight / bbox.height) * 0.75;
    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;
    const sx = svgWidth / 2;
    const sy = svgHeight / 2;
    
    setZoomedState(loc.name);
    setZoomParams({
      transform: `translate(${sx - cx}px, ${sy - cy}px) scale(${scale})`,
      origin: `${cx}px ${cy}px`,
      bbox
    });
    setTooltip({ show: false, x: 0, y: 0, content: null });
    setFilters(prev => ({ ...prev, state: loc.name, district: '' }));
  };

  // Apply filters to visits list
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

  // Aggregate stats per state
  const stateStats = useMemo(() => {
    const stats = {};
    filteredVisits.forEach((v) => {
      const stateName = v.state;
      if (!stats[stateName]) {
        stats[stateName] = { 
          visits: 0, 
          positiveCount: 0, 
          mixedCount: 0, 
          negativeCount: 0 
        };
      }
      stats[stateName].visits++;
      if (v.aiSummary?.community_sentiment) {
        const sent = v.aiSummary.community_sentiment;
        if (sent === 'positive') stats[stateName].positiveCount++;
        else if (sent === 'mixed') stats[stateName].mixedCount++;
        else if (sent === 'negative') stats[stateName].negativeCount++;
      }
    });

    Object.keys(stats).forEach((stateName) => {
      const s = stats[stateName];
      if (s.visits > 0) {
        const score = (s.positiveCount * 1 + s.negativeCount * -1 + s.mixedCount * 0) / s.visits;
        if (score > 0) {
          s.dominantSentiment = 'positive';
        } else if (score < 0) {
          s.dominantSentiment = 'negative';
        } else {
          s.dominantSentiment = 'mixed';
        }
      } else {
        s.dominantSentiment = '—';
      }
    });

    return stats;
  }, [filteredVisits]);

  // Fetch stats for a specific district (supports fuzzy spelling matching)
  const getDistrictStats = (stateName, districtName) => {
    const stats = { 
      visits: 0, 
      positiveCount: 0, 
      mixedCount: 0, 
      negativeCount: 0 
    };
    
    const isDistrictMatch = (distA, distB) => {
      if (!distA || !distB) return false;
      const stripParentheses = (s) => s.split('(')[0].trim();
      const da = stripParentheses(distA);
      const db = stripParentheses(distB);
      
      const clean = (s) => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const a = clean(da);
      const b = clean(db);
      
      if (a === b) return true;
      if (a.includes(b) || b.includes(a)) return true;
      
      const Renames = {
        'allahabad': 'prayagraj',
        'faizabad': 'ayodhya',
        'burdwan': 'bardhaman',
        'mewat': 'nuh',
        'gurgaon': 'gurugram'
      };
      
      const resolveRename = (s) => Renames[s] || s;
      if (clean(resolveRename(a)) === clean(resolveRename(b))) return true;
      
      const simplify = (s) => clean(s)
                                .replace(/e/g, 'a')
                                .replace(/i/g, 'a')
                                .replace(/o/g, 'a')
                                .replace(/u/g, 'a')
                                .replace(/y/g, 'a')
                                .replace(/h/g, '')
                                .replace(/w/g, 'v')
                                .replace(/k/g, 'c')
                                .replace(/s/g, 'z')
                                .replace(/j/g, 'z')
                                .replace(/(.)\1+/g, '$1');
      
      return simplify(da) === simplify(db);
    };

    const cleanStr = (s) => (s || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleanState = cleanStr(stateName);
    
    filteredVisits.forEach((v) => {
      if (cleanStr(v.state) === cleanState && isDistrictMatch(v.district, districtName)) {
        stats.visits++;
        if (v.aiSummary?.community_sentiment) {
          const sent = v.aiSummary.community_sentiment;
          if (sent === 'positive') stats.positiveCount++;
          else if (sent === 'mixed') stats.mixedCount++;
          else if (sent === 'negative') stats.negativeCount++;
        }
      }
    });

    let dominantSentiment = '—';
    const pos = stats.positiveCount;
    const mix = stats.mixedCount;
    const neg = stats.negativeCount;

    if (stats.visits > 0) {
      const score = (pos * 1 + neg * -1 + mix * 0) / stats.visits;
      if (score > 0) {
        dominantSentiment = 'positive';
      } else if (score < 0) {
        dominantSentiment = 'negative';
      } else {
        dominantSentiment = 'mixed';
      }
    }

    return { ...stats, dominantSentiment };
  };

  // State mouse hover callbacks
  const handleStateMouseEnter = (locName, event) => {
    const stats = stateStats[locName];
    if (!stats || stats.visits === 0) {
      setTooltip({
        show: true,
        x: event.clientX,
        y: event.clientY,
        content: {
          name: locName,
          visits: 0,
          sentiment: 'No visits'
        }
      });
      return;
    }
    setTooltip({
      show: true,
      x: event.clientX,
      y: event.clientY,
      content: {
        name: locName,
        visits: stats.visits,
        sentiment: stats.dominantSentiment,
        positive: stats.positiveCount,
        mixed: stats.mixedCount,
        negative: stats.negativeCount
      }
    });
  };

  const handleStateMouseMove = (event) => {
    setTooltip((prev) => ({
      ...prev,
      x: event.clientX,
      y: event.clientY
    }));
  };

  const handleStateMouseLeave = () => {
    setTooltip({
      show: false,
      x: 0,
      y: 0,
      content: null
    });
  };

  // District mouse hover callbacks
  const handleDistrictMouseEnter = (stateName, districtName, event) => {
    const stats = getDistrictStats(stateName, districtName);
    setTooltip({
      show: true,
      x: event.clientX,
      y: event.clientY,
      content: {
        name: `${districtName}, ${stateName}`,
        visits: stats.visits,
        sentiment: stats.dominantSentiment,
        positive: stats.positiveCount,
        mixed: stats.mixedCount,
        negative: stats.negativeCount
      }
    });
  };

  // Render district boundaries within a zoomed state
  const renderDistrictCells = (stateName, bbox) => {
    if (!districtData) return null;
    
    // 1. Render official GeoJSON-based boundary paths if available
    if (districtData[stateName]) {
      const stateData = districtData[stateName];
      
      const project = (lng, lat) => {
        const x = lng;
        const rad = (lat * Math.PI) / 180;
        const y = -Math.log(Math.tan(Math.PI / 4 + rad / 2));
        return { x, y };
      };
      
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      
      const projectedDistricts = stateData.map((dist) => {
        const projectedPolys = dist.polygons.map((poly) => {
          return poly.map(([lng, lat]) => {
            const pt = project(lng, lat);
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
            return pt;
          });
        });
        return {
          name: dist.name,
          polygons: projectedPolys
        };
      });
      
      const srcW = maxX - minX;
      const srcH = maxY - minY;
      const scaleX = srcW > 0 ? bbox.width / srcW : 1;
      const scaleY = srcH > 0 ? bbox.height / srcH : 1;
      
      const transformPoint = (pt) => {
        const tx = bbox.x + (pt.x - minX) * scaleX;
        const ty = bbox.y + (pt.y - minY) * scaleY;
        return `${tx.toFixed(2)},${ty.toFixed(2)}`;
      };
      
      const cells = [];
      projectedDistricts.forEach((dist) => {
        dist.polygons.forEach((poly, polyIdx) => {
          if (poly.length < 3) return;
          const pointsStr = poly.map(transformPoint).join(' ');
          
          const stats = getDistrictStats(stateName, dist.name);
          const hasVisits = stats.visits > 0;
          
          let fill = 'rgba(51, 65, 85, 0.15)';
          let stroke = 'rgba(255, 255, 255, 0.15)';
          
          if (hasVisits) {
            stroke = 'var(--color-surface)';
            if (stats.dominantSentiment === 'positive') fill = 'rgba(16, 185, 129, 0.65)';
            else if (stats.dominantSentiment === 'mixed') fill = 'rgba(245, 158, 11, 0.65)';
            else if (stats.dominantSentiment === 'negative') fill = 'rgba(239, 68, 68, 0.65)';
          }
          
          cells.push(
            <polygon
              key={`${stateName}-${dist.name}-${polyIdx}`}
              points={pointsStr}
              fill={fill}
              stroke={stroke}
              strokeWidth="0.3"
              className={`map-district-polygon ${hasVisits ? 'map-district-active' : ''}`}
              onMouseEnter={(e) => handleDistrictMouseEnter(stateName, dist.name, e)}
              onMouseMove={handleStateMouseMove}
              onMouseLeave={handleStateMouseLeave}
              onClick={() => setFilters(prev => ({ ...prev, district: dist.name }))}
              style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
            />
          );
        });
      });
      
      return cells;
    }
    
    // 2. Procedural grids fallback for states missing from dataset
    const districts = getDistricts(stateName).length > 0 ? getDistricts(stateName) : [stateName];
    const N = districts.length;
    const C = Math.ceil(Math.sqrt(N));
    const R = Math.ceil(N / C);
    
    const wStep = bbox.width / C;
    const hStep = bbox.height / R;
    
    const points = [];
    const pseudoRandom = (seed) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    for (let r = 0; r <= R; r++) {
      points[r] = [];
      for (let c = 0; c <= C; c++) {
        let px = bbox.x + c * wStep;
        let py = bbox.y + r * hStep;
        
        if (c > 0 && c < C && r > 0 && r < R) {
          const seedX = stateName.charCodeAt(0) + c * 17 + r * 31;
          const seedY = (stateName.charCodeAt(1) || 65) + c * 23 + r * 37;
          px += (pseudoRandom(seedX) - 0.5) * wStep * 0.45;
          py += (pseudoRandom(seedY) - 0.5) * hStep * 0.45;
        }
        
        points[r][c] = { x: px, y: py };
      }
    }
    
    const cells = [];
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const idx = c + r * C;
        const districtName = districts[idx % N];
        
        const p1 = points[r][c];
        const p2 = points[r][c+1];
        const p3 = points[r+1][c+1];
        const p4 = points[r+1][c];
        
        const pointsStr = `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`;
        
        const stats = getDistrictStats(stateName, districtName);
        const hasVisits = stats.visits > 0;
        
        let fill = 'rgba(51, 65, 85, 0.15)';
        let stroke = 'rgba(255, 255, 255, 0.08)';
        
        if (hasVisits) {
          stroke = 'var(--color-surface)';
          if (stats.dominantSentiment === 'positive') fill = 'rgba(16, 185, 129, 0.65)';
          else if (stats.dominantSentiment === 'mixed') fill = 'rgba(245, 158, 11, 0.65)';
          else if (stats.dominantSentiment === 'negative') fill = 'rgba(239, 68, 68, 0.65)';
        }
        
        cells.push(
          <polygon
            key={`${stateName}-${districtName}-${idx}`}
            points={pointsStr}
            fill={fill}
            stroke={stroke}
            strokeWidth="0.5"
            className={`map-district-polygon ${hasVisits ? 'map-district-active' : ''}`}
            onMouseEnter={(e) => handleDistrictMouseEnter(stateName, districtName, e)}
            onMouseMove={handleStateMouseMove}
            onMouseLeave={handleStateMouseLeave}
            onClick={() => setFilters(prev => ({ ...prev, district: districtName }))}
            style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
          />
        );
      }
    }
    
    return cells;
  };

  const hasActiveFilters = filters.programArea || filters.state || filters.district || filters.dateFrom || filters.dateTo;

  if (loading) {
    return (
      <div className="map-page">
        <div className="map-page-loading">
          <div className="loading-pulse" />
          <p>{'Loading Geographic Insights...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-page">
      {/* Header Row */}
      <div className="map-page-header">
        <div className="map-page-title">
          <MapIcon size={24} />
          <h1>{'Map'}</h1>
        </div>
        <div className="map-page-actions">
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

      {/* Filter Modal Overlay */}
      {showFilterModal && (
        <div className="filter-modal-overlay" onClick={() => setShowFilterModal(false)}>
          <div className="filter-modal-content card" onClick={(e) => e.stopPropagation()}>
            <div className="filter-modal-header">
              <h3>{'Filter Geographic View'}</h3>
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
                  onChange={(e) => {
                    const selectedState = e.target.value;
                    setFilters({ ...filters, state: selectedState, district: '' });
                    if (!selectedState) {
                      setZoomedState(null);
                      setZoomParams(null);
                    } else {
                      // Attempt state zooming programmatically by finding matching map path element
                      const pathEl = document.querySelector(`path[name="${selectedState}"]`);
                      if (pathEl) {
                        const loc = IndiaMap.locations.find(l => l.name === selectedState);
                        if (loc) {
                          const fakeEvent = {
                            preventDefault: () => {},
                            currentTarget: pathEl
                          };
                          handleStateDoubleClick(loc, fakeEvent);
                        }
                      } else {
                        setZoomedState(selectedState);
                        setZoomParams(null);
                      }
                    }
                  }}
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
                  onClick={() => {
                    setFilters({ programArea: '', state: '', district: '', dateFrom: '', dateTo: '' });
                    setZoomedState(null);
                    setZoomParams(null);
                  }}
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

      {/* Main Map View Block */}
      <div className="map-page-layout">
        <div className="map-display-wrapper card">
          <div className="map-interactive-container">
            {zoomedState && (
              <button 
                className="btn btn-secondary map-reset-zoom-btn" 
                onClick={handleResetZoom}
              >
                <ArrowLeft size={14} />
                {'Back to India'}
              </button>
            )}
            
            <svg viewBox={IndiaMap.viewBox} className="india-map-svg-full">
              <defs>
                {IndiaMap.locations.map((loc) => (
                  <clipPath key={`clip-${loc.id}`} id={`clip-${loc.id}`}>
                    <path d={loc.path} />
                  </clipPath>
                ))}
              </defs>
              <g 
                style={{ 
                  transform: zoomParams?.transform || 'none', 
                  transformOrigin: zoomParams?.origin || 'center', 
                  transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)' 
                }}
              >
                {IndiaMap.locations.map((loc) => {
                  const stats = stateStats[loc.name];
                  const hasVisits = stats && stats.visits > 0;
                  
                  let fill = 'rgba(51, 65, 85, 0.15)';
                  let stroke = 'rgba(71, 85, 105, 0.4)';
                  
                  if (hasVisits) {
                    stroke = 'var(--color-surface)';
                    const dominantSentiment = stats.dominantSentiment;
                    if (dominantSentiment === 'positive') {
                      fill = 'rgba(16, 185, 129, 0.65)';
                    } else if (dominantSentiment === 'mixed') {
                      fill = 'rgba(245, 158, 11, 0.65)';
                    } else if (dominantSentiment === 'negative') {
                      fill = 'rgba(239, 68, 68, 0.65)';
                    }
                  }
                  
                  const isThisZoomed = zoomedState === loc.name;
                  if (isThisZoomed) {
                    fill = 'rgba(30, 41, 59, 0.9)';
                    stroke = 'rgba(71, 85, 105, 0.6)';
                  }
                  
                  return (
                    <g key={loc.id}>
                      <path
                        d={loc.path}
                        name={loc.name}
                        id={loc.id}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth="1"
                        className={`map-state-path ${hasVisits ? 'map-state-active' : ''}`}
                        style={{ 
                          transition: 'all 0.2s ease', 
                          cursor: zoomedState ? 'default' : (hasVisits ? 'pointer' : 'default'),
                          pointerEvents: zoomedState && !isThisZoomed ? 'none' : 'auto',
                          fillOpacity: zoomedState && !isThisZoomed ? 0.15 : 1
                        }}
                        onMouseEnter={(e) => !zoomedState && handleStateMouseEnter(loc.name, e)}
                        onMouseMove={!zoomedState ? handleStateMouseMove : undefined}
                        onMouseLeave={!zoomedState ? handleStateMouseLeave : undefined}
                        onDoubleClick={(e) => !zoomedState && hasVisits && handleStateDoubleClick(loc, e)}
                      />
                      {isThisZoomed && zoomParams?.bbox && (
                        <g clipPath={`url(#clip-${loc.id})`}>
                          {renderDistrictCells(loc.name, zoomParams.bbox)}
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          <div className="map-legend">
            <div className="map-legend-item">
              <span className="map-legend-color-box map-legend-color-positive" />
              <span style={{ color: 'var(--color-text-secondary)' }}>{'Positive'}</span>
            </div>
            <div className="map-legend-item">
              <span className="map-legend-color-box map-legend-color-mixed" />
              <span style={{ color: 'var(--color-text-secondary)' }}>{'Mixed'}</span>
            </div>
            <div className="map-legend-item">
              <span className="map-legend-color-box map-legend-color-negative" />
              <span style={{ color: 'var(--color-text-secondary)' }}>{'Negative'}</span>
            </div>
            <div className="map-legend-item">
              <span className="map-legend-color-box map-legend-color-none" />
              <span style={{ color: 'var(--color-text-muted)' }}>{'None'}</span>
            </div>
          </div>
        </div>

        {/* Sidebar Info Section displaying logs/details for active state selection */}
        <div className="map-details-sidebar card">
          <div className="map-details-header">
            <h3>{zoomedState ? zoomedState : 'India Overview'}</h3>
          </div>

          {zoomedState ? (
            <div className="map-details-content">
              <table className="map-sidebar-table">
                <tbody>

                  {filters.district && (
                    <tr>
                      <td>{'District'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          <strong>{filters.district}</strong>
                          <button 
                            className="btn-clear-district" 
                            onClick={() => setFilters(prev => ({ ...prev, district: '' }))}
                            title="Clear district filter"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td>{'Total Visits'}</td>
                    <td><strong>{filteredVisits.length}</strong></td>
                  </tr>
                  <tr>
                    <td>{'Positive'}</td>
                    <td style={{ color: 'var(--color-sentiment-positive)', fontWeight: '600' }}>
                      {filteredVisits.filter(v => v.aiSummary?.community_sentiment === 'positive').length}
                    </td>
                  </tr>
                  <tr>
                    <td>{'Mixed'}</td>
                    <td style={{ color: 'var(--color-sentiment-mixed)', fontWeight: '600' }}>
                      {filteredVisits.filter(v => v.aiSummary?.community_sentiment === 'mixed').length}
                    </td>
                  </tr>
                  <tr>
                    <td>{'Negative'}</td>
                    <td style={{ color: 'var(--color-sentiment-negative)', fontWeight: '600' }}>
                      {filteredVisits.filter(v => v.aiSummary?.community_sentiment === 'negative').length}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="map-visits-feed">
                <h5>
                  <ClipboardList size={14} />
                  {'Visits List'}
                </h5>
                <div className="map-feed-list">
                  {filteredVisits.length > 0 ? (
                    filteredVisits.map((v) => (
                      <div 
                        key={v.id} 
                        className="map-feed-item" 
                        onClick={() => navigate(`/visit/${v.id}`)}
                      >
                        <div className="map-feed-item-header">
                          <span className="map-feed-item-program">{v.programArea}</span>
                          <span className="map-feed-item-date">{v.date} {formatTime(v.createdAt || v.created_at)}</span>
                        </div>
                        <p className="map-feed-item-location">{v.district}, {v.block || 'Rural block'}</p>
                        <div className="map-feed-item-footer">
                          <span className="map-feed-item-officer">{'By: '}{v.officerName}</span>
                          {v.aiSummary?.community_sentiment && (
                            <span 
                              className="map-feed-item-sentiment-dot" 
                              style={{ backgroundColor: SENTIMENT_COLORS[v.aiSummary.community_sentiment] }} 
                            />
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="map-feed-empty">{'No visits matching current filters'}</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="map-details-content-empty">
              <Info size={32} style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }} />
              <h4>{'Select a State'}</h4>
              <p>{'Double-click any highlighted state on the map to explore local district sentiment details.'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Tooltip */}
      {tooltip.show && tooltip.content && (() => {
        const tooltipLeft = tooltip.x + 190 > window.innerWidth ? tooltip.x - 200 : tooltip.x + 15;
        const tooltipTop = tooltip.y + 130 > window.innerHeight ? tooltip.y - 120 : tooltip.y + 15;
        return (
          <div 
            className="map-tooltip-box card" 
            style={{ 
              top: tooltipTop, 
              left: tooltipLeft 
            }}
          >
            <h4 style={{ margin: 0, color: 'var(--color-text)', fontSize: '0.88rem', fontWeight: 600 }}>
              {tooltip.content.name}
            </h4>
            {tooltip.content.visits > 0 ? (
              <div style={{ marginTop: '6px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                  {'Visits: '}<strong>{tooltip.content.visits}</strong>
                </p>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                  {'Sentiment: '}
                  <span style={{ textTransform: 'capitalize', color: getSentimentColor(tooltip.content.sentiment), fontWeight: 600 }}>
                    {tooltip.content.sentiment}
                  </span>
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '0.75rem', borderTop: '1px solid var(--color-border)', paddingTop: '4px' }}>
                  <span style={{ color: 'var(--color-sentiment-positive)' }}>{`Pos: ${tooltip.content.positive}`}</span>
                  <span style={{ color: 'var(--color-sentiment-mixed)' }}>{`Mix: ${tooltip.content.mixed}`}</span>
                  <span style={{ color: 'var(--color-sentiment-negative)' }}>{`Neg: ${tooltip.content.negative}`}</span>
                </div>
              </div>
            ) : (
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                {'No active logs'}
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export default MapPage;
