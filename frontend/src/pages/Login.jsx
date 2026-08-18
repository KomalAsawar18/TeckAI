import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Lock, Mail } from 'lucide-react';

const Login = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Smart redirection target post login
  const from = location.state?.from?.pathname || '/';

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
        navigate(from, { replace: true });
      } else {
        setError(res.message || 'Login failed. Please verify credentials.');
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-16 flex justify-center fade-in">
      <div className="card p-8 w-full max-w-md shadow-lg border">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-primary">Sign In</h1>
          <p className="text-secondary text-sm mt-1">Access your TeckAI account</p>
        </div>

        {error && (
          <div className="alert alert-danger flex align-center gap-2 p-3 mb-4 rounded text-sm text-danger bg-error-soft border-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="form-group flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary" htmlFor="email">Email Address</label>
            <div className="input-with-icon relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                id="email"
                type="email"
                className="input-control w-full pl-10"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary" htmlFor="password">Password</label>
            <div className="input-with-icon relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                id="password"
                type="password"
                className="input-control w-full pl-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-full mt-2" disabled={submitting}>
            {submitting ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="text-center mt-6 pt-4 border-top text-xs text-secondary">
          Don't have an account?{' '}
          <Link to="/register" className="text-accent-highlight font-semibold">
            Create one here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
