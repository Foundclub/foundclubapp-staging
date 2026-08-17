import fs from 'fs';
import path from 'path';

import fr from '@/theme/strings/translations/fr';

import {
  formatSubscriptionPriceLabel,
  getSubscriptionBillingErrorMessage,
  getSubscriptionCatalogEntryMeta,
  getSubscriptionEntryTierRank,
  sortSubscriptionCatalogEntries,
} from './subscriptionBilling';
import {
  formatSubscriptionPlanLabel,
  formatSubscriptionRequiredPlanText,
  getSubscriptionPaywallContent,
  getSubscriptionRequiredPlanLabels,
  getSubscriptionStatusMeta,
} from './subscriptionDecision';

/**
 * T09 — un produit qui porte trois noms est trois produits dans la tete du client.
 *
 * Constat d'Adel du 2026-08-17 : « il y a un probleme avec la page "voir mon
 * offre" et le nom de l'abonnement ». Mesure : l'ecran des offres vend
 * « Équipe · 1 équipe » (displayName du catalogue serveur,
 * admin/src/api/subscription/services/subscription-catalog.ts:61) pendant que
 * l'ecran « Mon abonnement » affiche « Team 1 equipe / an »
 * (formatSubscriptionPlanLabel). Meme produit, deux noms, deux ecrans qui se
 * suivent.
 *
 * Ces quatre temoins gelent le NOM. Ils ne disent rien des prix ni des paliers :
 * le temoin 4 est justement la pour prouver qu'on n'y a pas touche.
 */

// Copie EXACTE de ce que le serveur envoie (subscription-catalog.ts:57-88).
// Un catalogue invente ne prouverait rien : c'est la divergence avec CE
// catalogue-la qui est le defaut.
const CATALOGUE_SERVEUR = [
  {
    billingPeriod: 'yearly',
    displayName: 'Équipe · 1 équipe',
    planCode: 'fc_team_1_yearly',
    referencePriceEurCents: 4999,
    scopeType: 'TEAM',
    slotCount: 1,
  },
  {
    billingPeriod: 'monthly',
    displayName: 'Équipe · 2 équipes',
    planCode: 'fc_team_2_monthly',
    referencePriceEurCents: 899,
    scopeType: 'TEAM',
    slotCount: 2,
  },
  {
    billingPeriod: 'yearly',
    displayName: 'Club S',
    planCode: 'fc_club_tier_1_yearly',
    referencePriceEurCents: 19999,
    scopeType: 'CLUB',
    slotCount: null,
  },
  {
    billingPeriod: 'monthly',
    displayName: 'Club M',
    planCode: 'fc_club_tier_2_monthly',
    referencePriceEurCents: 3499,
    scopeType: 'CLUB',
    slotCount: null,
  },
  {
    billingPeriod: 'yearly',
    displayName: 'Club L',
    planCode: 'fc_club_tier_3_yearly',
    referencePriceEurCents: 54999,
    scopeType: 'CLUB',
    slotCount: null,
  },
];

// Les mots anglais que l'app melangeait au francais. `slot` est de la meme
// famille : c'est le mot du code, jamais celui du client.
const MOTS_ANGLAIS = /\b(Team|team|tier|Tier|slots?|Slots?)\b/;

// Codes d'erreur d'achat REELS du serveur (subscriptionBilling.js:557-575).
const ERREURS_ACHAT = [
  'TEAM_SLOT_DUPLICATE_TEAM',
  'TEAM_SLOT_COUNT_EXCEEDED',
  'TEAM_ALREADY_COVERED',
  'CLUB_ALREADY_COVERED',
];

/**
 * Les mots anglais presents dans un texte affiche.
 * @param {string} valeur
 * @returns {string[]}
 */
const motsAnglaisDe = (valeur) => (
  String(valeur || '').match(new RegExp(MOTS_ANGLAIS, 'g')) || []
);

describe('T09 temoin 1 — le nom du produit est le meme des offres a l abonnement', () => {
  it.each(CATALOGUE_SERVEUR)(
    'le nom porte par « Mon abonnement » reprend celui vendu par « Changer d offre » — $planCode',
    (entree) => {
      // Ce que l'ecran des offres affiche (getSubscriptionCatalogEntryMeta lit
      // le displayName du serveur en priorite).
      const nomVendu = getSubscriptionCatalogEntryMeta(entree).label;
      // Ce que l'ecran « Mon abonnement » affiche : il ne connait QUE le
      // planCode (SubscriptionOverview.js:239), donc que ce formateur.
      const nomAffiche = formatSubscriptionPlanLabel(entree.planCode);

      expect(nomVendu).toBe(entree.displayName);
      expect(nomAffiche).toContain(entree.displayName);
    },
  );

  it('l etiquette d etat d un abonne Équipe emploie le mot vendu', () => {
    expect(getSubscriptionStatusMeta('TEAM').label).toBe('Équipe');
  });

  it('les offres conseillees d un refus portent les noms vendus, pas les codes internes', () => {
    expect(getSubscriptionRequiredPlanLabels(['TEAM', 'CLUB'])).toEqual(['Équipe', 'Club']);
    expect(formatSubscriptionRequiredPlanText(['TEAM', 'CLUB'])).toBe('Équipe ou Club');
  });
});

