import {
  canApplyToFriendlyMatchAd,
  canPublishFriendlyMatchAd,
  filterFriendlyMatchAds,
  getAllowedChosenHostings,
  getAllowedFriendlyMatchTabs,
  getDefaultFriendlyMatchTab,
  getDistanceKm,
  getFormatsForSport,
  getHostingSummary,
  getNextCandidateDate,
  isChosenHostingAllowed,
  matchesHostingIntent,
  normalizeCandidateDates,
  sanitizeFriendlyMatchTabForRole,
} from '@/domains/search/friendlyMatchFlow';

const coach = { role: { name: 'Entraineur' } };
const president = { role: { name: 'Dirigeant' } };
const player = { role: { name: 'Joueur' } };
const anonymous = undefined;

const buildAd = (overrides = {}) => ({
  candidateDates: [{ date: '2027-05-15' }],
  hostingPreference: 'BOTH',
  ...overrides,
});

describe('friendlyMatchFlow — partage des onglets par role (Q12)', () => {
  it('ouvre les 3 onglets au staff, et le seul onglet public au reste', () => {
    const staffTabs = ['annonces', 'mes-annonces', 'candidatures'];

    expect(getAllowedFriendlyMatchTabs(coach)).toEqual(staffTabs);
    expect(getAllowedFriendlyMatchTabs(president)).toEqual(staffTabs);
    expect(getAllowedFriendlyMatchTabs(player)).toEqual(['annonces']);
    expect(getAllowedFriendlyMatchTabs(anonymous)).toEqual(['annonces']);
  });

  it('laisse la LISTE visible a tout le monde, mais reserve publier et candidater au staff', () => {
    expect(getDefaultFriendlyMatchTab(anonymous)).toBe('annonces');
    expect(getDefaultFriendlyMatchTab(player)).toBe('annonces');
    expect(getDefaultFriendlyMatchTab(coach)).toBe('annonces');

    expect(canPublishFriendlyMatchAd(coach)).toBe(true);
    expect(canPublishFriendlyMatchAd(president)).toBe(true);
    expect(canPublishFriendlyMatchAd(player)).toBe(false);
    expect(canPublishFriendlyMatchAd(anonymous)).toBe(false);

    expect(canApplyToFriendlyMatchAd(coach)).toBe(true);
    expect(canApplyToFriendlyMatchAd(president)).toBe(true);
    expect(canApplyToFriendlyMatchAd(player)).toBe(false);
    expect(canApplyToFriendlyMatchAd(anonymous)).toBe(false);
  });

  it('ramene un onglet interdit sur un onglet autorise plutot que d afficher du vide', () => {
    expect(sanitizeFriendlyMatchTabForRole('candidatures', player)).toBe('annonces');
    expect(sanitizeFriendlyMatchTabForRole('mes-annonces', anonymous)).toBe('annonces');
    expect(sanitizeFriendlyMatchTabForRole('candidatures', coach)).toBe('candidatures');
    expect(sanitizeFriendlyMatchTabForRole('MES-ANNONCES', coach)).toBe('mes-annonces');
    expect(sanitizeFriendlyMatchTabForRole(undefined, coach)).toBe('annonces');
    expect(sanitizeFriendlyMatchTabForRole('inconnu', coach, 'candidatures')).toBe('candidatures');
  });

  it('reconnait le staff quelle que soit l orthographe du role', () => {
    expect(canPublishFriendlyMatchAd('Entraîneur')).toBe(true);
    expect(canPublishFriendlyMatchAd('coach')).toBe(true);
    expect(canPublishFriendlyMatchAd('President')).toBe(true);
    expect(canPublishFriendlyMatchAd('SuperAdmin')).toBe(true);
    expect(canPublishFriendlyMatchAd('Authenticated')).toBe(false);
  });
});

