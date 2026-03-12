'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  User,
  Mail,
  Lock,
  Bell,
  Moon,
  Sun,
  Shield,
  CreditCard,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Save,
} from 'lucide-react';
import styles from './settings.module.css';

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  const [notifications, setNotifications] = useState({
    emailDigest: true,
    jobComplete: true,
    qualityAlerts: true,
    marketingEmails: false,
  });

  const handleSave = async () => {
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'data', label: 'Data & Privacy', icon: Shield },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Account Settings</h2>
        <p>Manage your account preferences and settings</p>
      </div>

      <div className={styles.layout}>
        <nav className={styles.tabs}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={styles.content}>
          {activeTab === 'profile' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>Profile Information</h3>
                <p>Update your personal details</p>
              </div>

              <div className={styles.form}>
                <div className={styles.avatarSection}>
                  <div className={styles.avatar}>
                    {user?.email[0].toUpperCase()}
                  </div>
                  <div className={styles.avatarInfo}>
                    <span className={styles.avatarName}>Profile Photo</span>
                    <span className={styles.avatarHint}>Auto-generated from your email</span>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className="label">Full Name</label>
                  <input
                    type="text"
                    className="input"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    placeholder="Enter your name"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className="label">Email Address</label>
                  <div className={styles.inputWithIcon}>
                    <Mail size={18} />
                    <input
                      type="email"
                      className={`input ${styles.disabledInput}`}
                      value={profile.email}
                      disabled
                    />
                  </div>
                  <span className={styles.hint}>Email cannot be changed</span>
                </div>

                <div className={styles.formGroup}>
                  <label className="label">Account Type</label>
                  <div className={styles.planBadge}>
                    <span className={`${styles.plan} ${user?.subscription_tier === 'pro' ? styles.planPro : styles.planFree}`}>
                      {user?.subscription_tier === 'pro' ? 'Pro Plan' : 'Free Plan'}
                    </span>
                    {user?.subscription_tier === 'free' && (
                      <a href="/pricing" className={styles.upgradeLink}>
                        Upgrade to Pro <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>Security Settings</h3>
                <p>Manage your password and security preferences</p>
              </div>

              <div className={styles.form}>
                <div className={styles.formGroup}>
                  <label className="label">Current Password</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Enter current password"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className="label">New Password</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Enter new password"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className="label">Confirm New Password</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Confirm new password"
                  />
                </div>

                <button className="btn btn-primary">
                  <Lock size={16} />
                  Update Password
                </button>
              </div>

              <div className={styles.divider} />

              <div className={styles.sectionHeader}>
                <h3>Two-Factor Authentication</h3>
                <p>Add an extra layer of security to your account</p>
              </div>

              <div className={styles.twoFactorCard}>
                <div className={styles.twoFactorInfo}>
                  <Shield size={24} />
                  <div>
                    <span className={styles.twoFactorTitle}>Two-Factor Authentication</span>
                    <span className={styles.twoFactorStatus}>Not enabled</span>
                  </div>
                </div>
                <button className="btn btn-secondary">Enable 2FA</button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>Notification Preferences</h3>
                <p>Choose what notifications you want to receive</p>
              </div>

              <div className={styles.notificationsList}>
                <div className={styles.notificationItem}>
                  <div className={styles.notificationInfo}>
                    <span className={styles.notificationTitle}>Email Digest</span>
                    <span className={styles.notificationDesc}>Receive weekly summary of your activity</span>
                  </div>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={notifications.emailDigest}
                      onChange={(e) => setNotifications({ ...notifications, emailDigest: e.target.checked })}
                    />
                    <span className={styles.toggleSlider} />
                  </label>
                </div>

                <div className={styles.notificationItem}>
                  <div className={styles.notificationInfo}>
                    <span className={styles.notificationTitle}>Job Completion</span>
                    <span className={styles.notificationDesc}>Get notified when cleaning jobs complete</span>
                  </div>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={notifications.jobComplete}
                      onChange={(e) => setNotifications({ ...notifications, jobComplete: e.target.checked })}
                    />
                    <span className={styles.toggleSlider} />
                  </label>
                </div>

                <div className={styles.notificationItem}>
                  <div className={styles.notificationInfo}>
                    <span className={styles.notificationTitle}>Quality Alerts</span>
                    <span className={styles.notificationDesc}>Alert when dataset quality is below threshold</span>
                  </div>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={notifications.qualityAlerts}
                      onChange={(e) => setNotifications({ ...notifications, qualityAlerts: e.target.checked })}
                    />
                    <span className={styles.toggleSlider} />
                  </label>
                </div>

                <div className={styles.notificationItem}>
                  <div className={styles.notificationInfo}>
                    <span className={styles.notificationTitle}>Marketing Emails</span>
                    <span className={styles.notificationDesc}>News, updates, and promotional content</span>
                  </div>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={notifications.marketingEmails}
                      onChange={(e) => setNotifications({ ...notifications, marketingEmails: e.target.checked })}
                    />
                    <span className={styles.toggleSlider} />
                  </label>
                </div>
              </div>

              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : saved ? <><CheckCircle2 size={16} /> Saved</> : <><Save size={16} /> Save Changes</>}
              </button>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>Billing & Subscription</h3>
                <p>Manage your subscription and payment methods</p>
              </div>

              <div className={styles.currentPlan}>
                <div className={styles.planInfo}>
                  <span className={styles.planLabel}>Current Plan</span>
                  <span className={`${styles.planName} ${user?.subscription_tier === 'pro' ? styles.pro : ''}`}>
                    {user?.subscription_tier === 'pro' ? 'Pro Plan' : 'Free Plan'}
                  </span>
                </div>
                {user?.subscription_tier === 'free' && (
                  <a href="/pricing" className="btn btn-primary">Upgrade Plan</a>
                )}
              </div>

              {user?.subscription_tier === 'pro' && (
                <div className={styles.planDetails}>
                  <div className={styles.planDetail}>
                    <span>Storage</span>
                    <span>5 GB</span>
                  </div>
                  <div className={styles.planDetail}>
                    <span>File Size Limit</span>
                    <span>100 MB</span>
                  </div>
                  <div className={styles.planDetail}>
                    <span>Priority Support</span>
                    <span>Included</span>
                  </div>
                </div>
              )}

              <div className={styles.divider} />

              <div className={styles.sectionHeader}>
                <h3>Payment Method</h3>
              </div>

              <div className={styles.paymentCard}>
                <CreditCard size={24} />
                <div>
                  <span className={styles.paymentTitle}>No payment method</span>
                  <span className={styles.paymentHint}>Add a card to upgrade to Pro</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>Data & Privacy</h3>
                <p>Control your data and account deletion</p>
              </div>

              <div className={styles.dataOptions}>
                <div className={styles.dataOption}>
                  <div className={styles.dataIcon}>
                    <Download size={20} />
                  </div>
                  <div className={styles.dataInfo}>
                    <span className={styles.dataTitle}>Export Your Data</span>
                    <span className={styles.dataDesc}>Download all your datasets and cleaning history</span>
                  </div>
                  <button className="btn btn-secondary">Export</button>
                </div>

                <div className={styles.dataOption}>
                  <div className={styles.dataIcon}>
                    <Trash2 size={20} />
                  </div>
                  <div className={styles.dataInfo}>
                    <span className={styles.dataTitle}>Delete Account</span>
                    <span className={styles.dataDesc}>Permanently delete your account and all data</span>
                  </div>
                  <button className={`btn ${styles.dangerButton}`}>Delete</button>
                </div>
              </div>

              <div className={styles.dangerZone}>
                <div className={styles.dangerHeader}>
                  <AlertCircle size={20} />
                  <span>Danger Zone</span>
                </div>
                <p>Once you delete your account, there is no going back. Please be certain.</p>
                <button className={styles.deleteButton}>
                  <Trash2 size={16} />
                  Delete Account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
