import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { api } from '../services/api';
import { ArrowLeft, Shield, MapPin, Truck, AlertCircle } from 'lucide-react';
import Loader from '../components/common/Loader';
import './Checkout.css';

const Checkout = () => {
  const { cartItems, cartSubtotal, clearCartLocally, loading: cartLoading } = useCart();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('Pakistan');
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Redirect if cart is empty
  useEffect(() => {
    if (!cartLoading && cartItems.length === 0) {
      navigate('/cart');
    }
  }, [cartItems, cartLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || !addressLine.trim() || !city.trim() || !postalCode.trim() || !country.trim()) {
      setError('Please fill in all shipping address fields.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const shippingAddress = {
        fullName: fullName.trim(),
        addressLine: addressLine.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        country: country.trim()
      };

      const res = await api.createOrder(shippingAddress);
      if (res.success) {
        // Clear cart locally immediately to update navbar badges
        clearCartLocally();
        // Redirect to orders history screen
        navigate('/orders', { state: { justOrdered: true } });
      } else {
        setError(res.error?.message || 'Failed to place order. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please check stock and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (cartLoading || cartItems.length === 0) {
    return (
      <div className="checkout-loading-container flex justify-center align-center">
        <Loader message="Loading checkout details..." />
      </div>
    );
  }

  return (
    <div className="container py-12 fade-in">
      <div className="mb-8">
        <Link to="/cart" className="back-to-cart-link flex align-center gap-1 text-sm font-semibold mb-2">
          <ArrowLeft size={16} />
          <span>Back to Cart</span>
        </Link>
        <h1 className="text-2xl font-bold text-primary">Shipping & Checkout</h1>
        <p className="text-secondary text-sm">Please provide shipping details and complete checkout</p>
      </div>

      {error && (
        <div className="checkout-error-banner card p-4 mb-6 flex align-center gap-3">
          <AlertCircle size={20} className="text-error" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}

      <div className="checkout-grid">
        {/* Shipping Form */}
        <div className="shipping-form-section">
          <form onSubmit={handleSubmit} className="card p-6 flex flex-col gap-5">
            <h2 className="text-lg font-bold text-primary flex align-center gap-2 border-bottom pb-3">
              <MapPin size={18} className="text-accent-highlight" />
              <span>Shipping Address</span>
            </h2>

            <div className="form-group flex flex-col gap-2">
              <label htmlFor="fullName" className="text-xs font-semibold uppercase tracking-wider text-secondary">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                className="input-text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group flex flex-col gap-2">
              <label htmlFor="addressLine" className="text-xs font-semibold uppercase tracking-wider text-secondary">
                Address Line
              </label>
              <input
                id="addressLine"
                type="text"
                className="input-text"
                placeholder="Flat / House No, Street Address"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group flex flex-col gap-2">
                <label htmlFor="city" className="text-xs font-semibold uppercase tracking-wider text-secondary">
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  className="input-text"
                  placeholder="Silicon Valley"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group flex flex-col gap-2">
                <label htmlFor="postalCode" className="text-xs font-semibold uppercase tracking-wider text-secondary">
                  Postal Code
                </label>
                <input
                  id="postalCode"
                  type="text"
                  className="input-text"
                  placeholder="94043"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="form-group flex flex-col gap-2">
              <label htmlFor="country" className="text-xs font-semibold uppercase tracking-wider text-secondary">
                Country
              </label>
              <input
                id="country"
                type="text"
                className="input-text"
                placeholder="Pakistan"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <h2 className="text-lg font-bold text-primary flex align-center gap-2 border-bottom pb-3 mt-4">
              <Truck size={18} className="text-accent-highlight" />
              <span>Payment Option</span>
            </h2>

            <div className="payment-options-box card p-4 flex align-center justify-between">
              <div className="payment-details">
                <span className="font-semibold text-primary block text-sm">Cash on Delivery (COD)</span>
                <span className="text-xs text-muted">Pay with cash when items are delivered to your doorstep.</span>
              </div>
              <input
                type="radio"
                name="paymentMethod"
                defaultChecked
                disabled
                className="accent-radio"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary py-3 w-full mt-2"
              disabled={submitting}
            >
              {submitting ? 'Processing order...' : 'Place Order'}
            </button>
          </form>
        </div>

        {/* Order Items Preview Sidebar */}
        <div className="checkout-summary-section">
          <div className="card p-6 sticky-summary">
            <h2 className="text-lg font-bold text-primary mb-4 pb-2 border-bottom">
              Items in Order
            </h2>

            <div className="checkout-items-list flex flex-col gap-4 max-h-96 overflow-y-auto mb-6 pr-2">
              {cartItems.map((item) => {
                const product = item.product;
                return (
                  <div key={product._id} className="checkout-item-preview flex align-center justify-between gap-3">
                    <div className="item-detail flex align-center gap-3">
                      {product.image && (
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          className="item-preview-img" 
                        />
                      )}
                      <div>
                        <span className="font-semibold text-primary block text-xs truncate max-w-40">{product.name}</span>
                        <span className="text-muted text-xs block">Qty: {item.quantity}</span>
                      </div>
                    </div>
                    <span className="font-bold text-primary text-xs">
                      PKR {(product.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="checkout-totals border-top pt-4">
              <div className="flex justify-between text-secondary text-sm mb-2">
                <span>Items Subtotal</span>
                <span>PKR {cartSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-secondary text-sm mb-4">
                <span>Shipping Delivery</span>
                <span className="text-accent-highlight font-semibold">Free Delivery</span>
              </div>
              <div className="flex justify-between align-center font-bold text-md border-top pt-4 text-primary">
                <span>Order Total</span>
                <span>PKR {cartSubtotal.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex align-center gap-2 justify-center mt-6 text-xs text-muted">
              <Shield size={14} />
              <span>Transactional checkout revalidation active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