describe('T09 temoin 2 — aucun ecran n emploie deux mots differents pour la meme chose', () => {
  /**
   * Tout ce que la couche de nommage rend a l ecran, en une seule liste.
   * @returns {string[]}
   */
  const textesAffiches = () => {
    const textes = [];

    CATALOGUE_SERVEUR.forEach((entree) => {
      textes.push(formatSubscriptionPlanLabel(entree.planCode));
      const meta = getSubscriptionCatalogEntryMeta(entree);
      textes.push(meta.label, meta.description, meta.secondaryLabel);
    });

    ['FREE', 'TEAM', 'CLUB', 'CLUB_UNVERIFIED'].forEach((niveau) => {
      const meta = getSubscriptionStatusMeta(niveau);
      textes.push(meta.label, meta.description);
    });

    textes.push(formatSubscriptionRequiredPlanText(['TEAM', 'CLUB']));

    // Les refus : c'est la ou le client lit le nom de l offre qu'on lui demande.
    [
      'composition-manage-required',
      'club-roles-manage-required',
      'club-tier-team-limit',
      'team-limit',
    ].forEach((paywallKey) => {
      const contenu = getSubscriptionPaywallContent({
        allowed: false,
        paywall: { paywallKey, requiredPlan: ['TEAM', 'CLUB'] },
      });
      textes.push(contenu.ctaLabel, contenu.description, contenu.title);
    });

    // Les erreurs d achat, lues dans une Alert par-dessus l ecran des offres.
    // Ce sont les codes REELS renvoyes par le serveur (subscriptionBilling.js:557-575) :
    // un code invente retomberait sur « message tel quel » et ne prouverait rien.
    ERREURS_ACHAT.forEach((code) => {
      textes.push(getSubscriptionBillingErrorMessage({
        response: { data: { error: { message: code } } },
      }));
    });

    return textes.filter((texte) => typeof texte === 'string' && texte.length > 0);
  };

  it('aucun texte rendu par la couche de nommage ne melange un mot anglais au francais', () => {
    const textes = textesAffiches();
    // Sans ce garde-fou, une signature qui change rendrait la liste vide et ce
    // temoin passerait au vert sans plus rien mesurer.
    expect(textes.length).toBeGreaterThan(30);
    expect(textes.filter((texte) => MOTS_ANGLAIS.test(texte))).toEqual([]);
  });

  it('aucune alerte en dur de l ecran des offres ne dit « Team » ni « slot »', () => {
    // Ces trois messages ne passent par aucune fonction : ils sont poses dans
    // Alert.alert(...) au milieu de l ecran, donc invisibles au controle
    // ci-dessus. On les lit dans la source, commentaires retires.
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'views', 'profile', 'SubscriptionOffers.js'),
      'utf8',
    );
    const sansCommentaires = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((ligne) => !ligne.trim().startsWith('//'))
      .join('\n');

    const litterauxFrancais = (sansCommentaires.match(/'(?:[^'\\\n]|\\.)*'/g) || [])
      .map((litteral) => litteral.slice(1, -1))
      .filter((texte) => /\b(offre|offres|équipe|équipes|equipe|equipes|abonnement|palier)\b/i.test(texte));

    // Meme garde-fou : si le scanner ne trouve plus aucune phrase francaise,
    // c'est lui qui est casse, pas l'ecran qui est devenu propre.
    expect(litterauxFrancais.length).toBeGreaterThan(10);
    expect(litterauxFrancais.filter((texte) => MOTS_ANGLAIS.test(texte))).toEqual([]);
  });

  it('le mot du client pour une unite de couverture est « place », jamais « slot »', () => {
    const message = getSubscriptionBillingErrorMessage({
      response: { data: { error: { message: 'TEAM_SLOT_COUNT_EXCEEDED' } } },
    });
    expect(motsAnglaisDe(message)).toEqual([]);
    expect(message).toMatch(/place/i);
  });
});

