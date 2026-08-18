import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Cpu, ShoppingCart, Heart, User, Sparkles, Sun, Moon } from 'lucide-react';
import './Navbar.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    return document.documentElement.getAttribute('data-theme') || 'light';
  });

  const toggleMenu = () => setIsOpen(!isOpen);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  return (
    <header className="navbar-header">
      <div className="container navbar-container">
        <Link to="/" className="navbar-logo">
          <Cpu className="logo-icon" />
          <span>Teck<span className="logo-accent">AI</span></span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="desktop-nav">
          <NavLink to="/" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            Home
          </NavLink>
          <NavLink to="/products" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            Products
          </NavLink>
          <NavLink to="/ai-assistant" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            <Sparkles size={14} className="icon-spacing" />
            AI Assistant
          </NavLink>
          
          {/* Upcoming / Disabled Links */}
          <span className="nav-link disabled" title="Wishlist - Coming Soon">
            <Heart size={14} />
          </span>
          <span className="nav-link disabled" title="Cart - Coming Soon">
            <ShoppingCart size={14} />
          </span>
          <span className="nav-link disabled" title="Account - Coming Soon">
            <User size={14} />
          </span>
        </nav>

        {/* Navbar Actions Wrapper (Theme Toggle & Mobile Menu) */}
        <div className="navbar-actions flex align-center gap-4">
          <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle light and dark theme">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          
          <button className="mobile-menu-btn" onClick={toggleMenu} aria-label="Toggle navigation menu">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {isOpen && (
        <div className="mobile-nav-drawer">
          <nav className="mobile-nav-links container">
            <Link to="/" onClick={toggleMenu} className="mobile-nav-link">
              Home
            </Link>
            <Link to="/products" onClick={toggleMenu} className="mobile-nav-link">
              Products
            </Link>
            <Link to="/ai-assistant" onClick={toggleMenu} className="mobile-nav-link">
              AI Assistant
            </Link>
            <div className="mobile-nav-link disabled">
              Wishlist (Soon)
            </div>
            <div className="mobile-nav-link disabled">
              Cart (Soon)
            </div>
            <div className="mobile-nav-link disabled">
              Account (Soon)
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
