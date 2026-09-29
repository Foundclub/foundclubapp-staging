import {
  formatCollectiviteOfferedBy,
  formatSubscriptionPlanLabel,
  getCollectiviteOffer,
} from './subscriptionDecision';

// COLL1D (29/09) — L'OFFRE CLUB OFFERTE PAR LA COLLECTIVITE (SPEC D4, D13, §3).
// Le serveur nomme la collectivite sur le droit Club qu'elle offre
// (`entitlementsSummary[].offeredBy`, admin subscription-permission.ts, lot 1d).
// Ces deux fonctions pures disent, pour le club AFFICHE : « offert par qui ? », et
// comment la phrase « Offert par … » lit ce nom.

const droitOffert = (surcharges = {}) => ({
  capability: '*',
  offeredBy: { documentId: 'ville-recette', name: 'Ville de Recette' },
  paidBy: null,
  scopeClubDocumentId: 'club-aiki',
  scopeClubName: 'AIKI',
  scopeType: 'CLUB',
  status: 'active',
  subscriptionCurrentPeriodEnd: null,
  subscriptionPlanCode: 'fc_collectivite_club',
  ...surcharges,
});

/**
 * La collectivite qui offre, vue depuis ce club, pour ces droits.
 * @param {string} club - Le club affiche.
 * @param {any[]} droits - Le resume des droits du bootstrap.
 * @returns {any} Le verdict de getCollectiviteOffer.
 */
const offreVueDepuis = (club, droits) => getCollectiviteOffer({
  clubDocumentId: club,
  entitlementsSummary: droits,
});

describe('COLL1D — getCollectiviteOffer : qui offre l offre Club du club affiche', () => {
  it('un droit Club offert par la Ville SUR ce club : la Ville', () => {
    expect(offreVueDepuis('club-aiki', [droitOffert()]))
      .toEqual({ documentId: 'ville-recette', name: 'Ville de Recette' });
  });

  it('le meme droit vu depuis un AUTRE club : rien (le bandeau suit le club affiche)', () => {
    expect(offreVueDepuis('club-demo', [droitOffert()])).toBeNull();
  });

  it('un droit Club PAYE (offeredBy null) : rien', () => {
    const paye = droitOffert({
      offeredBy: null,
      paidBy: { documentId: 'u', firstname: 'Mouri' },
      subscriptionPlanCode: 'fc_club_tier_1_yearly',
    });
    expect(offreVueDepuis('club-aiki', [paye])).toBeNull();
  });

  it('un serveur d avant le lot (champ absent), un resume vide, un club absent : rien', () => {
    const { offeredBy, ...ancien } = droitOffert();
    expect(offeredBy).toBeTruthy();
    expect(offreVueDepuis('club-aiki', [ancien])).toBeNull();
    expect(offreVueDepuis('club-aiki', [])).toBeNull();
    expect(offreVueDepuis('', [droitOffert()])).toBeNull();
    expect(getCollectiviteOffer()).toBeNull();
  });

  it('un nom vide ne fait pas de bandeau (« Offert par  » ne veut rien dire)', () => {
    const sansNom = droitOffert({ offeredBy: { documentId: 'ville-recette', name: '  ' } });
    expect(offreVueDepuis('club-aiki', [sansNom])).toBeNull();
  });
});

describe('COLL1D — formatCollectiviteOfferedBy : le nom tel que « Offert par … » le lit', () => {
  it('fr : « Ville de X », « Commune de X », « Métropole de X » prennent « la »', () => {
    expect(formatCollectiviteOfferedBy('Ville de Recette', 'fr')).toBe('la Ville de Recette');
    expect(formatCollectiviteOfferedBy('Commune de Saint-Priest', 'fr'))
      .toBe('la Commune de Saint-Priest');
    expect(formatCollectiviteOfferedBy('Métropole de Lyon', 'fr')).toBe('la Métropole de Lyon');
    expect(formatCollectiviteOfferedBy('Communauté de communes du Pays de Gex', 'fr'))
      .toBe('la Communauté de communes du Pays de Gex');
    expect(formatCollectiviteOfferedBy('Région Auvergne-Rhône-Alpes', 'fr'))
      .toBe('la Région Auvergne-Rhône-Alpes');
  });

  it('fr : « Département du X » prend « le »', () => {
    expect(formatCollectiviteOfferedBy('Département du Rhône', 'fr'))
      .toBe('le Département du Rhône');
  });

  it('fr : un nom propre nu reste tel quel ; un nom qui a deja son article aussi', () => {
    expect(formatCollectiviteOfferedBy('Lyon', 'fr')).toBe('Lyon');
    expect(formatCollectiviteOfferedBy('la Ville de Recette', 'fr')).toBe('la Ville de Recette');
  });

  it('en : le nom tel quel', () => {
    expect(formatCollectiviteOfferedBy('Ville de Recette', 'en')).toBe('Ville de Recette');
  });
});

describe('COLL1D — le plan de la collectivite a un nom (jamais « Fc Collectivite Club »)', () => {
  it('formatSubscriptionPlanLabel', () => {
    expect(formatSubscriptionPlanLabel('fc_collectivite_club'))
      .toBe('Club · offert par la collectivité');
  });
});
