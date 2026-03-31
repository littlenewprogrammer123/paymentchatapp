/**
 * PaymentsDashboard — Admin Only
 * Fetches payments via GET /api/payments (MongoDB aggregation with user join).
 * Displays table: User Name, Email, Role, Amount, Transaction ID, Method, Masked Card, Date.
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './PaymentsDashboard.css';

const PaymentsDashboard = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Redirect non-admin users
  useEffect(() => {
    if (user.role !== 'admin') {
      navigate('/chat');
    }
  }, [user.role, navigate]);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const res = await api.get('/payments');
        setPayments(res.data.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch payments.');
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, []);

  const formatDate = (date) =>
    new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const formatAmount = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

  const methodLabel = (type) => ({
    credit_card: '💳 Credit Card',
    debit_card: '💳 Debit Card',
    upi: '📱 UPI',
    net_banking: '🏦 Net Banking',
  }[type] || type);

  return (
    <div className="dashboard-page">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <Link to="/chat" id="back-to-chat" className="back-btn">← Back to Chat</Link>
          <div>
            <h1 className="dashboard-title">Payments Dashboard</h1>
            <p className="dashboard-subtitle">
              Admin view — MongoDB aggregation with user join
            </p>
          </div>
        </div>
        <div className="header-stats">
          <div className="stat-card">
            <span className="stat-value">{payments.length}</span>
            <span className="stat-label">Total Transactions</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">
              {formatAmount(payments.reduce((sum, p) => sum + p.amount, 0))}
            </span>
            <span className="stat-label">Total Volume</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="dashboard-content">
        {loading && (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading payments via aggregation pipeline...</p>
          </div>
        )}

        {error && (
          <div className="error-state" role="alert">⚠️ {error}</div>
        )}

        {!loading && !error && payments.length === 0 && (
          <div className="empty-state">
            <span>💳</span>
            <p>No payments recorded yet.</p>
          </div>
        )}

        {!loading && payments.length > 0 && (
          <div className="table-wrapper">
            <div className="table-info">
              <span>📊 Aggregation: payments → $lookup → users → $project (with decryption)</span>
            </div>
            <table className="payments-table" id="payments-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Amount</th>
                  <th>Transaction ID</th>
                  <th>Method</th>
                  <th>Card (Masked)</th>
                  <th>UPI Phone</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment, i) => (
                  <tr key={payment._id || i} id={`payment-row-${i}`}>
                    <td>
                      <div className="user-cell">
                        <div className="table-avatar">
                          {payment.user?.name?.[0]?.toUpperCase()}
                        </div>
                        <span>{payment.user?.name}</span>
                      </div>
                    </td>
                    <td className="email-cell">{payment.user?.email}</td>
                    <td>
                      <span className={`role-badge role-${payment.user?.role}`}>
                        {payment.user?.role}
                      </span>
                    </td>
                    <td className="amount-cell">{formatAmount(payment.amount)}</td>
                    <td className="txn-cell">{payment.transactionId}</td>
                    <td>{methodLabel(payment.paymentMethodType)}</td>
                    <td className="card-cell">
                      {payment.maskedCard || (
                        <span className="na-text">—</span>
                      )}
                    </td>
                    <td>
                      {payment.phone || <span className="na-text">—</span>}
                    </td>
                    <td>
                      <span className={`status-badge status-${payment.status}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="date-cell">{formatDate(payment.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentsDashboard;
