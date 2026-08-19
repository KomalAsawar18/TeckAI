import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Lock, Mail, Eye, EyeOff } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import './auth.css';

const Login = () => {
  const { login, user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Smart redirection target post login
  const from = location.state?.from?.pathname || '/';

  // Already authenticated — skip the login form entirely
  React.useEffect(() => {
    if (!loading && user) {
      navigate(from, { replace: true });
    }
  }, [user, loading, navigate, from]);

  React.useEffect(() => {
    if (location.state?.message) {
      setError(location.state.message);
    }
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      const res = await login(email, password);
      if (res.success) {
        navigate(from, { replace: true, state: { justLoggedIn: true } });
      } else {
        setError(res.message || 'Incorrect email or password.');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to continue to TeckAI.</p>
        </div>

        {error && (
          <div className="auth-alert-error">
            <AlertCircle size={16} className="auth-alert-icon" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-form-group">
            <label className="auth-label" htmlFor="email">Email</label>
            <div className="auth-input-wrapper">
              <input
                id="email"
                type="email"
                className="auth-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="auth-form-group">
            <label className="auth-label" htmlFor="password">Password</label>
            <div className="auth-input-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="auth-input"
                style={{ paddingRight: '2.5rem' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          New to TeckAI?{' '}
          <Link to="/register" className="auth-footer-link">
            Create account
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

export default Login;
