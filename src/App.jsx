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
 * App — Root component with routing configuration.
 * 
 * Routes:
 * - /login        → Role selection (unauthenticated)
 * - /new-visit     → Log a new field visit (field officer)
 * - /my-visits     → Browse past visits (field officer)
 * - /visit/:id     → View visit detail + AI debrief (both roles)
 * - /dashboard     → Manager analytics dashboard (manager)
 * - /map           → Geographic analytics map (manager)
 * - /settings      → API key configuration (both roles)
 */
import { useEffect } from 'react';

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
    <BrowserRouter>
      <Routes>
        {/* Public route — login/role selection */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes — wrapped in Layout (sidebar + bottom nav) */}
        <Route element={<Layout />}>
          <Route path="/new-visit" element={<NewVisit />} />
          <Route path="/edit-visit/:id" element={<NewVisit />} />
          <Route path="/my-visits" element={<MyVisits />} />
          <Route path="/visit/:id" element={<VisitDetail />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Default redirect to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
