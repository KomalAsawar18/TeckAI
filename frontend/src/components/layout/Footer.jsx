import React from 'react';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="footer-container">
      <div className="container footer-content">
        <p className="footer-copyright">
          &copy; {currentYear} TeckAI. Built for developers, students, and engineers.
        </p>
        <p className="footer-notes text-xs">
          Demo Storefront. Real prices or retail stock not represented.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
