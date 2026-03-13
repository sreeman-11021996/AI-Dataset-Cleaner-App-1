'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { 
  Sparkles, Check, X, ArrowRight, Database, 
  Zap, BarChart3, Users, Shield, FileText, 
  HardDrive, Gauge, Lock
} from 'lucide-react';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for getting started with data cleaning',
    features: [
      { name: 'Max dataset size', value: '5 MB' },
      { name: 'Max datasets', value: '10' },
      { name: 'Daily operations', value: '10' },
      { name: 'Basic cleaning operations', included: true },
      { name: 'Data quality scores', included: true },
      { name: 'Advanced cleaning features', included: false },
      { name: 'Quality reports', included: false },
      { name: 'Team workspace', included: false },
      { name: 'API access', included: false },
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    period: 'per month',
    description: 'For professionals who need more power',
    features: [
      { name: 'Max dataset size', value: '100 MB' },
      { name: 'Max datasets', value: '100' },
      { name: 'Daily operations', value: '100' },
      { name: 'Basic cleaning operations', included: true },
      { name: 'Data quality scores', included: true },
      { name: 'Advanced cleaning features', included: true },
      { name: 'Quality reports', included: true },
      { name: 'Team workspace', included: false },
      { name: 'API access', included: false },
    ],
    cta: 'Upgrade to Pro',
    popular: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: '$99',
    period: 'per month',
    description: 'Collaborate with your team on data cleaning',
    features: [
      { name: 'Max dataset size', value: '500 MB' },
      { name: 'Max datasets', value: 'Unlimited' },
      { name: 'Daily operations', value: 'Unlimited' },
      { name: 'Basic cleaning operations', included: true },
      { name: 'Data quality scores', included: true },
      { name: 'Advanced cleaning features', included: true },
      { name: 'Quality reports', included: true },
      { name: 'Team workspace', included: true },
      { name: 'API access', included: true },
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelectPlan = async (planId: string) => {
    if (!user) {
      router.push('/register');
      return;
    }

    if (planId === 'free') {
      return;
    }

    setLoading(planId);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert(`This would integrate with a payment provider (Stripe) for the ${planId} plan.`);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
    }}>
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.5rem 2rem',
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <Link href="/" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 600,
          fontSize: '1.25rem',
          color: 'var(--accent-primary)',
          textDecoration: 'none',
        }}>
          <Database size={28} />
          <span>DatasetCleaner AI</span>
        </Link>
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
        }}>
          <Link href="/#features" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Features</Link>
          <Link href="/pricing" style={{ color: 'var(--text-primary)', fontWeight: 500, textDecoration: 'none' }}>Pricing</Link>
          {user ? (
            <Link href="/dashboard" style={{
              padding: '0.625rem 1.25rem',
              background: 'var(--accent-primary)',
              color: '#000',
              borderRadius: '8px',
              fontWeight: 600,
              textDecoration: 'none',
            }}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Login</Link>
              <Link href="/register" style={{
                padding: '0.625rem 1.25rem',
                background: 'var(--accent-primary)',
                color: '#000',
                borderRadius: '8px',
                fontWeight: 600,
                textDecoration: 'none',
              }}>
                Get Started
              </Link>
            </>
          )}
        </nav>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '4rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'rgba(0, 212, 170, 0.1)',
            borderRadius: '9999px',
            color: 'var(--accent-primary)',
            fontSize: '0.875rem',
            fontWeight: 500,
            marginBottom: '1.5rem',
          }}>
            <Sparkles size={16} />
            Simple, transparent pricing
          </div>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: 700,
            marginBottom: '1rem',
            lineHeight: 1.1,
          }}>
            Choose the plan that fits your needs
          </h1>
          <p style={{
            fontSize: '1.25rem',
            color: 'var(--text-secondary)',
            maxWidth: '600px',
            margin: '0 auto',
          }}>
            Start free and upgrade when you need more power. No hidden fees, cancel anytime.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '2rem',
          marginBottom: '4rem',
        }}>
          {plans.map((plan) => (
            <div key={plan.id} style={{
              background: plan.popular ? 'var(--bg-card)' : 'var(--bg-secondary)',
              border: plan.popular ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '2rem',
              position: 'relative',
            }}>
              {plan.popular && (
                <div style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--accent-primary)',
                  color: '#000',
                  padding: '0.25rem 1rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}>
                  MOST POPULAR
                </div>
              )}

              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  {plan.name}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
                  {plan.description}
                </p>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '3rem', fontWeight: 700 }}>{plan.price}</span>
                <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>{plan.period}</span>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, marginBottom: '2rem' }}>
                {plan.features.map((feature, idx) => (
                  <li key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.625rem 0',
                    borderBottom: idx < plan.features.length - 1 ? '1px solid var(--border-color)' : 'none',
                  }}>
                    {feature.included !== undefined && (
                      feature.included ? 
                        <Check size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} /> :
                        <X size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    )}
                    {feature.value && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        color: feature.value === 'Unlimited' ? 'var(--accent-primary)' : 'var(--text-primary)',
                        fontWeight: feature.value === 'Unlimited' ? 500 : 400,
                      }}>
                        {feature.value === 'Unlimited' && <Zap size={14} />}
                        {feature.value}
                      </span>
                    )}
                    <span style={{ color: feature.included === false ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={loading !== null || (user?.subscription_tier === plan.id)}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  background: plan.popular ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: plan.popular ? '#000' : 'var(--text-primary)',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: user?.subscription_tier === plan.id ? 'default' : 'pointer',
                  opacity: user?.subscription_tier === plan.id ? 0.7 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {user?.subscription_tier === plan.id 
                  ? 'Current Plan' 
                  : loading === plan.id 
                    ? 'Processing...' 
                    : plan.cta
                }
              </button>
            </div>
          ))}
        </div>

        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '16px',
          padding: '2.5rem',
          textAlign: 'center',
        }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>
            Need a custom solution?
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
            Contact us for custom enterprise pricing, dedicated support, and tailored solutions.
          </p>
          <button style={{
            padding: '0.875rem 1.5rem',
            background: 'transparent',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            Contact Sales
          </button>
        </div>
      </main>

      <footer style={{
        borderTop: '1px solid var(--border-color)',
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--text-muted)',
        marginTop: '4rem',
      }}>
        <p>&copy; 2026 DatasetCleaner AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
