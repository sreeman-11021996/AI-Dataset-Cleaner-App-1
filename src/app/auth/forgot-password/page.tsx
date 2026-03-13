'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Database, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import styles from '../auth.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/auth/password-reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to send reset email');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.container}>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={18} />
          Back to home
        </Link>

        <div className={styles.card}>
          <div className={styles.logo}>
            <Database size={32} />
            <span>DatasetCleaner AI</span>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <CheckCircle size={48} style={{ color: 'var(--accent-primary)' }} />
          </div>

          <h1>Check your email</h1>
          <p className={styles.subtitle}>
            We sent a password reset link to <strong>{email}</strong>
          </p>

          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Did not receive the email? Check your spam folder, or{' '}
            <button
              onClick={() => setSuccess(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              try again
            </button>
          </p>

          <p className={styles.switchLink}>
            <Link href="/login">Back to sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Link href="/" className={styles.backLink}>
        <ArrowLeft size={18} />
        Back to home
      </Link>

      <div className={styles.card}>
        <div className={styles.logo}>
          <Database size={32} />
          <span>DatasetCleaner AI</span>
        </div>

        <h1>Forgot password?</h1>
        <p className={styles.subtitle}>
          No worries, we&apos;ll send you reset instructions
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <div className={styles.inputWrapper}>
              <Mail size={18} className={styles.inputIcon} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
          </div>

          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? 'Sending...' : 'Reset Password'}
          </button>
        </form>

        <p className={styles.switchLink}>
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
