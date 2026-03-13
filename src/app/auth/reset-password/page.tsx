'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Database, ArrowLeft, Lock, CheckCircle } from 'lucide-react';
import styles from '../auth.module.css';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid reset token');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/auth/password-reset-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to reset password');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
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

          <h1>Invalid Link</h1>
          <p className={styles.subtitle}>
            This password reset link is invalid or has expired.
          </p>

          <p className={styles.switchLink}>
            <Link href="/forgot-password">Request a new one</Link>
          </p>
        </div>
      </div>
    );
  }

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

          <h1>Password reset</h1>
          <p className={styles.subtitle}>
            Your password has been successfully reset.
          </p>

          <Link href="/login" className={styles.submitButton} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            Sign in
          </Link>
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

        <h1>Reset password</h1>
        <p className={styles.subtitle}>
          Enter a new password for your account
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.field}>
            <label htmlFor="password">New password</label>
            <div className={styles.inputWrapper}>
              <Lock size={18} className={styles.inputIcon} />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="confirmPassword">Confirm password</label>
            <div className={styles.inputWrapper}>
              <Lock size={18} className={styles.inputIcon} />
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
              />
            </div>
          </div>

          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
