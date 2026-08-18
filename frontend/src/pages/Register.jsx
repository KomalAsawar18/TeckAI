import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, User, Lock, Mail } from 'lucide-react';

const Register = () => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
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
        navigate('/', { replace: true });
      } else {
        setError(res.message || 'Registration failed. Please try again.');
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
          <h1 className="text-2xl font-bold text-primary">Create Account</h1>
          <p className="text-secondary text-sm mt-1">Register for e-commerce catalog updates</p>
        </div>

        {error && (
          <div className="alert alert-danger flex align-center gap-2 p-3 mb-4 rounded text-sm text-danger bg-error-soft border-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="form-group flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary" htmlFor="name">Full Name</label>
            <div className="input-with-icon relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                id="name"
                type="text"
                className="input-control w-full pl-10"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

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
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary" htmlFor="confirmPassword">Confirm Password</label>
            <div className="input-with-icon relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                id="confirmPassword"
                type="password"
                className="input-control w-full pl-10"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-full mt-2" disabled={submitting}>
            {submitting ? 'Registering...' : 'Register'}
          </button>
        </form>

        <div className="text-center mt-6 pt-4 border-top text-xs text-secondary">
          Already have an account?{' '}
          <Link to="/login" className="text-accent-highlight font-semibold">
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
