'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { 
  Sparkles, Upload, BarChart3, Zap, Shield, 
  Download, Users, Check, ArrowRight, Database,
  Wand2, PieChart, Cpu, Link2, Key, FileSpreadsheet
} from 'lucide-react';
import styles from './page.module.css';

function useMounted() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const mounted = !loading;
  
  if (mounted && user) {
    router.push('/dashboard');
  }
  
  return { mounted, loading };
}

export default function Home() {
  const { mounted, loading } = useMounted();

  if (!mounted || loading) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.background}>
        <div className={styles.bgGradient1} />
        <div className={styles.bgGradient2} />
        <div className={styles.bgPattern} />
      </div>
      
      <header className={styles.header}>
        <div className={styles.logo}>
          <Database className={styles.logoIcon} />
          <span>DatasetCleaner AI</span>
        </div>
        <nav className={styles.nav}>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <Link href="/login">Login</Link>
          <Link href="/register" className={styles.ctaButton}>Get Started</Link>
        </nav>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroBadge}>
            <Sparkles size={14} />
            <span>AI-Powered Data Cleaning</span>
          </div>
          <h1 className={styles.heroTitle}>
            Clean Your Datasets
            <span className={styles.gradient}> in Seconds</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Automatically detect and fix missing values, outliers, duplicates, 
            and inconsistencies. Prepare your data for machine learning in minutes.
          </p>
          <div className={styles.heroButtons}>
            <Link href="/register" className={styles.primaryButton}>
              Start Cleaning Free
              <ArrowRight size={18} />
            </Link>
            <a href="#features" className={styles.secondaryButton}>
              See How It Works
            </a>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.stat}>
              <span className={styles.statNumber}>50K+</span>
              <span className={styles.statLabel}>Datasets Cleaned</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNumber}>99.9%</span>
              <span className={styles.statLabel}>Accuracy</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNumber}>10s</span>
              <span className={styles.statLabel}>Avg. Processing Time</span>
            </div>
          </div>
        </section>

        <section id="features" className={styles.features}>
          <h2 className={styles.sectionTitle}>
            Everything You Need to Clean Data
          </h2>
          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <Upload size={24} />
              </div>
              <h3>Easy Upload</h3>
              <p>Drag and drop CSV, Excel, or JSON files. Upload directly or import from Kaggle.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <Link2 size={24} />
              </div>
              <h3>Kaggle Import</h3>
              <p>Import datasets directly from Kaggle with one click. No download needed.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <BarChart3 size={24} />
              </div>
              <h3>Quality Analysis</h3>
              <p>Automatically detect missing values, duplicates, outliers, and inconsistencies.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <Wand2 size={24} />
              </div>
              <h3>AI Suggestions</h3>
              <p>Get intelligent recommendations tailored to your specific dataset issues.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <Zap size={24} />
              </div>
              <h3>One-Click Clean</h3>
              <p>Apply all suggested fixes with a single click. Review changes before saving.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <PieChart size={24} />
              </div>
              <h3>Visual Dashboard</h3>
              <p>View heatmaps, distribution charts, and quality scores at a glance.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <Download size={24} />
              </div>
              <h3>Export Cleaned Data</h3>
              <p>Download your cleaned dataset in CSV format, ready for ML training.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <Key size={24} />
              </div>
              <h3>Developer API</h3>
              <p>Access dataset cleaning programmatically with our REST API. Build automation.</p>
            </div>
          </div>
        </section>

        <section className={styles.howItWorks}>
          <h2 className={styles.sectionTitle}>How It Works</h2>
          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepNumber}>1</div>
              <h3>Upload Dataset</h3>
              <p>Drag and drop your file or import directly from Kaggle. We accept CSV, Excel, and JSON.</p>
            </div>
            <div className={styles.stepConnector} />
            <div className={styles.step}>
              <div className={styles.stepNumber}>2</div>
              <h3>Automatic Analysis</h3>
              <p>Our AI analyzes your data for missing values, duplicates, outliers, and inconsistencies.</p>
            </div>
            <div className={styles.stepConnector} />
            <div className={styles.step}>
              <div className={styles.stepNumber}>3</div>
              <h3>Apply Cleaning</h3>
              <p>Review AI suggestions and apply them with one click. Customize any operation as needed.</p>
            </div>
            <div className={styles.stepConnector} />
            <div className={styles.step}>
              <div className={styles.stepNumber}>4</div>
              <h3>Download & Use</h3>
              <p>Export your cleaned dataset and use it directly for machine learning projects.</p>
            </div>
          </div>
        </section>

        <section id="pricing" className={styles.pricing}>
          <h2 className={styles.sectionTitle}>Simple, Transparent Pricing</h2>
          <p className={styles.pricingSubtitle}>Start free, upgrade when you need more power</p>
          <div className={styles.pricingGrid}>
            <div className={styles.pricingCard}>
              <div className={styles.pricingHeader}>
                <h3>Free</h3>
                <div className={styles.price}>
                  <span className={styles.priceAmount}>₹0</span>
                  <span className={styles.pricePeriod}>/month</span>
                </div>
                <p className={styles.pricingDesc}>Perfect for getting started</p>
              </div>
              <ul className={styles.pricingFeatures}>
                <li><Check size={16} /> 5MB max file size</li>
                <li><Check size={16} /> 10 datasets</li>
                <li><Check size={16} /> 10 daily operations</li>
                <li><Check size={16} /> Basic cleaning</li>
                <li><Check size={16} /> Data quality scores</li>
              </ul>
              <Link href="/register" className={styles.pricingButton}>Get Started</Link>
            </div>
            <div className={`${styles.pricingCard} ${styles.pricingCardPro}`}>
              <div className={styles.proBadge}>Most Popular</div>
              <div className={styles.pricingHeader}>
                <h3>Pro</h3>
                <div className={styles.price}>
                  <span className={styles.priceAmount}>₹999</span>
                  <span className={styles.pricePeriod}>/month</span>
                </div>
                <p className={styles.pricingDesc}>For professionals</p>
              </div>
              <ul className={styles.pricingFeatures}>
                <li><Check size={16} /> 100MB max file size</li>
                <li><Check size={16} /> 100 datasets</li>
                <li><Check size={16} /> 100 daily operations</li>
                <li><Check size={16} /> Advanced cleaning</li>
                <li><Check size={16} /> Quality reports</li>
                <li><Check size={16} /> Outlier detection</li>
                <li><Check size={16} /> Priority support</li>
              </ul>
              <Link href="/register?plan=pro" className={styles.pricingButtonPro}>Upgrade to Pro</Link>
            </div>
            <div className={styles.pricingCard}>
              <div className={styles.pricingHeader}>
                <h3>Team</h3>
                <div className={styles.price}>
                  <span className={styles.priceAmount}>₹3,999</span>
                  <span className={styles.pricePeriod}>/month</span>
                </div>
                <p className={styles.pricingDesc}>For teams & developers</p>
              </div>
              <ul className={styles.pricingFeatures}>
                <li><Check size={16} /> 500MB max file size</li>
                <li><Check size={16} /> Unlimited datasets</li>
                <li><Check size={16} /> Unlimited operations</li>
                <li><Check size={16} /> Everything in Pro</li>
                <li><Check size={16} /> Team workspace</li>
                <li><Check size={16} /> Developer API</li>
                <li><Check size={16} /> Dedicated support</li>
              </ul>
              <Link href="/register?plan=team" className={styles.pricingButton}>Contact Sales</Link>
            </div>
          </div>
        </section>

        <section className={styles.cta}>
          <h2>Ready to Clean Your Data?</h2>
          <p>Join thousands of data scientists who trust DatasetCleaner AI</p>
          <Link href="/register" className={styles.ctaButtonLarge}>
            Get Started for Free
            <ArrowRight size={20} />
          </Link>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerLogo}>
            <Database size={20} />
            <span>DatasetCleaner AI</span>
          </div>
          <p>Automated data cleaning for machine learning</p>
        </div>
      </footer>
    </div>
  );
}
