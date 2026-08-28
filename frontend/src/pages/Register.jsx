import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import './auth.css';

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const Register = () => {
  const { register, user, loading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  // Already authenticated — go to home
  React.useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (!PASSWORD_REGEX.test(password)) {
      setError(
        'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
      );
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      const res = await register(name.trim(), email.trim(), password);
      if (res.success) {
        navigate('/', { replace: true, state: { justRegistered: true } });
      } else {
        setError(res.message || 'Registration failed. Please try again.');
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
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-subtitle">Register to explore curated developer gear</p>
        </div>

        {error && (
          <div className="auth-alert-error">
            <AlertCircle size={16} className="auth-alert-icon" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-form-group">
            <label className="auth-label" htmlFor="name">Name</label>
            <div className="auth-input-wrapper">
              <input
                id="name"
                type="text"
                className="auth-input"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

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
                placeholder="Minimum 8 chars, uppercase, lowercase, number & symbol"
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

          <div className="auth-form-group">
            <label className="auth-label" htmlFor="confirmPassword">Confirm Password</label>
            <div className="auth-input-wrapper">
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                className="auth-input"
                style={{ paddingRight: '2.5rem' }}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" className="auth-footer-link">
            Sign In
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

export default Register;
