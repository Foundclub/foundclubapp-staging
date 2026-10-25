import { buildSubscriptionBillingWindow } from './subscriptionBilling';
import {
  getSubscriptionQuotaItems,
  mapSubscriptionDecisionToPaywall,
} from './subscriptionDecision';

describe('BUGHUNT BH01 — abonnements', () => {
  it('P1-01 : un quota epuise (remaining 0) reste a 0', () => {
    const [item] = getSubscriptionQuotaItems([
      {
        limit: 1, quotaType: 'EVENT_PUBLISH', remaining: 0, used: 0,
      },
    ]);
    expect(item.remaining).toBe(0);
  });

  it('P1-20 : remainingFreeUses null reste null', () => {
    const paywall = mapSubscriptionDecisionToPaywall({ remainingFreeUses: null });
    expect(paywall.remainingFreeUses).toBeNull();
  });

  it('P1-02 : mensuel achete le 31/01 finit le 28/02', () => {
    const { currentPeriodEnd } = buildSubscriptionBillingWindow(
      'monthly',
      new Date(2026, 0, 31, 12),
    );
    const end = new Date(currentPeriodEnd);
    expect([end.getMonth(), end.getDate()]).toEqual([1, 28]);
  });

  it('P1-02 : annuel achete le 29/02/2028 finit le 28/02/2029', () => {
    const { currentPeriodEnd } = buildSubscriptionBillingWindow(
      'yearly',
      new Date(2028, 1, 29, 12),
    );
    const end = new Date(currentPeriodEnd);
    expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([2029, 1, 28]);
  });
});
