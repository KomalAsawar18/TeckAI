import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

const MainLayout = () => {
  return (
    <div className="app-wrapper flex flex-col">
      <Navbar />
      <main className="main-content-layout">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default MainLayout;
