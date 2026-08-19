import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/common/Loader';
import './Profile.css';

const Profile = () => {
  const { user, updateProfile } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    addressLine: '',
    city: '',
    postalCode: '',
    country: ''
  });

  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        addressLine: user.defaultShippingAddress?.addressLine || '',
        city: user.defaultShippingAddress?.city || '',
        postalCode: user.defaultShippingAddress?.postalCode || '',
        country: user.defaultShippingAddress?.country || ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: '', message: '' });

    const profileData = {
      name: formData.name,
      phone: formData.phone,
      defaultShippingAddress: {
        addressLine: formData.addressLine,
        city: formData.city,
        postalCode: formData.postalCode,
        country: formData.country
      }
    };

    const result = await updateProfile(profileData);
    
    if (result.success) {
      setStatus({ type: 'success', message: 'Profile updated successfully!' });
      setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    } else {
      setStatus({ type: 'error', message: result.message || 'Failed to update profile.' });
    }
    
    setIsSubmitting(false);
  };

  if (!user) {
    return <Loader />;
  }

  // Get initials for avatar
  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const joinedDate = user.createdAt 
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Unknown';

  return (
    <div className="profile-container container">
      <div className="profile-header">
        <h1 className="profile-title">My Profile</h1>
        <p className="profile-subtitle">Manage your personal information and shipping address.</p>
      </div>

      <div className="profile-layout">
        {/* Left Sidebar (Minimal) */}
        <div className="profile-sidebar">
          <div className="profile-avatar-card">
            <div className="profile-avatar">{initials}</div>
            <div className="profile-role-badge">{user.role === 'admin' ? 'Administrator' : 'Customer'}</div>
          </div>
          
          <div className="profile-info-card">
            <p className="profile-info-label">Member since</p>
            <p className="profile-info-value">{joinedDate}</p>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="profile-content">
          <form className="profile-form" onSubmit={handleSubmit}>
            {status.message && (
              <div className={`profile-status ${status.type}`}>
                {status.message}
              </div>
            )}

            <div className="profile-section">
              <h2 className="profile-section-title">Personal Information</h2>
              <div className="profile-grid">
                <div className="form-group">
                  <label htmlFor="name">Full Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    value={user.email}
                    disabled
                    className="form-input disabled"
                    title="Email cannot be changed"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="e.g. +1 234 567 8900"
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            <div className="profile-section">
              <h2 className="profile-section-title">Default Shipping Address</h2>
              <div className="profile-grid">
                <div className="form-group full-width">
                  <label htmlFor="addressLine">Address Line</label>
                  <input
                    type="text"
                    id="addressLine"
                    name="addressLine"
                    value={formData.addressLine}
                    onChange={handleChange}
                    placeholder="Street address, P.O. box, etc."
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="city">City</label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="postalCode">Postal Code</label>
                  <input
                    type="text"
                    id="postalCode"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="country">Country</label>
                  <input
                    type="text"
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            <div className="profile-actions">
              <button 
                type="submit" 
                className="btn btn-primary profile-submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
