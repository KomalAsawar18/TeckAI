import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Package, ShoppingBag, Folder, Users, Plus, Edit2, ToggleLeft, ToggleRight, Check, AlertCircle, X } from 'lucide-react';
import Loader from '../components/common/Loader';
import ErrorMessage from '../components/common/ErrorMessage';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('orders');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Data states
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);

  // Form modals state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Product Form Fields
  const [prodName, setProdName] = useState('');
  const [prodSlug, setProdSlug] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodBrand, setProdBrand] = useState('');
  const [prodCategory, setProdCategory] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodImage, setProdImage] = useState('');
  const [prodActive, setProdActive] = useState(true);

  // Category Form Fields
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');

  const clearAlerts = () => {
    setError(null);
    setSuccessMsg(null);
  };

  const loadData = async () => {
    setLoading(true);
    clearAlerts();
    try {
      // Load all lists
      const [orderRes, prodRes, catRes, userRes] = await Promise.all([
        api.adminGetOrders(),
        api.adminGetProducts(),
        api.getCategories(),
        api.adminGetUsers()
      ]);

      if (orderRes.success) setOrders(orderRes.data);
      if (prodRes.success) setProducts(prodRes.data);
      if (catRes.success) setCategories(catRes.data);
      if (userRes.success) setUsers(userRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load administrative dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update order status trigger
  const handleStatusChange = async (orderId, newStatus) => {
    clearAlerts();
    try {
      const res = await api.adminUpdateOrderStatus(orderId, newStatus);
      if (res.success) {
        setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status: newStatus } : o));
        setSuccessMsg(`Order status successfully updated to "${newStatus}".`);
      }
    } catch (err) {
      setError(err.message || 'Status transition rejected.');
    }
  };

  // Toggle product active status
  const handleProductToggle = async (product) => {
    clearAlerts();
    try {
      const updatedActive = !product.isActive;
      const res = await api.adminUpdateProduct(product._id, { isActive: updatedActive });
      if (res.success) {
        setProducts(prev => prev.map(p => p._id === product._id ? { ...p, isActive: updatedActive } : p));
        setSuccessMsg(`Product "${product.name}" is now ${updatedActive ? 'Active' : 'Inactive'}.`);
      }
    } catch (err) {
      setError(err.message || 'Failed to toggle product status.');
    }
  };

  // Open Product Modal for Create
  const openCreateProduct = () => {
    setEditingProduct(null);
    setProdName('');
    setProdSlug('');
    setProdSku('');
    setProdBrand('');
    setProdCategory(categories.length > 0 ? categories[0]._id : '');
    setProdDesc('');
    setProdPrice('');
    setProdStock('');
    setProdImage('');
    setProdActive(true);
    setShowProductModal(true);
  };

  // Open Product Modal for Edit
  const openEditProduct = (product) => {
    setEditingProduct(product);
    setProdName(product.name || '');
    setProdSlug(product.slug || '');
    setProdSku(product.sku || '');
    setProdBrand(product.brand || '');
    setProdCategory(product.category._id || product.category || '');
    setProdDesc(product.description || '');
    setProdPrice(product.price || '');
    setProdStock(product.stock || '');
    setProdImage(product.images && product.images.length > 0 ? product.images[0] : '');
    setProdActive(product.isActive);
    setShowProductModal(true);
  };

  // Product Submit (Create / Edit)
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    clearAlerts();

    if (!prodName.trim() || !prodSlug.trim() || !prodSku.trim() || !prodDesc.trim() || !prodBrand.trim() || !prodCategory) {
      setError('Please fill in all required fields.');
      return;
    }

    const priceNum = Number(prodPrice);
    const stockNum = Number(prodStock);
    if (isNaN(priceNum) || priceNum < 0 || isNaN(stockNum) || stockNum < 0) {
      setError('Price and Stock must be positive numbers.');
      return;
    }

    const payload = {
      name: prodName.trim(),
      slug: prodSlug.trim(),
      sku: prodSku.trim(),
      brand: prodBrand.trim(),
      category: prodCategory,
      description: prodDesc.trim(),
      price: priceNum,
      stock: stockNum,
      isActive: prodActive,
      image: prodImage.trim() || undefined
    };

    try {
      if (editingProduct) {
        // Edit product
        const res = await api.adminUpdateProduct(editingProduct._id, payload);
        if (res.success) {
          setSuccessMsg(`Product "${prodName}" updated successfully.`);
          setShowProductModal(false);
          loadData();
        }
      } else {
        // Create product
        const res = await api.adminCreateProduct(payload);
        if (res.success) {
          setSuccessMsg(`Product "${prodName}" created successfully.`);
          setShowProductModal(false);
          loadData();
        }
      }
    } catch (err) {
      setError(err.message || 'Operation failed. Verify SKU/slug duplicates.');
    }
  };

  // Create Category
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    clearAlerts();

    if (!catName.trim() || !catSlug.trim()) {
      setError('Category name and slug are required.');
      return;
    }

    try {
      const res = await api.adminCreateCategory({
        name: catName.trim(),
        slug: catSlug.trim().toLowerCase()
      });

      if (res.success) {
        setSuccessMsg(`Category "${catName}" created successfully.`);
        setCatName('');
        setCatSlug('');
        setShowCategoryModal(false);
        loadData();
      }
    } catch (err) {
      setError(err.message || 'Category creation failed.');
    }
  };

  if (loading) {
    return (
      <div className="admin-loading flex justify-center align-center">
        <Loader message="Accessing admin panel database..." />
      </div>
    );
  }

  return (
    <div className="container py-12 fade-in">
      <div className="mb-8 flex align-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">TeckAI Admin Control Center</h1>
          <p className="text-secondary text-sm">Review platform metrics, catalog configurations, and order logs</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-secondary flex align-center gap-1 btn-sm" onClick={loadData}>
            Refresh Data
          </button>
        </div>
      </div>

      {/* Alert Notifications */}
      {error && (
        <div className="admin-alert-error card p-4 mb-6 flex align-center justify-between gap-3">
          <div className="flex align-center gap-3">
            <AlertCircle size={20} className="text-error" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
          <button className="clear-alert-btn" onClick={() => setError(null)}><X size={16} /></button>
        </div>
      )}

      {successMsg && (
        <div className="admin-alert-success card p-4 mb-6 flex align-center justify-between gap-3">
          <div className="flex align-center gap-3">
            <Check size={20} className="text-success" />
            <span className="text-sm font-semibold">{successMsg}</span>
          </div>
          <button className="clear-alert-btn" onClick={() => setSuccessMsg(null)}><X size={16} /></button>
        </div>
      )}

      {/* Tab Navigation links */}
      <div className="admin-tabs flex gap-2 border-bottom pb-2 mb-6">
        <button 
          className={`admin-tab-btn flex align-center gap-2 ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => { setActiveTab('orders'); clearAlerts(); }}
        >
          <ShoppingBag size={16} />
          <span>Orders ({orders.length})</span>
        </button>
        <button 
          className={`admin-tab-btn flex align-center gap-2 ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => { setActiveTab('products'); clearAlerts(); }}
        >
          <Package size={16} />
          <span>Products ({products.length})</span>
        </button>
        <button 
          className={`admin-tab-btn flex align-center gap-2 ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => { setActiveTab('categories'); clearAlerts(); }}
        >
          <Folder size={16} />
          <span>Categories ({categories.length})</span>
        </button>
        <button 
          className={`admin-tab-btn flex align-center gap-2 ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => { setActiveTab('users'); clearAlerts(); }}
        >
          <Users size={16} />
          <span>Users ({users.length})</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="admin-tab-content">
        
        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="card p-6 overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Method</th>
                  <th>Current Status</th>
                  <th>Update Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o._id}>
                    <td className="monospace text-xs">#{o._id.substring(o._id.length - 8).toUpperCase()}</td>
                    <td>
                      <div className="flex flex-col">
                        <span className="font-semibold text-primary">{o.user?.name || 'Unknown'}</span>
                        <span className="text-xs text-muted">{o.user?.email || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="text-xs">{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td className="font-bold">PKR {o.subtotal.toLocaleString()}</td>
                    <td className="text-xs text-muted">{o.paymentMethod}</td>
                    <td>
                      <span className={`status-badge text-xs font-bold uppercase status-${o.status}`}>
                        {o.status}
                      </span>
                    </td>
                    <td>
                      <select 
                        value={o.status}
                        onChange={(e) => handleStatusChange(o._id, e.target.value)}
                        className="admin-select"
                        disabled={o.status === 'delivered' || o.status === 'cancelled'}
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PRODUCTS TAB */}
        {activeTab === 'products' && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <button className="btn btn-primary flex align-center gap-1 btn-sm" onClick={openCreateProduct}>
                <Plus size={16} />
                <span>Add Product</span>
              </button>
            </div>

            <div className="card p-6 overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU / Brand</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p._id}>
                      <td>
                        <div className="flex align-center gap-3">
                          {p.images && p.images.length > 0 && (
                            <img src={p.images[0]} alt={p.name} className="admin-product-thumb" />
                          )}
                          <div className="flex flex-col">
                            <span className="font-semibold text-primary">{p.name}</span>
                            <span className="text-xs text-muted truncate max-w-48">{p.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <span className="monospace text-xs font-bold">{p.sku}</span>
                          <span className="text-xs text-secondary">{p.brand}</span>
                        </div>
                      </td>
                      <td className="text-xs">{p.category?.name || 'N/A'}</td>
                      <td className="font-bold">PKR {p.price.toLocaleString()}</td>
                      <td className="text-xs font-semibold">{p.stock} units</td>
                      <td>
                        <button className="toggle-active-btn" onClick={() => handleProductToggle(p)}>
                          {p.isActive ? (
                            <ToggleRight size={28} className="text-success" />
                          ) : (
                            <ToggleLeft size={28} className="text-muted" />
                          )}
                        </button>
                      </td>
                      <td>
                        <button className="btn btn-secondary btn-xs flex align-center gap-1" onClick={() => openEditProduct(p)}>
                          <Edit2 size={12} />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CATEGORIES TAB */}
        {activeTab === 'categories' && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <button className="btn btn-primary flex align-center gap-1 btn-sm" onClick={() => setShowCategoryModal(true)}>
                <Plus size={16} />
                <span>Add Category</span>
              </button>
            </div>

            <div className="card p-6 overflow-x-auto max-w-2xl">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Category Name</th>
                    <th>Slug</th>
                    <th>Database ID</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map(c => (
                    <tr key={c._id}>
                      <td className="font-semibold text-primary">{c.name}</td>
                      <td className="text-xs text-secondary">{c.slug}</td>
                      <td className="monospace text-xs text-muted">#{c._id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="card p-6 overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined Date</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._id}>
                    <td className="monospace text-xs text-muted">#{u._id}</td>
                    <td className="font-semibold text-primary">{u.name}</td>
                    <td className="text-sm">{u.email}</td>
                    <td>
                      <span className={`role-badge text-xs font-bold uppercase ${u.role === 'admin' ? 'role-admin' : 'role-user'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="text-xs text-secondary">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE/EDIT PRODUCT MODAL */}
      {showProductModal && (
        <div className="modal-backdrop">
          <div className="modal-card card p-6">
            <div className="modal-header flex align-center justify-between border-bottom pb-3 mb-4">
              <h3 className="text-lg font-bold text-primary">
                {editingProduct ? `Edit Product: ${editingProduct.name}` : 'Add New Product'}
              </h3>
              <button className="close-modal-btn" onClick={() => setShowProductModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group flex flex-col gap-2">
                  <label className="text-xs font-semibold text-secondary">Product Name</label>
                  <input
                    type="text"
                    className="input-text"
                    placeholder="e.g. Pro Laptop 15"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group flex flex-col gap-2">
                  <label className="text-xs font-semibold text-secondary">Slug (Unique URL)</label>
                  <input
                    type="text"
                    className="input-text"
                    placeholder="e.g. pro-laptop-15"
                    value={prodSlug}
                    onChange={(e) => setProdSlug(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group flex flex-col gap-2">
                  <label className="text-xs font-semibold text-secondary">SKU (Stock Keeping Unit)</label>
                  <input
                    type="text"
                    className="input-text"
                    placeholder="e.g. SKU-PRO-LAP15"
                    value={prodSku}
                    onChange={(e) => setProdSku(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group flex flex-col gap-2">
                  <label className="text-xs font-semibold text-secondary">Brand</label>
                  <input
                    type="text"
                    className="input-text"
                    placeholder="e.g. BrandA"
                    value={prodBrand}
                    onChange={(e) => setProdBrand(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="form-group flex flex-col gap-2">
                  <label className="text-xs font-semibold text-secondary">Price (PKR)</label>
                  <input
                    type="number"
                    className="input-text"
                    placeholder="120000"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group flex flex-col gap-2">
                  <label className="text-xs font-semibold text-secondary">Stock Qty</label>
                  <input
                    type="number"
                    className="input-text"
                    placeholder="10"
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group flex flex-col gap-2">
                  <label className="text-xs font-semibold text-secondary">Category</label>
                  <select
                    className="input-text"
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    required
                  >
                    {categories.map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group flex flex-col gap-2">
                <label className="text-xs font-semibold text-secondary">Product Image URL</label>
                <input
                  type="url"
                  className="input-text"
                  placeholder="https://images.unsplash.com/..."
                  value={prodImage}
                  onChange={(e) => setProdImage(e.target.value)}
                />
              </div>

              <div className="form-group flex flex-col gap-2">
                <label className="text-xs font-semibold text-secondary">Description</label>
                <textarea
                  className="input-text"
                  rows="3"
                  placeholder="Enter detailed hardware specs..."
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  required
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="flex align-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="prodActive"
                  checked={prodActive}
                  onChange={(e) => setProdActive(e.target.checked)}
                  className="accent-radio"
                />
                <label htmlFor="prodActive" className="text-sm font-semibold text-primary cursor-pointer">
                  Active (Show in catalog for users)
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-4 border-top pt-4">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowProductModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CATEGORY MODAL */}
      {showCategoryModal && (
        <div className="modal-backdrop">
          <div className="modal-card card p-6" style={{ maxWidth: '400px' }}>
            <div className="modal-header flex align-center justify-between border-bottom pb-3 mb-4">
              <h3 className="text-lg font-bold text-primary">Create Category</h3>
              <button className="close-modal-btn" onClick={() => setShowCategoryModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="flex flex-col gap-4">
              <div className="form-group flex flex-col gap-2">
                <label className="text-xs font-semibold text-secondary">Category Name</label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="e.g. Monitors"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group flex flex-col gap-2">
                <label className="text-xs font-semibold text-secondary">Slug (Unique URL)</label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="e.g. monitors"
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 mt-4 border-top pt-4">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCategoryModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
