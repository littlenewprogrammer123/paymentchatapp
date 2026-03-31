/**
 * MakePayment — Submit a payment
 * Form fields: amount, payment method type, card number (for card), phone (for UPI)
 * Sends to POST /api/payments — backend handles AES-256 encryption
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './MakePayment.css';

const MakePayment = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    amount: '',
    paymentMethodType: 'credit_card',
    cardNumber: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');

  const isCard = ['credit_card', 'debit_card'].includes(form.paymentMethodType);
  const isUPI = form.paymentMethodType === 'upi';

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(null);

    try {
      const payload = {
        amount: form.amount,
        paymentMethodType: form.paymentMethodType,
      };
      if (isCard && form.cardNumber) payload.cardNumber = form.cardNumber;
      if (isUPI && form.phone) payload.phone = form.phone;

      const res = await api.post('/payments', payload);
      setSuccess(res.data.data);
      setForm({ amount: '', paymentMethodType: 'credit_card', cardNumber: '', phone: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-page">
      <div className="payment-card">
        {/* Header */}
        <div className="payment-header">
          <Link to="/chat" className="back-link">← Back</Link>
          <div className="payment-logo">💳</div>
          <h1 className="payment-title">Make a Payment</h1>
          <p className="payment-subtitle">
            Card &amp; phone numbers are encrypted with AES-256-CBC before storage
          </p>
        </div>

        {/* Success state */}
        {success && (
          <div className="success-panel" id="payment-success">
            <div className="success-icon">✅</div>
            <h3>Payment Successful!</h3>
            <div className="success-details">
              <div className="detail-row">
                <span>Transaction ID</span>
                <strong>{success.transactionId}</strong>
              </div>
              <div className="detail-row">
                <span>Amount</span>
                <strong>₹{parseFloat(success.amount).toFixed(2)}</strong>
              </div>
              <div className="detail-row">
                <span>Status</span>
                <span className="status-success">{success.status}</span>
              </div>
            </div>
            <div className="success-actions">
              <button
                id="make-another-btn"
                className="btn-secondary"
                onClick={() => setSuccess(null)}
              >
                Make Another Payment
              </button>
              <button
                id="go-chat-btn"
                className="btn-primary"
                onClick={() => navigate('/chat')}
              >
                Go to Chat
              </button>
            </div>
          </div>
        )}

        {/* Payment Form */}
        {!success && (
          <form className="payment-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="amount">Amount (₹)</label>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="paymentMethodType">Payment Method</label>
              <div className="method-grid">
                {[
                  { value: 'credit_card', label: '💳 Credit Card' },
                  { value: 'debit_card', label: '💳 Debit Card' },
                  { value: 'upi', label: '📱 UPI' },
                  { value: 'net_banking', label: '🏦 Net Banking' },
                ].map((m) => (
                  <label
                    key={m.value}
                    className={`method-option ${form.paymentMethodType === m.value ? 'selected' : ''}`}
                    id={`method-${m.value}`}
                  >
                    <input
                      type="radio"
                      name="paymentMethodType"
                      value={m.value}
                      checked={form.paymentMethodType === m.value}
                      onChange={handleChange}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>

            {isCard && (
              <div className="form-group">
                <label htmlFor="cardNumber">Card Number</label>
                <input
                  id="cardNumber"
                  name="cardNumber"
                  type="text"
                  maxLength={19}
                  placeholder="1234 5678 9012 3456"
                  value={form.cardNumber}
                  onChange={handleChange}
                  required
                  autoComplete="cc-number"
                />
                <small className="field-hint">🔐 Will be AES-256 encrypted before storage</small>
              </div>
            )}

            {isUPI && (
              <div className="form-group">
                <label htmlFor="phone">UPI / Phone Number</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+91 99999 99999"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  autoComplete="tel"
                />
                <small className="field-hint">🔐 Will be AES-256 encrypted before storage</small>
              </div>
            )}

            {error && <div className="payment-error">{error}</div>}

            <button
              id="pay-btn"
              type="submit"
              className="pay-btn"
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : `Pay ₹${form.amount || '0'}`}
            </button>

            <div className="security-note">
              🔒 Secured with AES-256-CBC encryption • JWT authenticated
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default MakePayment;
