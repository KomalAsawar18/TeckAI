import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { Calendar, ShoppingBag, Eye, CheckCircle2, ChevronRight, Package, AlertCircle } from 'lucide-react';
import Loader from '../components/common/Loader';
import ErrorMessage from '../components/common/ErrorMessage';
import './Orders.css';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const location = useLocation();
  const justOrdered = location.state?.justOrdered;

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getUserOrders();
      if (res.success) {
        setOrders(res.data);
      } else {
        throw new Error(res.error?.message || 'Failed to retrieve orders.');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong while fetching orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Clear location state so refreshes don't show the order success banner
    if (location.state?.justOrdered) {
      window.history.replaceState({}, document.title);
    }
  }, []);

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
      <div className="orders-loading-container flex justify-center align-center">
        <Loader message="Fetching your order logs..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-16">
        <ErrorMessage message={error} onRetry={fetchOrders} />
      </div>
    );
  }

  return (
    <div className="container py-12 fade-in">
      {justOrdered && (
        <div className="checkout-success-banner card p-5 mb-8 flex align-center gap-4">
          <CheckCircle2 size={36} className="text-success" />
          <div>
            <h3 className="text-md font-bold text-success">Order Placed Successfully!</h3>
            <p className="text-xs text-secondary mt-1">
              Thank you for shopping with TeckAI. Your order has been registered and is pending verification.
            </p>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary">My Orders</h1>
        <p className="text-secondary text-sm">Track shipping status and view invoice archives</p>
      </div>

      {orders.length === 0 ? (
        <div className="orders-empty-card max-w-md mx-auto card p-8 text-center flex flex-col align-center">
          <Package size={48} className="text-muted mb-4" />
          <h2 className="text-lg font-bold text-primary mb-2">No Orders Placed Yet</h2>
          <p className="text-secondary text-sm mb-6">
            You haven't checked out any tech equipment yet. Describe your workload to TeckAI or browse the catalog.
          </p>
          <div className="flex gap-4">
            <Link to="/products" className="btn btn-primary">Browse Catalog</Link>
            <Link to="/ai-assistant" className="btn btn-secondary">Ask AI</Link>
          </div>
        </div>
      ) : (
        <div className="orders-list-wrapper flex flex-col gap-5">
          {orders.map((order) => {
            const dateStr = new Date(order.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });

            return (
              <div key={order._id} className="card order-row-card p-5 flex flex-col gap-4">
                {/* Row Header */}
                <div className="order-row-header flex align-center justify-between gap-4">
                  <div className="order-meta-info flex align-center gap-6">
                    <div>
                      <span className="text-xs text-muted block uppercase font-semibold">Order ID</span>
                      <span className="text-sm font-bold text-primary monospace">#{order._id.substring(order._id.length - 8).toUpperCase()}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted block uppercase font-semibold">Date Placed</span>
                      <span className="text-sm text-secondary flex align-center gap-1 font-semibold">
                        <Calendar size={14} />
                        {dateStr}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted block uppercase font-semibold">Subtotal</span>
                      <span className="text-sm font-bold text-primary">PKR {order.subtotal.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="order-actions-info flex align-center gap-4">
                    <span className={`status-badge text-xs font-bold uppercase ${getStatusColorClass(order.status)}`}>
                      {order.status}
                    </span>
                    <Link to={`/orders/${order._id}`} className="btn btn-secondary btn-sm flex align-center gap-1">
                      <Eye size={14} />
                      <span>Details</span>
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>

                {/* Items Summary Preview */}
                <div className="order-row-preview border-top pt-4 flex align-center justify-between">
                  <div className="preview-items-labels flex align-center gap-3">
                    <ShoppingBag size={16} className="text-muted" />
                    <span className="text-xs text-secondary">
                      {order.items.map(item => `${item.name} (x${item.quantity})`).join(', ')}
                    </span>
                  </div>
                  <span className="text-xs text-muted italic">
                    {order.paymentMethod}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Orders;
