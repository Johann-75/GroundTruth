import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  PlusCircle,
  ClipboardList,
  Settings,
  LayoutDashboard,
  Map,
} from 'lucide-react';
import './BottomNav.css';

/** Navigation items per role */
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
 * Mobile bottom navigation bar.
 * Visible at viewport widths < 768px.
 *
 * @param {object} props
 * @param {'field_officer' | 'manager'} props.role - The current user's role.
 * @param {string} props.userName - The current user's display name (reserved for future use).
 */
export default function BottomNav({ role, userName, online, pendingCount }) {
  const items = NAV_ITEMS[role] || NAV_ITEMS.field_officer;

  return (
    <nav className="bottom-nav" id="bottom-nav" aria-label="Mobile navigation">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          id={`bottom-nav-link-${to.replace('/', '')}`}
          className={({ isActive }) =>
            `bottom-nav-item${isActive ? ' bottom-nav-item--active' : ''}`
          }
        >
          <div className="bottom-nav-icon-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={22} className="bottom-nav-icon" />
            {label === 'Settings' && (
              <span
                className={`bottom-nav-sync-indicator ${online ? 'online' : (pendingCount > 0 ? 'pending' : 'offline')}`}
                title={online ? 'Cloud Sync Active' : (pendingCount > 0 ? `Offline (${pendingCount} queued)` : 'Offline (Synced)')}
              />
            )}
          </div>
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
