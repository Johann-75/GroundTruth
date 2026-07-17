import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { getUser, clearUser } from '../services/storage';
import { getPendingSyncCount, syncAll, initSyncListeners } from '../services/sync';
import './Layout.css';

/**
 * Layout — wraps all authenticated pages.
 * Renders sidebar on desktop, bottom nav on mobile.
 * Redirects to /login if no user session found.
 */
function Layout() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const syncInitializedRef = useRef(false);

  // Load user session on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await getUser();
        if (!userData) {
          navigate('/login', { replace: true });
          return;
        }
        setUser(userData);
      } catch (err) {
        console.error('[Layout] Failed to load user:', err);
        navigate('/login', { replace: true });
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [navigate]);

  // Set dynamic body class themes based on user role
  useEffect(() => {
    if (user) {
      if (user.role === 'field_officer') {
        document.body.classList.add('theme-green');
        document.body.classList.remove('theme-blue');
      } else {
        document.body.classList.add('theme-blue');
        document.body.classList.remove('theme-green');
      }
    } else {
      document.body.classList.remove('theme-green', 'theme-blue');
    }
    return () => {
      document.body.classList.remove('theme-green', 'theme-blue');
    };
  }, [user]);

  // Initialise sync listeners and pending count tracking (once user is loaded)
  useEffect(() => {
    if (!user) return;

    // Kick off initial sync
    syncAll().catch((err) => console.error('[Layout] syncAll failed:', err));

    // Register background sync event listeners (online / focus) once
    if (!syncInitializedRef.current) {
      syncInitializedRef.current = true;
      initSyncListeners();
    }

    const updatePendingCount = async () => {
      const count = await getPendingSyncCount();
      setPendingCount(count);
    };

    const handleStatusChange = () => {
      setOnline(navigator.onLine);
      updatePendingCount();
    };

    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    window.addEventListener('sync-completed', handleStatusChange);

    updatePendingCount();

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
      window.removeEventListener('sync-completed', handleStatusChange);
    };
  }, [user]);

  const handleLogout = useCallback(async () => {
    await clearUser();
    document.body.classList.remove('theme-green', 'theme-blue');
    navigate('/login', { replace: true });
  }, [navigate]);

  if (loading) {
    return (
      <div className="layout-loading">
        <div className="loading-pulse" />
        <p>Loading GroundTruth...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="layout">
      <Sidebar
        role={user.role}
        userName={user.name}
        onLogout={handleLogout}
        currentPath={location.pathname}
        online={online}
        pendingCount={pendingCount}
      />
      <BottomNav
        role={user.role}
        userName={user.name}
        currentPath={location.pathname}
        online={online}
        pendingCount={pendingCount}
      />
      <main className="layout-main">
        <Outlet context={{ user, setUser }} />
      </main>
    </div>
  );
}

export default Layout;
