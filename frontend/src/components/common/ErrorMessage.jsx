import React from 'react';
import './ErrorMessage.css';
import { AlertCircle } from 'lucide-react';

const ErrorMessage = ({ message = 'Failed to load data', onRetry }) => {
  return (
    <div className="error-container" role="alert">
      <AlertCircle className="error-icon" size={24} />
      <div className="error-content">
        <p className="error-message text-sm font-semibold">{message}</p>
        {onRetry && (
          <button className="btn btn-secondary btn-retry text-xs" onClick={onRetry}>
            Retry Request
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;
