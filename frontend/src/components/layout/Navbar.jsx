import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Cpu, ShoppingCart, Heart, User, Sparkles } from 'lucide-react';
import './Navbar.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

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

        {/* Mobile Hamburger Button */}
        <button className="mobile-menu-btn" onClick={toggleMenu} aria-label="Toggle navigation menu">
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
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
