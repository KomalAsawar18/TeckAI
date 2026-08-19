import React from 'react';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="footer-container">
      <div className="container footer-content">
        <p className="footer-copyright">
          &copy; {currentYear} Komal Asawar. TeckAI. All rights reserved.
        </p>
        <p className="footer-notes text-xs">
          Smarter Tech. Better Choices. Powered by AI.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
