'use client';

import { useAuth } from './AuthContext';

export function useSubscription() {
  const { user } = useAuth();

  const planLimits = user?.plan_limits;
  const tier = user?.subscription_tier || 'free';

  const canUseFeature = (feature: 'advanced_cleaning' | 'quality_reports' | 'api_access' | 'team_workspace'): boolean => {
    if (!planLimits) return false;
    return Boolean(planLimits[feature]);
  };

  const isPro = tier === 'pro' || tier === 'team';
  const isTeam = tier === 'team';
  const isFree = tier === 'free';

  const remainingOps = user?.daily_operations_remaining ?? 0;
  const canPerformOperation = remainingOps > 0 || remainingOps === -1;

  return {
    tier,
    isPro,
    isTeam,
    isFree,
    canUseFeature,
    canPerformOperation,
    remainingOps,
    planLimits,
  };
}
