import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { getUser, clearUser } from '../services/storage';
import { getPendingSyncCount, syncAll } from '../services/sync';
import './Layout.css';

/**
 * Layout component — wraps all authenticated pages.
 * Renders sidebar on desktop, bottom nav on mobile.
 * Redirects to login if no user session exists.
 */
function Layout() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  
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
        console.error('Failed to load user:', err);
        navigate('/login', { replace: true });
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    // Trigger background sync on session initialization
    syncAll().catch(err => console.error('[Layout] syncAll failed:', err));

    const handleStatusChange = () => {
      setOnline(navigator.onLine);
      updatePendingCount();
    };

    const updatePendingCount = async () => {
      const count = await getPendingSyncCount();
      setPendingCount(count);
    };

    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    window.addEventListener('sync-completed', handleStatusChange);
    
    // Check pending count periodically
    const interval = setInterval(updatePendingCount, 10000);

    updatePendingCount();

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
      window.removeEventListener('sync-completed', handleStatusChange);
      clearInterval(interval);
    };
  }, [user]);

  const handleLogout = async () => {
    await clearUser();
    navigate('/login', { replace: true });
  };

  if (loading) {
    return (
      <div className="layout-loading">
        <div className="loading-pulse" />
        <p>{'Loading GroundTruth...'}</p>
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