describe('friendlyMatchFlow — regle « qui recoit » (§3.3, Q1)', () => {
  it('renvoie exactement le choix inverse de la preference de l annonce', () => {
    expect(getAllowedChosenHostings('HOST')).toEqual(['AWAY']);
    expect(getAllowedChosenHostings('AWAY')).toEqual(['HOST']);
    expect(getAllowedChosenHostings('BOTH')).toEqual(['HOST', 'AWAY']);
    expect(getAllowedChosenHostings(undefined)).toEqual([]);
    expect(getAllowedChosenHostings('DEBOUT')).toEqual([]);
  });

  it('couvre les 3 preferences x les 2 choix, et refuse le choix non coche', () => {
    expect(isChosenHostingAllowed('HOST', 'AWAY')).toBe(true);
    expect(isChosenHostingAllowed('HOST', 'HOST')).toBe(false);
    expect(isChosenHostingAllowed('AWAY', 'HOST')).toBe(true);
    expect(isChosenHostingAllowed('AWAY', 'AWAY')).toBe(false);
    expect(isChosenHostingAllowed('BOTH', 'HOST')).toBe(true);
    expect(isChosenHostingAllowed('BOTH', 'AWAY')).toBe(true);

    // Le choix est TOUJOURS explicite, meme quand une seule valeur est possible.
    expect(isChosenHostingAllowed('HOST', undefined)).toBe(false);
    expect(isChosenHostingAllowed('HOST', '')).toBe(false);
    expect(isChosenHostingAllowed('BOTH', null)).toBe(false);
  });

  it('dit en TEXTE qui recoit, jamais par la couleur seule', () => {
    expect(getHostingSummary({ hostingPreference: 'HOST' }).label).toBe('Il reçoit');
    expect(getHostingSummary({ hostingPreference: 'AWAY' }).label).toBe('Il se déplace');
    expect(getHostingSummary({ hostingPreference: 'BOTH' }).label).toBe('Reçoit ou se déplace');
    expect(getHostingSummary({}).label).toBe('À convenir');
  });
});

describe('friendlyMatchFlow — le filtre masque, il n affiche pas d erreur (§3.3)', () => {
  it('masque les annonces incompatibles avec « je veux recevoir »', () => {
    expect(matchesHostingIntent({ hostingPreference: 'AWAY' }, 'host')).toBe(true);
    expect(matchesHostingIntent({ hostingPreference: 'BOTH' }, 'host')).toBe(true);
    expect(matchesHostingIntent({ hostingPreference: 'HOST' }, 'host')).toBe(false);
  });

  it('masque les annonces incompatibles avec « je veux me deplacer »', () => {
    expect(matchesHostingIntent({ hostingPreference: 'HOST' }, 'away')).toBe(true);
    expect(matchesHostingIntent({ hostingPreference: 'BOTH' }, 'away')).toBe(true);
    expect(matchesHostingIntent({ hostingPreference: 'AWAY' }, 'away')).toBe(false);
  });

  it('ne masque rien sans intention exprimee', () => {
    expect(matchesHostingIntent({ hostingPreference: 'HOST' }, 'any')).toBe(true);
    expect(matchesHostingIntent({ hostingPreference: 'AWAY' }, undefined)).toBe(true);
    expect(matchesHostingIntent({ hostingPreference: 'HOST' }, '')).toBe(true);
  });

  it('applique ensemble intention, categorie, niveau et format', () => {
    const ads = [
      buildAd({
        category: { documentId: 'cat-u15', name: 'U15' },
        format: '11v11',
        hostingPreference: 'HOST',
        id: 'a',
        level: { documentId: 'lvl-d2' },
      }),
      buildAd({
        category: { documentId: 'cat-u15', name: 'U15' },
        format: '7v7',
        hostingPreference: 'BOTH',
        id: 'b',
        level: { documentId: 'lvl-d2' },
      }),
      buildAd({
        category: { documentId: 'cat-senior' },
        format: '11v11',
        hostingPreference: 'BOTH',
        id: 'c',
        level: { documentId: 'lvl-d2' },
      }),
    ];

    expect(filterFriendlyMatchAds(ads, { hostingIntent: 'away' }).map((ad) => ad.id))
      .toEqual(['a', 'b', 'c']);
    expect(filterFriendlyMatchAds(ads, { hostingIntent: 'host' }).map((ad) => ad.id))
      .toEqual(['b', 'c']);
    expect(filterFriendlyMatchAds(ads, { category: 'cat-u15' }).map((ad) => ad.id))
      .toEqual(['a', 'b']);
    expect(filterFriendlyMatchAds(ads, { format: '11v11' }).map((ad) => ad.id))
      .toEqual(['a', 'c']);
    expect(filterFriendlyMatchAds(ads, { level: 'lvl-d2' })).toHaveLength(3);
    expect(filterFriendlyMatchAds(ads, { category: 'cat-u15', hostingIntent: 'host' })
      .map((ad) => ad.id)).toEqual(['b']);
  });

  it('garde une annonce dont la distance est inconnue, mais coupe au-dela du rayon', () => {
    const marseille = { lat: 43.2965, lon: 5.3698 };
    const ads = [
      buildAd({ id: 'proche', location: { lat: 43.31, lon: 5.38 } }),
      buildAd({ id: 'loin', location: { lat: 48.8566, lon: 2.3522 } }),
      buildAd({ id: 'sans-coord', location: { city: 'Marseille' } }),
    ];

    const kept = filterFriendlyMatchAds(ads, {
      maxDistanceKm: 30,
      viewerLocation: marseille,
    }).map((ad) => ad.id);

    expect(kept).toEqual(['proche', 'sans-coord']);
  });

  it('filtre par periode sur les dates candidates', () => {
    const now = new Date('2027-05-01T12:00:00.000Z');
    const ads = [
      buildAd({ candidateDates: [{ date: '2027-05-03' }], id: 'cette-semaine' }),
      buildAd({ candidateDates: [{ date: '2027-06-20' }], id: 'plus-tard' }),
      buildAd({ candidateDates: [], id: 'sans-date' }),
    ];

    expect(filterFriendlyMatchAds(ads, { periodDays: 7 }, now).map((ad) => ad.id))
      .toEqual(['cette-semaine']);
    expect(filterFriendlyMatchAds(ads, { periodDays: 90 }, now).map((ad) => ad.id))
      .toEqual(['cette-semaine', 'plus-tard']);
    expect(filterFriendlyMatchAds(ads, {}, now)).toHaveLength(3);
  });
});

