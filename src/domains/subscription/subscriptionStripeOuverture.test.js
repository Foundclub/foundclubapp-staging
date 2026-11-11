// STRIPE-OUVERTURE (10/11, decision d'Adel « 206- A ») — ouvrir le paiement par
// carte sur le site. Ce temoin tient ce que le client LIT : jamais un message
// technique, de vrais noms d'offres, un prix, et l'essai gratuit nomme comme tel.
// Constat du rapport STRIPE-WEB (10/11) : le site affichait tel quel « Le checkout
// web n est pas configure (STRIPE_SECRET_KEY absente). » et « Produit Stripe
// absent pour fc_club_tier_4_yearly — lancer scripts/stripe-create-products.js
// --apply. », et nommait l'essai « Fc Trial Club ».
import '@/theme/strings';
import {
  getSubscriptionBillingErrorMessage,
  getSubscriptionCatalogEntryMeta,
  resolveSubscriptionChangeTarget,
} from '@/domains/subscription/subscriptionBilling';
import {
  formatSubscriptionPlanLabel,
  getSubscriptionPlanLabels,
  getSubscriptionStatusMeta,
} from '@/domains/subscription/subscriptionDecision';

// Ce qu'un client ne doit jamais lire : noms de prestataire, de variable, de script.
const MOTS_TECHNIQUES = /stripe|revenuecat|checkout|script|_KEY|--apply|fc_club|lookup/i;

// Les messages EXACTS du serveur (admin/src/api/subscription/services/subscription-stripe.ts).
const REFUS_AVANT_PAIEMENT = [
  'Le checkout web n est pas configure (STRIPE_SECRET_KEY absente).',
  'Produit Stripe absent pour fc_club_tier_4_yearly — lancer '
    + 'scripts/stripe-create-products.js --apply.',
  'Paiement web indisponible: No such price: \'price_123\'',
];
const REFUS_APRES_PAIEMENT = [
  'REVENUECAT_API_KEY absente — impossible de transmettre l achat web.',
  'Achat web transmis a Stripe mais pas a RevenueCat: Service Unavailable',
  'Abonnement Stripe introuvable sur la session payee.',
];

describe('STRIPE-OUVERTURE / L0 — jamais un message technique', () => {
  it.each(REFUS_AVANT_PAIEMENT)('avant paiement : « %s » devient une phrase claire', (serveur) => {
    const lu = getSubscriptionBillingErrorMessage({ message: serveur });
    expect(lu).not.toMatch(MOTS_TECHNIQUES);
    expect(lu).toMatch(/paiement par carte/i);
  });

  it.each(REFUS_APRES_PAIEMENT)('apres paiement : « %s » rassure', (serveur) => {
    const lu = getSubscriptionBillingErrorMessage({ message: serveur });
    expect(lu).not.toMatch(MOTS_TECHNIQUES);
    expect(lu).toMatch(/paiement est bien reçu/i);
  });

  it('un refus metier deja traduit reste inchange (garde-fou)', () => {
    expect(getSubscriptionBillingErrorMessage({ message: 'CLUB_ALREADY_COVERED' }))
      .toMatch(/déjà couvert/);
  });
});

describe('STRIPE-OUVERTURE / L2 — les vrais noms et les prix', () => {
  it('l essai gratuit s appelle « Essai Club » / « Essai Équipe », pas « Fc Trial Club »', () => {
    expect(formatSubscriptionPlanLabel('fc_trial_club')).toBe('Essai Club');
    expect(formatSubscriptionPlanLabel('fc_trial_team')).toBe('Essai Équipe');
    expect(getSubscriptionPlanLabels({ activePlanCodes: ['fc_trial_club'] }))
      .toEqual(['Essai Club']);
  });

  it('un club en attente de certification est « Club · actif », pas « Club a verifier »', () => {
    expect(getSubscriptionStatusMeta('CLUB_UNVERIFIED').label).toBe('Club · actif');
  });

  it('une offre du catalogue porte son nom et son prix', () => {
    const meta = getSubscriptionCatalogEntryMeta({
      billingPeriod: 'yearly',
      displayName: 'Club 100',
      planCode: 'fc_club_tier_1_yearly',
      referencePriceEurCents: 24999,
      scopeType: 'CLUB',
    });
    expect(meta.label).toBe('Club 100');
    expect(meta.secondaryLabel).toContain('249,99 €/an');
  });
});

describe('STRIPE-OUVERTURE — un club en ESSAI GRATUIT achete une offre Club', () => {
  // Deux abonnements en meme temps : l'essai (provider manual) et l'achat neuf.
  // L'essai ne doit jamais etre pris pour « l'abonnement a changer » : sur le
  // site, un changement d'offre renvoie vers l'app mobile, l'achat serait bloque.
  // Le serveur, lui, remplace l'essai a l'encaissement (UPGRADE T4, admin).
  it('l essai n est PAS une cible de changement : c est un achat neuf', () => {
    const cible = resolveSubscriptionChangeTarget({
      catalogEntry: { planCode: 'fc_club_tier_1_yearly', scopeType: 'CLUB' },
      clubDocumentId: 'club-essai',
      clubVerificationSummary: { clubDocumentId: 'club-essai' },
      entitlementsSummary: [{
        paidBy: { documentId: 'user-1' },
        scopeClubDocumentId: 'club-essai',
        scopeType: 'CLUB',
        subscriptionPlanCode: 'fc_trial_club',
      }],
      subscriptionSummary: {
        activePlanCodes: ['fc_trial_club'],
        payerSubscriptionsSummary: [{
          documentId: 'sub-essai',
          isTrial: true,
          planCode: 'fc_trial_club',
          provider: 'manual',
          scopeClubDocumentIds: ['club-essai'],
          status: 'active',
        }],
      },
      userDocumentId: 'user-1',
    });
    expect(cible).toBeNull();
  });
});
