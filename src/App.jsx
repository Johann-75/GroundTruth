import React, { Component, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import NewVisit from './pages/NewVisit';
import MyVisits from './pages/MyVisits';
import VisitDetail from './pages/VisitDetail';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import MapPage from './pages/Map';

/**
 * ErrorBoundary - catches runtime render crashes and presents a clean recovery screen.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Uncaught application error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0F172A',
          color: '#F1F5F9',
          fontFamily: "'Inter', sans-serif",
          padding: '24px',
          textAlign: 'center'
        }}>
          <h2 style={{ marginBottom: '12px', fontSize: '24px', fontWeight: 600 }}>Something went wrong.</h2>
          <p style={{ color: '#94A3B8', marginBottom: '24px', maxWidth: '400px', fontSize: '14px', lineHeight: 1.5 }}>
            An unexpected crash occurred. Try reloading the app or clearing local browser caches.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn btn-primary" 
              onClick={() => window.location.reload()}
            >
              Reload App
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/login';
              }}
            >
              Reset Session
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * App — root component with routing configuration.
 *
 * Routes:
 * - /login        → Role selection (unauthenticated)
 * - /new-visit    → Log a new field visit (field officer)
 * - /edit-visit/:id → Edit an existing visit (field officer)
 * - /my-visits    → Browse past visits (field officer)
 * - /visit/:id    → View visit detail + AI debrief
 * - /dashboard    → Manager analytics dashboard
 * - /map          → Geographic analytics map (manager)
 * - /settings     → API key configuration
 */
function App() {
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<Layout />}>
            <Route path="/new-visit"       element={<NewVisit />} />
            <Route path="/edit-visit/:id"  element={<NewVisit />} />
            <Route path="/my-visits"       element={<MyVisits />} />
            <Route path="/visit/:id"       element={<VisitDetail />} />
            <Route path="/dashboard"       element={<Dashboard />} />
            <Route path="/map"             element={<MapPage />} />
            <Route path="/settings"        element={<Settings />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
