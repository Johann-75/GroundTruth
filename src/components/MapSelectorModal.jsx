import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, Check, AlertCircle, Info, MapPin } from 'lucide-react';
import IndiaMap from '@svg-maps/india';
import { getStates, getDistricts } from '../utils/constants';
import './MapSelectorModal.css';

/**
 * MapSelectorModal - allows users to select state and district from an interactive SVG map of India.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {function} props.onClose
 * @param {string} props.initialState
 * @param {string} props.initialDistrict
 * @param {function} props.onConfirm
 */
export default function MapSelectorModal({ isOpen, onClose, initialState, initialDistrict, onConfirm }) {
  const [selectedState, setSelectedState] = useState(initialState || '');
  const [selectedDistrict, setSelectedDistrict] = useState(initialDistrict || '');
  const [zoomedState, setZoomedState] = useState(initialState || null);
  const [zoomParams, setZoomParams] = useState(null);
  const [districtData, setDistrictData] = useState(null);
  const [error, setError] = useState('');
  const [tooltip, setTooltip] = useState({
    show: false,
    x: 0,
    y: 0,
    name: ''
  });

  const handleStateMouseEnter = (locName, event) => {
    setTooltip({
      show: true,
      x: event.clientX,
      y: event.clientY,
      name: locName
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
    setTooltip({ show: false, x: 0, y: 0, name: '' });
  };

  const handleDistrictMouseEnter = (districtName, event) => {
    setTooltip({
      show: true,
      x: event.clientX,
      y: event.clientY,
      name: districtName
    });
  };

  // Lazy-load district boundary JSON data when a state is zoomed/selected
  useEffect(() => {
    if (zoomedState && !districtData) {
      import('../utils/state_districts_data.json')
        .then((module) => {
          setDistrictData(module.default);
        })
        .catch((err) => {
          console.error('Failed to lazy-load district boundary JSON for selector:', err);
        });
    }
  }, [zoomedState, districtData]);

  // Handle programmatic state zooming on modal open if initialState is provided
  useEffect(() => {
    if (isOpen) {
      setSelectedState(initialState || '');
      setSelectedDistrict(initialDistrict || '');
      setZoomedState(initialState || null);
      setZoomParams(null);
      setError('');

      if (initialState) {
        // Trigger a tick delay to ensure the SVG is rendered so we can query bounding boxes
        const t = setTimeout(() => {
          const pathEl = document.querySelector(`path[name="${initialState}"]`);
          if (pathEl) {
            const loc = IndiaMap.locations.find((l) => l.name === initialState);
            if (loc) {
              zoomToStatePath(loc, pathEl);
            }
          }
        }, 150);
        return () => clearTimeout(t);
      }
    }
  }, [isOpen, initialState, initialDistrict]);

  const zoomToStatePath = (loc, element) => {
    try {
      const bbox = element.getBBox();
      const viewBoxParts = IndiaMap.viewBox.split(' ').map(Number);
      const svgWidth = viewBoxParts[2] || 650;
      const svgHeight = viewBoxParts[3] || 700;

      // Scale up to fit selector container
      const scale = Math.min(svgWidth / bbox.width, svgHeight / bbox.height) * 0.75;
      const cx = bbox.x + bbox.width / 2;
      const cy = bbox.y + bbox.height / 2;
      const sx = svgWidth / 2;
      const sy = svgHeight / 2;

      setZoomedState(loc.name);
      setZoomParams({
        transform: `translate(${sx - cx}px, ${sy - cy}px) scale(${scale})`,
        origin: `${cx}px ${cy}px`,
        bbox,
      });
      setError('');
    } catch (e) {
      console.warn('Could not compute SVG bounding box for state zoom:', e);
      setZoomedState(loc.name);
      setZoomParams(null);
    }
  };

  const handleStateClick = (loc, event) => {
    event.preventDefault();
    setSelectedState(loc.name);
    setSelectedDistrict('');
    zoomToStatePath(loc, event.currentTarget);
    setTooltip({ show: false, x: 0, y: 0, name: '' });
  };

  const handleResetZoom = () => {
    setZoomedState(null);
    setZoomParams(null);
    setSelectedState('');
    setSelectedDistrict('');
    setError('');
    setTooltip({ show: false, x: 0, y: 0, name: '' });
  };

  const handleDistrictClick = (districtName) => {
    setSelectedDistrict(districtName);
    setError('');
  };

  const handleConfirm = () => {
    if (!selectedState) {
      setError('Please select a state from the map first.');
      return;
    }
    if (!selectedDistrict) {
      setError('Please select a district inside the state.');
      return;
    }
    onConfirm(selectedState, selectedDistrict);
    onClose();
  };

  const renderDistrictCells = (stateName, bbox) => {
    if (!districtData) {
      return (
        <text
          x={bbox.x + bbox.width / 2}
          y={bbox.y + bbox.height / 2}
          fill="var(--color-text-secondary)"
          fontSize="14"
          textAnchor="middle"
        >
          Loading districts...
        </text>
      );
    }

    // 1. Render official GeoJSON boundaries if available in JSON dataset
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
          polygons: projectedPolys,
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
        const isSelected = selectedDistrict === dist.name;
        dist.polygons.forEach((poly, polyIdx) => {
          if (poly.length < 3) return;
          const pointsStr = poly.map(transformPoint).join(' ');

          cells.push(
            <polygon
              key={`selector-${stateName}-${dist.name}-${polyIdx}`}
              points={pointsStr}
              fill={isSelected ? 'rgba(59, 130, 246, 0.75)' : 'rgba(51, 65, 85, 0.25)'}
              stroke={isSelected ? 'var(--color-primary-light)' : 'rgba(255, 255, 255, 0.15)'}
              strokeWidth={isSelected ? '0.75' : '0.35'}
              onClick={() => handleDistrictClick(dist.name)}
              onMouseEnter={(e) => handleDistrictMouseEnter(dist.name, e)}
              onMouseMove={handleStateMouseMove}
              onMouseLeave={handleStateMouseLeave}
              style={{ transition: 'all 0.15s ease', cursor: 'pointer' }}
              className="map-selector-district-polygon"
            />
          );
        });
      });

      return cells;
    }

    // 2. Procedural grid fallback for missing states
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
        const isSelected = selectedDistrict === districtName;

        const p1 = points[r][c];
        const p2 = points[r][c + 1];
        const p3 = points[r + 1][c + 1];
        const p4 = points[r + 1][c];

        const pointsStr = `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`;

        cells.push(
          <polygon
            key={`fallback-${stateName}-${districtName}-${idx}`}
            points={pointsStr}
            fill={isSelected ? 'rgba(59, 130, 246, 0.75)' : 'rgba(51, 65, 85, 0.25)'}
            stroke={isSelected ? 'var(--color-primary-light)' : 'rgba(255, 255, 255, 0.1)'}
            strokeWidth={isSelected ? '0.75' : '0.35'}
            onClick={() => handleDistrictClick(districtName)}
            onMouseEnter={(e) => handleDistrictMouseEnter(districtName, e)}
            onMouseMove={handleStateMouseMove}
            onMouseLeave={handleStateMouseLeave}
            style={{ transition: 'all 0.15s ease', cursor: 'pointer' }}
            className="map-selector-district-polygon"
          />
        );
      }
    }

    return cells;
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="map-selector-overlay" onClick={onClose}>
      <div className="map-selector-modal card" onClick={(e) => e.stopPropagation()}>
        
        {/* Mobile Header (Hides on desktop to allow map to stretch to top) */}
        <div className="map-selector-header map-selector-header-mobile">
          <div className="map-selector-title">
            <MapPin size={20} className="map-selector-icon-pin" />
            <h3>Select Site Location</h3>
          </div>
          <button className="map-selector-close" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Content Pane Grid (Map on left, selection info on right) */}
        <div className="map-selector-content-grid">
          
          {/* Left Column: Interactive Map */}
          <div className="map-selector-map-pane">
            {zoomedState && (
              <button className="btn btn-secondary map-selector-back-btn" onClick={handleResetZoom}>
                <ArrowLeft size={14} />
                <span>Back to India</span>
              </button>
            )}

            <div className="map-selector-svg-wrapper">
              <svg viewBox={IndiaMap.viewBox} className="map-selector-svg">
                <defs>
                  {IndiaMap.locations.map((loc) => (
                    <clipPath key={`selector-clip-${loc.id}`} id={`selector-clip-${loc.id}`}>
                      <path d={loc.path} />
                    </clipPath>
                  ))}
                </defs>
                <g
                  style={{
                    transform: zoomParams?.transform || 'none',
                    transformOrigin: zoomParams?.origin || 'center',
                    transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  {IndiaMap.locations.map((loc) => {
                    const isZoomed = zoomedState === loc.name;
                    const isSelected = selectedState === loc.name;

                    let fill = 'rgba(51, 65, 85, 0.15)';
                    let stroke = 'rgba(71, 85, 105, 0.4)';

                    if (isSelected) {
                      fill = 'rgba(30, 41, 59, 0.85)';
                      stroke = 'rgba(59, 130, 246, 0.8)';
                    }

                    return (
                      <g key={`selector-state-${loc.id}`}>
                        <path
                          d={loc.path}
                          name={loc.name}
                          id={loc.id}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth="1.2"
                          className={`map-selector-state-path ${isSelected ? 'active' : ''}`}
                          onClick={(e) => !zoomedState && handleStateClick(loc, e)}
                          onMouseEnter={(e) => !zoomedState && handleStateMouseEnter(loc.name, e)}
                          onMouseMove={!zoomedState ? handleStateMouseMove : undefined}
                          onMouseLeave={!zoomedState ? handleStateMouseLeave : undefined}
                          style={{
                            transition: 'all 0.25s ease',
                            cursor: zoomedState ? 'default' : 'pointer',
                            pointerEvents: zoomedState && !isZoomed ? 'none' : 'auto',
                            fillOpacity: zoomedState && !isZoomed ? 0.15 : 1,
                          }}
                        />
                        {isZoomed && zoomParams?.bbox && (
                          <g clipPath={`url(#selector-clip-${loc.id})`}>
                            {renderDistrictCells(loc.name, zoomParams.bbox)}
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
          </div>

          {/* Right Column: Selections & Actions */}
          <div className="map-selector-info-pane">
            
            {/* Desktop Header (Inline - title shifted to the right) */}
            <div className="map-selector-header-desktop">
              <div className="map-selector-title">
                <MapPin size={20} className="map-selector-icon-pin" />
                <h3>Select Site Location</h3>
              </div>
              <button className="map-selector-close" onClick={onClose} aria-label="Close modal">
                <X size={20} />
              </button>
            </div>

            {/* Selection Banner */}
            <div className="map-selector-path-banner">
              <div className="map-selector-path-step">
                <span className="map-selector-path-label">State</span>
                <span className={`map-selector-path-value ${selectedState ? 'active' : ''}`}>
                  {selectedState || 'Not selected'}
                </span>
              </div>
              <div className="map-selector-path-arrow">→</div>
              <div className="map-selector-path-step">
                <span className="map-selector-path-label">District</span>
                <span className={`map-selector-path-value ${selectedDistrict ? 'active' : ''}`}>
                  {selectedDistrict || 'Not selected'}
                </span>
              </div>
            </div>

            {/* Hint message card */}
            <div className="map-selector-hint">
              <Info size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-primary-light)' }} />
              <span>
                {!zoomedState
                  ? 'Tap a state on the map to zoom in and load its program districts.'
                  : 'Tap a district polygon to select it. Click "Back to India" to select another state.'}
              </span>
            </div>

            {/* Spacer */}
            <div className="map-selector-spacer" />

            {/* Error alerts and Actions pane */}
            <div className="map-selector-info-footer">
              {error && (
                <div className="map-selector-error">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}
              <div className="map-selector-actions">
                <button className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleConfirm}
                  disabled={!selectedState || !selectedDistrict}
                >
                  <Check size={16} />
                  Confirm Selection
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
    {tooltip.show && (
      <div 
        className="map-selector-tooltip"
        style={{
          position: 'fixed',
          top: `${tooltip.y}px`,
          left: `${tooltip.x}px`,
          transform: 'translate(-50%, -100%)',
          marginTop: '-12px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '6px 12px',
          color: 'var(--color-text)',
          fontSize: '0.75rem',
          fontWeight: '600',
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
          zIndex: 100001
        }}
      >
        {tooltip.name}
      </div>
    )}
    </>,
    document.body
  );
}