describe('friendlyMatchFlow — dates candidates et catalogue de formats', () => {
  it('nettoie, trie et ECARTE les entrees illisibles sans planter', () => {
    expect(normalizeCandidateDates([
      { date: '2027-05-16' },
      { date: '2027-05-15', end: '16:00', start: '14:00' },
      { date: 'pas-une-date' },
      null,
      { date: '2027-05-14', start: '99:99' },
    ])).toEqual([
      { date: '2027-05-14' },
      { date: '2027-05-15', end: '16:00', start: '14:00' },
      { date: '2027-05-16' },
    ]);

    expect(normalizeCandidateDates('[{"date":"2027-05-15"}]')).toEqual([{ date: '2027-05-15' }]);
    expect(normalizeCandidateDates('pas du json')).toEqual([]);
    expect(normalizeCandidateDates(undefined)).toEqual([]);
  });

  it('prend le premier creneau a venir, sinon le premier de la liste', () => {
    const now = new Date('2027-05-15T18:00:00.000Z');
    const ad = buildAd({
      candidateDates: [{ date: '2027-05-15', end: '16:00' }, { date: '2027-05-16' }],
    });

    expect(getNextCandidateDate(ad, now)).toEqual({ date: '2027-05-16' });
    expect(getNextCandidateDate(buildAd({ candidateDates: [] }), now)).toBeNull();
  });

  it('propose un catalogue par sport, toujours complete par « Autre »', () => {
    expect(getFormatsForSport('Football')).toEqual(['11v11', '8v8', '7v7', '5v5', 'Autre']);
    expect(getFormatsForSport('Football à 5')).toEqual(['5v5', 'Autre']);
    expect(getFormatsForSport('BASKETBALL')).toEqual(['5v5', '3x3', 'Autre']);
    expect(getFormatsForSport('Ultimate frisbee')).toEqual(['Autre']);
    expect(getFormatsForSport(undefined)).toEqual(['Autre']);
  });

  it('rend null quand une distance ne peut pas etre calculee', () => {
    const marseille = { lat: 43.2965, lon: 5.3698 };
    const paris = { lat: 48.8566, lon: 2.3522 };

    expect(getDistanceKm(marseille, null)).toBeNull();
    expect(getDistanceKm(null, marseille)).toBeNull();
    expect(getDistanceKm(marseille, { city: 'Paris' })).toBeNull();
    expect(Math.round(/** @type {number} */ (getDistanceKm(marseille, paris)))).toBe(660);
  });
});
