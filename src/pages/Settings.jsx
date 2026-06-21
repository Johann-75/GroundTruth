import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Settings as SettingsIcon, Key, AlertTriangle, Trash2,
  Database, LogOut, Info, Download, CloudLightning, RefreshCw,
  Sun, Moon
} from 'lucide-react';
import {
  getStorageStats,
  clearAllData,
  clearUser
} from '../services/storage';

import { syncAll, getPendingSyncCount } from '../services/sync';
import { isSupabaseConfigured } from '../services/supabase';
import './Settings.css';


/**
 * Settings page — app info and data controls.
 */
function Settings() {
  const navigate = useNavigate();
  const { user } = useOutletContext();
  
  const [stats, setStats] = useState(null);
  const [isClearing, setIsClearing] = useState(false);

  const [theme, setTheme] = useState(
    document.body.classList.contains('light-theme') ? 'light' : 'dark'
  );

  const toggleTheme = () => {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    setTheme(isLight ? 'light' : 'dark');
  };

  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    loadStats();
    updatePendingCount();

    const handleSyncCompleted = () => {
      updatePendingCount();
      loadStats();
    };

    window.addEventListener('sync-completed', handleSyncCompleted);
    return () => {
      window.removeEventListener('sync-completed', handleSyncCompleted);
    };
  }, []);

  const loadStats = async () => {
    const s = await getStorageStats();
    setStats(s);
  };

  const updatePendingCount = async () => {
    const count = await getPendingSyncCount();
    setPendingCount(count);
  };

  const handleForceSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncError('');
    try {
      const res = await syncAll();
      if (!res.success) {
        if (res.reason === 'offline_or_not_configured') {
          setSyncError('Cannot sync: Device is offline or Supabase is not configured.');
        } else {
          setSyncError('Sync failed. Please check your network connection.');
        }
      }
      await updatePendingCount();
      await loadStats();
    } catch (err) {
      console.error('Manual sync failed:', err);
      setSyncError('Sync failed due to an unexpected error.');
    } finally {
      setIsSyncing(false);
    }
  };


  const handleClearData = async () => {
    if (!window.confirm('Are you sure you want to clear ALL data? This cannot be undone.')) {
      return;
    }
    setIsClearing(true);
    try {
      await clearAllData();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Failed to clear data:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleLogout = async () => {
    await clearUser();
    navigate('/login', { replace: true });
  };



  return (
    <div className="settings-page">
      <div className="settings-header">
        <SettingsIcon size={24} />
        <h1>{'Settings'}</h1>
      </div>



      <div className="settings-grid">
        {/* Display Theme */}
        <div className="settings-section card">
          <div className="settings-section-header">
            {theme === 'dark' ? (
              <Moon size={20} className="settings-section-icon" style={{ color: 'var(--color-primary-light)' }} />
            ) : (
              <Sun size={20} className="settings-section-icon" style={{ color: 'var(--color-warning)' }} />
            )}
            <div>
              <h3>{'Display Theme'}</h3>
              <p className="settings-section-desc">
                {'Toggle between dark slate and light clean theme modes.'}
              </p>
            </div>
          </div>
          <div className="settings-actions" style={{ marginTop: 'var(--space-md)' }}>
            <button className="btn btn-secondary" onClick={toggleTheme}>
              {theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            </button>
          </div>
        </div>

        {/* AI Service Status */}
        <div className="settings-section card">
          <div className="settings-section-header">
            <Key size={20} className="settings-section-icon" />
            <div>
              <h3>{'AI Service Status'}</h3>
              <p className="settings-section-desc">
                {'AI debriefs and voice transcriptions are powered by the Groq API.'}
              </p>
            </div>
          </div>

          <div className="api-key-status-row" style={{ marginTop: 'var(--space-md)' }}>
            {import.meta.env.VITE_GROQ_API_KEY ? (
              <span className="api-key-status api-key-status-configured">
                <span className="api-key-status-dot" style={{ backgroundColor: 'var(--color-accent)' }} />
                {'Active (Configured via VITE_GROQ_API_KEY env)'}
              </span>
            ) : (
              <span className="api-key-status api-key-status-missing">
                <span className="api-key-status-dot" style={{ backgroundColor: 'var(--color-warning)' }} />
                {'Not configured (VITE_GROQ_API_KEY is not set) — AI features are disabled'}
              </span>
            )}
          </div>
        </div>

        {/* About */}
        <div className="settings-section card">
          <div className="settings-section-header">
            <Info size={20} className="settings-section-icon" />
            <div>
              <h3>{'About'}</h3>
            </div>
          </div>
          <div className="settings-about">
            <div className="settings-about-row">
              <span className="settings-about-label">{'App'}</span>
              <span className="settings-about-value">GroundTruth v1.0.0</span>
            </div>
            <div className="settings-about-row">
              <span className="settings-about-label">{'Purpose'}</span>
              <span className="settings-about-value">{'Field Intelligence System'}</span>
            </div>
            <div className="settings-about-row">
              <span className="settings-about-label">{'Organization'}</span>
              <span className="settings-about-value">{'The/Nudge Institute'}</span>
            </div>
            <div className="settings-about-row">
              <span className="settings-about-label">{'Built with'}</span>
              <span className="settings-about-value">React · Groq AI · Recharts</span>
            </div>
            <div className="settings-about-row">
              <span className="settings-about-label">{'Logged in as'}</span>
              <span className="settings-about-value">
                {user?.name} ({user?.role === 'field_officer' ? 'Field Officer' : 'Program Manager'})
              </span>
            </div>
          </div>
        </div>

        {/* Central Synchronization */}
        <div className="settings-section card">
          <div className="settings-section-header">
            <CloudLightning size={20} className="settings-section-icon" />
            <div>
              <h3>{'Supabase Sync'}</h3>
              <p className="settings-section-desc">
                {'Manually trigger synchronization with the central cloud database.'}
              </p>
            </div>
          </div>

          <div className="sync-status-settings-row" style={{ marginBottom: 'var(--space-md)' }}>
            <div className="api-key-status-row" style={{ margin: 0 }}>
              {isSupabaseConfigured() ? (
                <span className="api-key-status api-key-status-configured">
                  <span className="api-key-status-dot" style={{ backgroundColor: 'var(--color-accent)' }} />
                  {'Supabase is connected'}
                </span>
              ) : (
                <span className="api-key-status api-key-status-missing">
                  <span className="api-key-status-dot" style={{ backgroundColor: 'var(--color-warning)' }} />
                  {'Supabase not configured (using local-only mode)'}
                </span>
              )}
            </div>
            {pendingCount > 0 && (
              <p className="sync-pending-count-text" style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                {`${pendingCount} visit(s) waiting to sync.`}
              </p>
            )}
            {syncError && (
              <p className="sync-error-text" style={{ fontSize: '0.82rem', color: 'var(--color-danger)', marginTop: '4px' }}>
                {syncError}
              </p>
            )}
          </div>

          <div className="settings-actions">
            <button
              className="btn btn-primary"
              onClick={handleForceSync}
              disabled={isSyncing || !isSupabaseConfigured()}
            >
              <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Syncing...' : 'Force Sync Now'}
            </button>
          </div>
        </div>

        {/* Data Management */}
        <div className="settings-section card">
          <div className="settings-section-header">
            <Database size={20} className="settings-section-icon" />
            <div>
              <h3>{'Data Management'}</h3>
              <p className="settings-section-desc">
                {'Manage stored local visit data.'}
              </p>
            </div>
          </div>

          {stats && (
            <div className="settings-stats">
              <div className="settings-stat-item">
                <span className="settings-stat-value">{stats.visitCount}</span>
                <span className="settings-stat-label">{'Visits'}</span>
              </div>
            </div>
          )}

          <div className="settings-actions settings-actions-data">
            <button
              className="btn btn-danger"
              onClick={handleClearData}
              disabled={isClearing}
            >
              <Trash2 size={16} />
              {isClearing ? 'Clearing...' : 'Clear All Data'}
            </button>
            <button className="btn btn-ghost" onClick={handleLogout}>
              <LogOut size={16} />
              {'Logout'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
