import React from 'react';
import { Cpu, Sparkles, ShoppingCart, Target } from 'lucide-react';
import '../../pages/auth.css';

const AuthLayout = ({ children }) => {
  return (
    <div className="auth-split-layout fade-in">
      {/* Left Branding Panel */}
      <div className="auth-left-panel">
        <div className="auth-brand-content">
          <div className="auth-badge">
            <Sparkles size={14} className="auth-badge-icon" />
            <span>AI-POWERED TECH SHOPPING</span>
          </div>

          <h1 className="auth-brand-headline">
            Find Smarter.<br />
            Compare Faster.<br />
            <span className="auth-highlight-text">Shop Better.</span>
          </h1>

          <p className="auth-brand-subtitle">
            Your intelligent shopping companion for discovering, comparing and choosing the right technology for your needs.
          </p>

          <div className="auth-features">
            <div className="auth-feature-chip">
              <Cpu size={16} />
              <span>AI Shopping Assistant</span>
            </div>
            <div className="auth-feature-chip">
              <Target size={16} />
              <span>Smart Comparisons</span>
            </div>
            <div className="auth-feature-chip">
              <ShoppingCart size={16} />
              <span>Grounded Catalog Results</span>
            </div>
          </div>
        </div>

        <div className="auth-brand-footer">
          By Komal Asawar
        </div>
      </div>

      {/* Right Auth Card Panel */}
      <div className="auth-right-panel">
        {children}
      </div>
    </div>
  );
};

export default AuthLayout;
