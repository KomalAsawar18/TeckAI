import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, Cpu, ShoppingCart, Heart, User, Sparkles, Sun, Moon, ChevronDown, LogOut, Package } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const [isOpen, setIsOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const navigate = useNavigate();
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

  const handleAiAssistantClick = (e) => {
    if (!user) {
      e.preventDefault();
      // Redirect to login page with prompt message
      navigate('/login', {
        state: {
          from: { pathname: '/ai-assistant' },
          message: 'Please sign in to use the AI Shopping Assistant.'
        }
      });
    }
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
          {user ? (
            /* Authenticated Nav Links */
            <>
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
              
              <NavLink to="/wishlist" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} title="Wishlist">
                <Heart size={14} className="icon-spacing" />
                {wishlistCount > 0 && <span className="wishlist-badge-count">{wishlistCount}</span>}
              </NavLink>
              <NavLink to="/cart" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} title="Shopping Cart">
                <ShoppingCart size={14} className="icon-spacing" />
                {cartCount > 0 && <span className="cart-badge-count">{cartCount}</span>}
              </NavLink>
              
              <div className="flex align-center gap-4 ml-4">
                {user.role === 'admin' && (
                  <NavLink to="/admin" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} style={{ color: 'var(--color-error)', fontWeight: 'bold' }}>
                    Admin Area
                  </NavLink>
                )}
                
                <div className="user-dropdown-container">
                  <button 
                    className="user-dropdown-btn" 
                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  >
                    <User size={16} />
                    <span>{user.name.split(' ')[0]}</span>
                    <ChevronDown size={14} className={`dropdown-arrow ${isUserDropdownOpen ? 'open' : ''}`} />
                  </button>
                  
                  {isUserDropdownOpen && (
                    <>
                      <div 
                        className="dropdown-overlay" 
                        onClick={() => setIsUserDropdownOpen(false)}
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 199 }}
                      />
                      <div className="user-dropdown-menu" style={{ position: 'absolute', zIndex: 200 }}>
                        <Link to="/profile" className="dropdown-item" onClick={() => setIsUserDropdownOpen(false)}>
                          <User size={16} />
                          <span>My Profile</span>
                        </Link>
                        <Link to="/orders" className="dropdown-item" onClick={() => setIsUserDropdownOpen(false)}>
                          <Package size={16} />
                          <span>My Orders</span>
                        </Link>
                        <div className="dropdown-divider"></div>
                        <button 
                          className="dropdown-item logout-action"
                          onClick={() => { setIsUserDropdownOpen(false); logout(); navigate('/login'); }}
                        >
                          <LogOut size={16} />
                          <span>Logout</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Unauthenticated Nav Links */
            <>
              <NavLink to="/" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                Home
              </NavLink>
              <NavLink to="/products" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                Products
              </NavLink>
              <NavLink to="/ai-assistant" onClick={handleAiAssistantClick} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                <Sparkles size={14} className="icon-spacing" />
                AI Assistant
              </NavLink>
              <NavLink to="/login" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                <User size={14} className="icon-spacing" />
                Login
              </NavLink>
              <NavLink to="/register" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                Sign Up
              </NavLink>
            </>
          )}
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
            {user ? (
              /* Authenticated Mobile Links */
              <>
                <Link to="/" onClick={toggleMenu} className="mobile-nav-link">
                  Home
                </Link>
                <Link to="/products" onClick={toggleMenu} className="mobile-nav-link">
                  Products
                </Link>
                <Link to="/ai-assistant" onClick={toggleMenu} className="mobile-nav-link">
                  AI Assistant
                </Link>
                <Link to="/wishlist" onClick={toggleMenu} className="mobile-nav-link flex align-center gap-2">
                  Wishlist {wishlistCount > 0 && <span className="wishlist-badge-count-mobile">{wishlistCount}</span>}
                </Link>
                <Link to="/cart" onClick={toggleMenu} className="mobile-nav-link flex align-center gap-2">
                  Cart {cartCount > 0 && <span className="cart-badge-count-mobile">{cartCount}</span>}
                </Link>
                <Link to="/profile" onClick={toggleMenu} className="mobile-nav-link flex align-center gap-2">
                  <User size={14} />
                  <span>My Profile</span>
                </Link>
                <Link to="/orders" onClick={toggleMenu} className="mobile-nav-link flex align-center gap-2">
                  <Package size={14} />
                  <span>My Orders</span>
                </Link>
                {user.role === 'admin' && (
                  <Link to="/admin" onClick={toggleMenu} className="mobile-nav-link" style={{ color: 'var(--color-error)', fontWeight: 'bold' }}>
                    Admin Area
                  </Link>
                )}
                <button 
                  className="mobile-nav-link btn-link text-left" 
                  onClick={() => { logout(); toggleMenu(); navigate('/login'); }} 
                  style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}
                >
                  Logout
                </button>
              </>
            ) : (
              /* Unauthenticated Mobile Links */
              <>
                <Link to="/" onClick={toggleMenu} className="mobile-nav-link">
                  Home
                </Link>
                <Link to="/products" onClick={toggleMenu} className="mobile-nav-link">
                  Products
                </Link>
                <Link to="/ai-assistant" onClick={(e) => { handleAiAssistantClick(e); toggleMenu(); }} className="mobile-nav-link">
                  AI Assistant
                </Link>
                <Link to="/login" onClick={toggleMenu} className="mobile-nav-link">
                  Login
                </Link>
                <Link to="/register" onClick={toggleMenu} className="mobile-nav-link">
                  Sign Up
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
