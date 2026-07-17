import { NavLink } from 'react-router-dom';
import { 
  LogOut, PlusCircle, ClipboardList, Settings, 
  LayoutDashboard, Map 
} from 'lucide-react';
import { getInitials } from '../utils/helpers';
import { NAV_ITEMS } from '../utils/constants';
import './Sidebar.css';

const ROLE_LABELS = {
  field_officer: 'Field Officer',
  manager:       'Manager',
};

const LOGO_STYLE = { 
  width: '32px', 
  height: '32px', 
  objectFit: 'contain',
  flexShrink: 0
};

const ICON_MAP = {
  PlusCircle,
  ClipboardList,
  Settings,
  LayoutDashboard,
  Map
};

/**
 * Desktop sidebar navigation.
 */
export default function Sidebar({ role, userName, onLogout, online, pendingCount }) {
  const items    = NAV_ITEMS[role] ?? NAV_ITEMS.field_officer;
  const initials = getInitials(userName);

  return (
    <aside className="sidebar" id="sidebar-nav">
      {/* Branding */}
      <div className="sidebar-header-block">
        <img 
          src="/assets/logo.png" 
          alt="GroundTruth Logo" 
          style={LOGO_STYLE} 
        />
        <div className="sidebar-brand">
          <span className="sidebar-logo-title">GroundTruth</span>
          <span className="sidebar-logo-subtitle">Field Intelligence System</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        <ul className="sidebar-nav-list">
          {items.map(({ to, label, iconName }) => {
            const Icon = ICON_MAP[iconName];
            return (
              <li key={to} className="sidebar-nav-item">
                <NavLink
                  to={to}
                  id={`sidebar-link-${to.replace('/', '')}`}
                  className={({ isActive }) =>
                    `sidebar-nav-link${isActive ? ' sidebar-nav-link--active' : ''}`
                  }
                >
                  {Icon && <Icon size={20} className="sidebar-nav-icon" />}
                  <span className="sidebar-nav-label">{label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Sync / Connectivity indicator */}
      <div className="sidebar-sync-status">
        <div className="sync-status-indicator">
          {online ? (
            <>
              <span className="sync-status-dot online" />
              <span className="sync-status-text">Cloud Sync Active</span>
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

      {/* User info */}
      <div className="sidebar-user" id="sidebar-user-info">
        <div className="sidebar-user-details">
          <div className="sidebar-avatar" aria-hidden="true">{initials}</div>
          <div className="sidebar-user-meta">
            <span className="sidebar-user-name">{userName || 'User'}</span>
            <span className="sidebar-role-badge">{ROLE_LABELS[role] ?? role}</span>
          </div>
        </div>
        <button
          className="sidebar-logout-btn"
          id="sidebar-logout-btn"
          onClick={onLogout}
          aria-label="Logout"
          title="Logout"
          type="button"
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}
