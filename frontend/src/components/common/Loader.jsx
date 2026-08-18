import React from 'react';
import './Loader.css';

const Loader = ({ message = 'Loading catalog...' }) => {
  return (
    <div className="loader-container" role="status" aria-live="polite">
      <div className="spinner"></div>
      <p className="loader-message text-sm text-secondary">{message}</p>
    </div>
  );
};

export default Loader;
