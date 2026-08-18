import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import Home from './pages/Home';
import ProductCatalog from './pages/ProductCatalog';
import ProductDetails from './pages/ProductDetails';
import AiAssistant from './pages/AiAssistant';
import Login from './pages/Login';
import Register from './pages/Register';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import './styles/variables.css';
import './styles/global.css';
import './styles/utilities.css';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-wrapper flex flex-col">
          <Navbar />
          <main className="main-content-layout">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<ProductCatalog />} />
              <Route path="/products/:slug" element={<ProductDetails />} />
              <Route 
                path="/ai-assistant" 
                element={
                  <ProtectedRoute>
                    <AiAssistant />
                  </ProtectedRoute>
                } 
              />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              {/* Fallback to Home if unknown route */}
              <Route path="*" element={<Home />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
