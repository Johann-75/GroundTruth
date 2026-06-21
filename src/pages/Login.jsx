import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, BarChart3, ArrowRight, Zap, Sun, Moon } from 'lucide-react';
import { saveUser } from '../services/storage';
import { ROLES } from '../utils/constants';
import './Login.css';

/**
 * Login page — role-based entry point.
 * Field officers enter their name and are routed to the visit logging flow.
 * Managers go directly to the analytics dashboard.
 * No real authentication — this is a prototype role selector.
 */
function Login() {
  
  const [selectedRole, setSelectedRole] = useState(null);
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [theme, setTheme] = useState(
    document.body.classList.contains('light-theme') ? 'light' : 'dark'
  );

  const toggleTheme = () => {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    setTheme(isLight ? 'light' : 'dark');
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setError('');
  };

  const handleContinue = async () => {
    if (!selectedRole) {
      setError('Please select your role');
      return;
    }
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsLoading(true);
    try {
      await saveUser({
        name: name.trim(),
        role: selectedRole,
        createdAt: new Date().toISOString(),
      });

      // Route based on role
      if (selectedRole === ROLES.FIELD_OFFICER) {
        navigate('/new-visit', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      console.error('Failed to save user:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && name.trim() && selectedRole) {
      handleContinue();
    }
  };

  return (
    <div className="login-page">
      <button 
        type="button"
        className="theme-toggle-btn-subtle" 
        onClick={toggleTheme}
        aria-label="Toggle theme"
        title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      {/* Background decoration */}
      <div className="login-bg-glow login-bg-glow-1" />
      <div className="login-bg-glow login-bg-glow-2" />



      <div className="login-container">

        {/* Header / Branding */}
        <div className="login-header">
          <div className="login-logo">
            <div className="login-logo-icon">
              <Zap size={28} />
            </div>
            <h1 className="login-title">GroundTruth</h1>
          </div>
          <p className="login-subtitle">
            {'Field Intelligence System by'}{' '}
            <span className="login-org-name">{'The/Nudge Institute'}</span>
          </p>
          <p className="login-description">
            {'Log field visits, capture ground reality, and surface patterns that drive better decisions across programs.'}
          </p>
        </div>

        {/* Role Selection */}
        <div className="login-roles">
          <h2 className="login-section-title">{'I am a...'}</h2>

          <div className="login-role-cards">
            {/* Field Officer Card */}
            <button
              id="role-field-officer"
              className={`login-role-card ${
                selectedRole === ROLES.FIELD_OFFICER ? 'login-role-card-active' : ''
              }`}
              onClick={() => handleRoleSelect(ROLES.FIELD_OFFICER)}
            >
              <div className="login-role-icon login-role-icon-field">
                <Users size={32} />
              </div>
              <div className="login-role-info">
                <h3>{'Field Officer'}</h3>
                <p>
                  {'I visit program sites and want to log my observations quickly.'}
                </p>
              </div>
              <div className="login-role-check">
                {selectedRole === ROLES.FIELD_OFFICER && (
                  <div className="login-check-dot" />
                )}
              </div>
            </button>

            {/* Manager Card */}
            <button
              id="role-manager"
              className={`login-role-card ${
                selectedRole === ROLES.MANAGER ? 'login-role-card-active' : ''
              }`}
              onClick={() => handleRoleSelect(ROLES.MANAGER)}
            >
              <div className="login-role-icon login-role-icon-manager">
                <BarChart3 size={32} />
              </div>
              <div className="login-role-info">
                <h3>{'Program Manager'}</h3>
                <p>
                  {'I oversee field teams and want to see patterns across visits.'}
                </p>
              </div>
              <div className="login-role-check">
                {selectedRole === ROLES.MANAGER && (
                  <div className="login-check-dot" />
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Name Input — shown after role selection */}
        {selectedRole && (
          <div className="login-name-section">
            <label htmlFor="user-name" className="login-label">
              {"What's your name?"}
            </label>
            <input
              id="user-name"
              type="text"
              className="input login-name-input"
              placeholder={
                selectedRole === ROLES.FIELD_OFFICER
                  ? 'e.g., Priya Sharma'
                  : 'e.g., Anurag Mishra'
              }
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
              autoFocus
              autoComplete="name"
            />
          </div>
        )}

        {/* Error Message */}
        {error && <p className="login-error">{error}</p>}

        {/* Continue Button */}
        {selectedRole && (
          <button
            id="login-continue"
            className="btn btn-primary login-continue-btn"
            onClick={handleContinue}
            disabled={isLoading || !name.trim()}
          >
            {isLoading ? (
              <span className="login-btn-loading">{'Setting up...'}</span>
            ) : (
              <>
                {'Continue as'}{' '}
                {selectedRole === ROLES.FIELD_OFFICER
                  ? 'Field Officer'
                  : 'Program Manager'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        )}

        {/* Footer */}
        <p className="login-footer">
          {'Empowering 1.5M+ lives across 10 states through data-driven field intelligence.'}
        </p>
      </div>
    </div>
  );
}

export default Login;
