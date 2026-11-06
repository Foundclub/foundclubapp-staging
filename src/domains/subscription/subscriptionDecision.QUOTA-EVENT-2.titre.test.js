import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

import { getSubscriptionQuotaSheetContent } from './subscriptionDecision';

// « 134- A » (06/11) : depuis QUOTA-EVENT-2, 2 événements sont offerts. La feuille s'ouvre au 3ᵉ :
// son titre ne dit plus « 2ᵉ », et la feuille ne connaît pas le compteur, donc aucun numéro.
const REFUS_AU_TROISIEME = {
  allowed: false,
  paywall: 'EVENT_LIMIT',
  reason: 'FREE_QUOTA_EXHAUSTED',
  remainingFreeUses: 0,
  requiredPlan: ['TEAM', 'CLUB'],
};

describe('134- A — le titre de la feuille au 3ᵉ événement', () => {
  it('fr : la feuille affichée ne dit pas « 2ᵉ »', () => {
    const titre = getSubscriptionQuotaSheetContent(REFUS_AU_TROISIEME)?.title;
    expect(titre).toBe(fr.subscriptionDecision.quotaSheet.event.title);
    expect(titre).not.toMatch(/2ᵉ|deuxième|\d/i);
  });

  // Les témoins ne chargent que le français (jest.setup.js) : l'anglais se lit dans sa table.
  it('en : le même titre, sans « 2nd »', () => {
    expect(en.subscriptionDecision.quotaSheet.event.title).not.toMatch(/2nd|second|\d/i);
  });
});
