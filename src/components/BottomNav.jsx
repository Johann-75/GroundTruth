import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../utils/constants';
import './BottomNav.css';

/**
 * Mobile bottom navigation bar (visible at < 768px).
 */
export default function BottomNav({ role, online, pendingCount }) {
  const items = NAV_ITEMS[role] ?? NAV_ITEMS.field_officer;

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
          <div className="bottom-nav-icon-wrapper">
            <Icon size={22} className="bottom-nav-icon" />
            {label === 'Settings' && (
              <span
                className={`bottom-nav-sync-indicator ${
                  online ? 'online' : pendingCount > 0 ? 'pending' : 'offline'
                }`}
                title={
                  online
                    ? 'Cloud Sync Active'
                    : pendingCount > 0
                    ? `Offline (${pendingCount} queued)`
                    : 'Offline (Synced)'
                }
              />
            )}
          </div>
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
