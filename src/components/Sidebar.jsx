import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  ClipboardList,
  Settings,
  LayoutDashboard,
  LogOut,
  Activity,
  Map,
} from 'lucide-react';
import './Sidebar.css';

/**
 * Gets the initials from a full name string.
 * @param {string} name - The user's full name.
 * @returns {string} Up to 2 uppercase initials.
 */
function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

/** Navigation link definitions per role */
const NAV_ITEMS = {
  field_officer: [
    { to: '/new-visit', label: 'New Visit', icon: PlusCircle },
    { to: '/my-visits', label: 'Visits', icon: ClipboardList },
    { to: '/settings', label: 'Settings', icon: Settings },
  ],
  manager: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/map', label: 'View Map', icon: Map },
    { to: '/my-visits', label: 'Visits', icon: ClipboardList },
    { to: '/settings', label: 'Settings', icon: Settings },
  ],
};

/**
 * Desktop sidebar navigation component.
 * Collapsible to icons-only mode.
 */
export default function Sidebar({
  role,
  userName,
  onLogout,
  online,
  pendingCount,
}) {
  const navigate = useNavigate();
  const items = NAV_ITEMS[role] || NAV_ITEMS.field_officer;
  const initials = getInitials(userName);

  const roleLabelMap = {
    field_officer: 'Field Officer',
    manager: 'Manager',
  };

  const handleLogout = () => {
    if (onLogout) onLogout();
    navigate('/login');
  };

  return (
    <aside className="sidebar" id="sidebar-nav">
      {/* ── Branding Header ── */}
      <div className="sidebar-header-block">
        <div className="sidebar-brand">
          <span className="sidebar-logo-title">GroundTruth</span>
          <span className="sidebar-logo-subtitle">{'by The/Nudge Institute'}</span>
        </div>
      </div>

      {/* ── Navigation links ── */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        <ul className="sidebar-nav-list">
          {items.map(({ to, label, icon: Icon }) => (
            <li key={to} className="sidebar-nav-item">
              <NavLink
                to={to}
                id={`sidebar-link-${to.replace('/', '')}`}
                className={({ isActive }) =>
                  `sidebar-nav-link${isActive ? ' sidebar-nav-link--active' : ''}`
                }
              >
                <Icon size={20} className="sidebar-nav-icon" />
                <span className="sidebar-nav-label">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Sync / Connectivity Indicator ── */}
      <div className="sidebar-sync-status">
        <div className="sync-status-indicator">
          {online ? (
            <>
              <span className="sync-status-dot online" />
              <span className="sync-status-text">{'Cloud Sync Active'}</span>
            </>
          ) : (
            <>
              <span className={`sync-status-dot ${pendingCount > 0 ? 'pending' : 'offline'}`} />
              <span className="sync-status-text">
                {pendingCount > 0 ? `Offline (${pendingCount} queued)` : 'Offline (Synced)'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── User info (pinned to bottom) ── */}
      <div className="sidebar-user" id="sidebar-user-info">
        <div className="sidebar-user-details">
          <div className="sidebar-avatar" aria-hidden="true">
            {initials}
          </div>
          <div className="sidebar-user-meta">
            <span className="sidebar-user-name">{userName || 'User'}</span>
            <span className="sidebar-role-badge">{roleLabelMap[role] || role}</span>
          </div>
        </div>
        <button
          className="sidebar-logout-btn"
          id="sidebar-logout-btn"
          onClick={handleLogout}
          aria-label={'Logout'}
          title={'Logout'}
          type="button"
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}
