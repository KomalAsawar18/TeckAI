import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { ArrowLeft, Calendar, Shield, MapPin, Truck, HelpCircle, Package } from 'lucide-react';
import Loader from '../components/common/Loader';
import ErrorMessage from '../components/common/ErrorMessage';
import './OrderDetails.css';

const OrderDetails = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getOrderById(id);
      if (res.success) {
        setOrder(res.data);
      } else {
        throw new Error(res.error?.message || 'Failed to retrieve order details.');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong while retrieving order details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  const getStatusColorClass = (status) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'confirmed': return 'status-confirmed';
      case 'processing': return 'status-processing';
      case 'shipped': return 'status-shipped';
      case 'delivered': return 'status-delivered';
      case 'cancelled': return 'status-cancelled';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="order-details-loading flex justify-center align-center">
        <Loader message="Loading order details..." />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container py-16">
        <ErrorMessage message={error || 'Order not found.'} onRetry={fetchOrderDetails} />
      </div>
    );
  }

  const dateStr = new Date(order.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="container py-12 fade-in">
      <div className="mb-8">
        <Link to="/orders" className="back-to-orders-link flex align-center gap-1 text-sm font-semibold mb-2">
          <ArrowLeft size={16} />
          <span>Back to Orders</span>
        </Link>
        <div className="flex align-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-primary">
              Order Details
            </h1>
            <p className="text-secondary text-sm monospace mt-1">
              ID: #{order._id.toUpperCase()}
            </p>
          </div>
          <span className={`status-badge text-sm font-bold uppercase ${getStatusColorClass(order.status)}`}>
            {order.status}
          </span>
        </div>
      </div>

      <div className="order-details-grid">
        {/* Main Items Card */}
        <div className="order-details-main flex flex-col gap-6">
          <div className="card p-6">
            <h2 className="text-lg font-bold text-primary mb-4 pb-2 border-bottom flex align-center gap-2">
              <Package size={18} className="text-accent-highlight" />
              <span>Snapshotted Items</span>
            </h2>
            <div className="flex flex-col gap-4">
              {order.items.map((item, idx) => (
                <div key={idx} className="order-details-item flex align-center justify-between gap-4 py-3 border-bottom-soft">
                  <div className="item-meta flex align-center gap-4">
                    {item.image && (
                      <img 
                        src={item.image} 
                        alt={item.name} 
                        className="details-item-img" 
                      />
                    )}
                    <div>
                      <h4 className="font-bold text-primary text-sm">{item.name}</h4>
                      <p className="text-xs text-muted monospace mt-1">SKU: {item.sku}</p>
                      {item.slug && (
                        <Link to={`/products/${item.slug}`} className="text-xs text-accent-highlight font-semibold hover:underline block mt-1">
                          View Current Product Page
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="item-pricing text-right">
                    <span className="text-sm font-bold text-primary block">
                      PKR {item.price.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted">
                      Qty: {item.quantity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info Sidebar (Shipping Address, Payment) */}
        <div className="order-details-sidebar flex flex-col gap-6">
          {/* Shipping Address */}
          <div className="card p-6">
            <h3 className="text-md font-bold text-primary mb-4 pb-2 border-bottom flex align-center gap-2">
              <MapPin size={16} className="text-accent-highlight" />
              <span>Delivery Address</span>
            </h3>
            <div className="shipping-address-details text-sm text-secondary flex flex-col gap-1">
              <span className="font-bold text-primary">{order.shippingAddress.fullName}</span>
              <span>{order.shippingAddress.addressLine}</span>
              <span>{order.shippingAddress.city}, {order.shippingAddress.postalCode}</span>
              <span>{order.shippingAddress.country}</span>
            </div>
          </div>

          {/* Payment & Summary */}
          <div className="card p-6">
            <h3 className="text-md font-bold text-primary mb-4 pb-2 border-bottom flex align-center gap-2">
              <Truck size={16} className="text-accent-highlight" />
              <span>Summary & Payment</span>
            </h3>
            <div className="flex flex-col gap-3 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-secondary">Date Placed</span>
                <span className="font-semibold text-primary">{dateStr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Method</span>
                <span className="font-semibold text-primary">{order.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Tax / Shipping</span>
                <span className="font-semibold text-success">Free</span>
              </div>
            </div>
            <div className="border-top pt-4 flex justify-between align-center font-bold text-md text-primary">
              <span>Amount Paid</span>
              <span>PKR {order.subtotal.toLocaleString()}</span>
            </div>
          </div>

          <div className="card p-4 flex align-center gap-3 text-xs text-muted">
            <Shield size={14} className="flex-shrink-0" />
            <span>Immutable history snapshot values cached successfully</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;
