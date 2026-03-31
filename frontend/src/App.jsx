/**
 * App.jsx — React Router with protected routes
 * PrivateRoute: redirects to /login if no JWT token
 * AdminRoute: redirects non-admin users
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import PaymentsDashboard from './pages/PaymentsDashboard';
import MakePayment from './pages/MakePayment';

/** Protected Route — requires authenticated user */
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

/** Admin Route — requires admin role */
const AdminRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!token) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/chat" replace />;
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage />} />

        {/* Protected routes */}
        <Route
          path="/chat"
          element={
            <PrivateRoute>
              <ChatPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/make-payment"
          element={
            <PrivateRoute>
              <MakePayment />
            </PrivateRoute>
          }
        />

        {/* Admin only */}
        <Route
          path="/payments"
          element={
            <AdminRoute>
              <PaymentsDashboard />
            </AdminRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
