import { useEffect } from 'react';
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
  );
}

export default App;
