import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Loader from './Loader';

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex justify-center align-center h-screen">
        <Loader />
      </div>
    );
  }

  // Authoritative protection block
  if (!user || user.role !== 'admin') {
    // Redirect to home if unauthenticated or not an admin
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AdminRoute;
