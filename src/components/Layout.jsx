import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
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
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);
  const navigate = useNavigate();
  const syncInitializedRef = useRef(false);

  // Load user session on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const session = await getUser();
        if (!session) {
          navigate('/login', { replace: true });
        } else {
          setUser(session);
        }
      } catch (err) {
        console.error('[Layout] Failed to load session:', err);
        navigate('/login', { replace: true });
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [navigate]);

  // Sync state helpers
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await getPendingSyncCount();
      setPendingCount(count);
    } catch (err) {
      console.error('[Layout] Failed to update pending sync count:', err);
    }
  }, []);

  const handleSyncCompleted = useCallback(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  // Initial sync and event listeners setup
  useEffect(() => {
    if (loading || !user) return;

    updatePendingCount();

    // Prevent duplicate listener setups
    if (syncInitializedRef.current) return;
    syncInitializedRef.current = true;

    // Listen for manual/background sync completes to refresh UI badge count
    window.addEventListener('sync-completed', handleSyncCompleted);

    // Monitor connectivity changes
    const handleOnline = () => {
      setOnline(true);
      // Automatically attempt background sync when connection is restored
      syncAll().catch((err) => console.error('[Layout] syncAll failed:', err));
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial background sync run
    if (navigator.onLine) {
      syncAll().catch((err) => console.error('[Layout] Initial syncAll failed:', err));
    }

    // Initialize custom intervals for standard sync scheduling
    const cleanupSync = initSyncListeners();

    return () => {
      window.removeEventListener('sync-completed', handleSyncCompleted);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      cleanupSync();
      syncInitializedRef.current = false;
    };
  }, [loading, user, updatePendingCount, handleSyncCompleted]);

  const handleLogout = async () => {
    try {
      await clearUser();
      setUser(null);
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('[Layout] Failed to logout:', err);
    }
  };

  if (loading) {
    return (
      <div className="layout-loading flex-center flex-col">
        <div className="spinner" aria-label="Loading app session"></div>
        <p style={{ marginTop: 'var(--space-md)', color: 'var(--color-text-muted)' }}>
          Verifying secure session...
        </p>
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
        online={online}
        pendingCount={pendingCount}
      />
      <BottomNav
        role={user.role}
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