describe('T09 temoin 3 — aucune cle de fr.js n a disparu', () => {
  // Ensemble RELEVE sur staging 897afc6 avant le lot. La comparaison porte sur
  // les CLES, jamais sur les lignes : changer une valeur compte pour « 1
  // suppression + 1 ajout » et ferait croire a une perte qui n existe pas
  // (CLAUDE.md §2 quinquies).
  const CLES_OFFRE_AVANT = [
    'profile.subscription.actions.changeOffer',
    'profile.subscription.actions.compareOffers',
    'profile.subscription.actions.restore',
    'profile.subscription.actions.viewClub',
    'profile.subscription.actions.viewClubHint',
    'profile.subscription.actions.viewOffers',
    'profile.subscription.compareHeaderTitle',
    'profile.subscription.cta',
    'profile.subscription.headerTitle',
    'profile.subscription.offersHeaderTitle',
    'profile.subscription.quota.labels.EVENT_PUBLISH',
    'profile.subscription.quota.labels.FREE_TEAM',
    'profile.subscription.quota.labels.MATCH_PUBLISH',
    'profile.subscription.quota.labels.RECRUITMENT_AD_PUBLISH',
    'profile.subscription.quota.remaining_one',
    'profile.subscription.quota.remaining_other',
    'profile.subscription.quota.used',
    'profile.subscription.states.club',
    'profile.subscription.states.clubUnverified',
    'profile.subscription.states.free',
    'profile.subscription.states.team',
    'profile.subscription.status.club',
    'profile.subscription.status.clubUnverified',
    'profile.subscription.status.free',
    'profile.subscription.status.team',
    'profile.subscription.title',
    'compositionPaywall.actions.compare',
    'compositionPaywall.actions.subscribe',
    'compositionPaywall.subtitle',
    'compositionPaywall.text',
    'compositionPaywall.title',
    'compositionPaywall.wall',
    'subscriptionSuccess.firstActionTitle',
    'subscriptionSuccess.unlockedTitle',
    'homeHub.cards.profile.subscription.fallbackSubtitle',
    'homeHub.cards.profile.subscription.title',
    'APIerrors.SUBSCRIPTION_PERMISSION_DENIED',
  ];

  /**
   * Lit une valeur par son chemin pointe.
   * @param {any} noeud
   * @param {string} chemin
   * @returns {any}
   */
  const lire = (noeud, chemin) => chemin.split('.').reduce(
    (courant, segment) => (
      courant === undefined || courant === null ? undefined : courant[segment]
    ),
    noeud,
  );

  it.each(CLES_OFFRE_AVANT)('la cle %s existe toujours et porte un texte', (cle) => {
    const valeur = lire(fr, cle);
    expect(typeof valeur).toBe('string');
    expect(valeur.length).toBeGreaterThan(0);
  });
});

describe('T09 temoin 4 — les paliers et leurs prix sont inchanges', () => {
  it.each(CATALOGUE_SERVEUR)('le prix affiche de $planCode ne bouge pas', (entree) => {
    expect(getSubscriptionCatalogEntryMeta(entree).priceLabel).toBe(
      formatSubscriptionPriceLabel(entree.referencePriceEurCents, entree.billingPeriod),
    );
  });

  it('les prix de reference gardent leur libelle exact', () => {
    expect(formatSubscriptionPriceLabel(4999, 'yearly')).toBe('49,99 €/an');
    expect(formatSubscriptionPriceLabel(899, 'monthly')).toBe('8,99 €/mois');
    expect(formatSubscriptionPriceLabel(19999, 'yearly')).toBe('199,99 €/an');
    expect(formatSubscriptionPriceLabel(3499, 'monthly')).toBe('34,99 €/mois');
    expect(formatSubscriptionPriceLabel(54999, 'yearly')).toBe('549,99 €/an');
  });

  it('le rang de palier reste lu au meme endroit : equipes cote Équipe, code cote Club', () => {
    expect(getSubscriptionEntryTierRank(CATALOGUE_SERVEUR[0])).toBe(1);
    expect(getSubscriptionEntryTierRank(CATALOGUE_SERVEUR[1])).toBe(2);
    expect(getSubscriptionEntryTierRank(CATALOGUE_SERVEUR[2])).toBe(1);
    expect(getSubscriptionEntryTierRank(CATALOGUE_SERVEUR[3])).toBe(2);
    expect(getSubscriptionEntryTierRank(CATALOGUE_SERVEUR[4])).toBe(3);
  });

  it('l ordre des offres ne bouge pas : Équipe avant Club, palier croissant', () => {
    const ordre = sortSubscriptionCatalogEntries(CATALOGUE_SERVEUR).map((e) => e.planCode);
    expect(ordre).toEqual([
      'fc_team_1_yearly',
      'fc_team_2_monthly',
      'fc_club_tier_1_yearly',
      'fc_club_tier_2_monthly',
      'fc_club_tier_3_yearly',
    ]);
  });

  it('le nombre d equipes couvertes annonce par une offre Équipe est inchange', () => {
    expect(getSubscriptionCatalogEntryMeta(CATALOGUE_SERVEUR[0]).secondaryLabel)
      .toContain('1 équipe couverte');
    expect(getSubscriptionCatalogEntryMeta(CATALOGUE_SERVEUR[1]).secondaryLabel)
      .toContain('2 équipes couvertes');
  });
});
