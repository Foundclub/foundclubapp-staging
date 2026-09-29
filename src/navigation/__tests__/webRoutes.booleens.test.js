import { RouteNames } from '@/navigation/routeNames';
import { createWebNavigationAdapter } from '@/navigation/webNavigationAdapter';
import { buildWebPath, readWebQueryParams } from '@/navigation/webRoutes';

/**
 * URL-BOOLEENS (29/09) — SUR LE SITE, « false » DANS UNE ADRESSE ETAIT LU VRAI.
 *
 * Sur le site, les parametres d'un ecran voyagent dans l'adresse : `buildWebPath`
 * les ecrit, `useSharedScreenProps` (depot web) les relit par `readWebQueryParams`.
 * Une adresse ne porte que des chaines : `?canEdit=false` rendait la chaine
 * « false », NON VIDE donc VRAIE — un simple lecteur voyait « Modifier ». Dans
 * l'autre sens, `preview === true` ne reconnaissait plus un `true` devenu « true ».
 *
 * Ce temoin rejoue le trajet complet, ECRITURE puis LECTURE, pour les parametres
 * releves par le recensement du 29/09 (chaque cas cite l'appelant reel).
 */

/**
 * Ce que l'ecran d'arrivee recoit sur le site.
 * @param {string} routeName
 * @param {Record<string, unknown>} params
 * @returns {Record<string, any>}
 */
const surLeSite = (routeName, params) => {
  const adresse = new URL(buildWebPath(routeName, params), 'https://foundclub.app');
  return readWebQueryParams(adresse.searchParams);
};

describe('URL-BOOLEENS — l adresse elle-meme ne change pas', () => {
  it('buildWebPath ecrit toujours false et true, et saute vide, null et objets', () => {
    expect(buildWebPath(RouteNames.MatchCompositionBoard, {
      canEdit: false,
      eventId: 'evt-1',
      existingComposition: { teams: [] },
      readOnly: true,
      sport: '',
      teamName: undefined,
    })).toBe('/match/composition/board?canEdit=false&eventId=evt-1&readOnly=true');
  });
});

describe('URL-BOOLEENS — un false ne se relit plus jamais vrai', () => {
  it.each([
    // PlayerConvocationScreen.js:281 — le terrain de « Tu es convoque ».
    [RouteNames.MatchCompositionBoard, 'canEdit'],
    // EventDetails.web.js:1920, TacticalBoard.js:985, CompositionMessageBubble.js:313.
    [RouteNames.TacticalBoardV2, 'canEdit'],
    // TacticalBoard.js:995.
    [RouteNames.TacticalBoardV2, 'readOnly'],
    // MatchCompositionBoard.js:678 et EventDetails.js:4737 — « Modifier » de l'entraineur.
    [RouteNames.MatchCallUpSelection, 'readOnly'],
    // ClubDetails.js:872, RecruitmentAdDetails.js:747.
    [RouteNames.VisualShowcase, 'chatShareEnabled'],
  ])('%s · %s = false arrive FAUX', (routeName, key) => {
    const lu = surLeSite(routeName, { eventId: 'evt-1', [key]: false });

    expect(lu[key]).toBe(false);
  });

  it('dans une pile imbriquee ({ screen, params }) aussi', () => {
    const lu = surLeSite('EventStack', {
      params: { canEdit: false, eventId: 'evt-1', readOnly: true },
      screen: RouteNames.MatchCompositionBoard,
    });

    expect(lu).toEqual(expect.objectContaining({ canEdit: false, readOnly: true }));
  });
});

describe('URL-BOOLEENS — un true reste vrai, meme pour qui compare a true', () => {
  it('UserDetails.js:366 lit preview === true (« Voir mon profil comme les autres »)', () => {
    // SelfProfileUnified.js:689, SelfProfilePlayerCoach.js:682 et 1057.
    const lu = surLeSite(RouteNames.UserDetails, { preview: true, userId: 'u-1' });

    expect(lu.preview === true).toBe(true);
  });

  it('le plein ecran en lecture seule garde readOnly et refreshFromServer', () => {
    const lu = surLeSite(RouteNames.MatchCompositionBoard, {
      eventId: 'evt-1', readOnly: true, refreshFromServer: true,
    });

    expect(lu.readOnly).toBe(true);
    expect(lu.refreshFromServer).toBe(true);
  });
});

describe('URL-BOOLEENS — le cas « vrai par defaut » reste intact', () => {
  // SearchHubScreen.js:77 : `enableMapMode !== false` — le seul lecteur de
  // parametre de route « vrai par defaut » du depot au 29/09. C'est lui qui
  // interdit de sauter `false` a l'ecriture : absent, il vaudrait VRAI.
  const lireCommeSearchHub = (params) => params.enableMapMode !== false;

  it('passe a false, il reste faux', () => {
    const lu = surLeSite(RouteNames.SearchHub, { enableMapMode: false });

    expect(lireCommeSearchHub(lu)).toBe(false);
  });

  it('absent, il garde son defaut vrai', () => {
    expect(lireCommeSearchHub(surLeSite(RouteNames.SearchHub, {}))).toBe(true);
  });
});

describe('URL-BOOLEENS — l entraineur qui modifie sur le site garde la main', () => {
  it('« Modifier » (MatchCompositionBoard.js:675) puis « Suivant » : plus de lecture seule', () => {
    // Le terrain consulte en lecture seule, par un entraineur.
    const consultation = surLeSite(RouteNames.MatchCompositionBoard, {
      canEdit: true, eventId: 'evt-1', readOnly: true, refreshFromServer: true, teamId: 't-1',
    });
    // « Modifier » : `{ ...params, canEdit: true, readOnly: false }` vers la selection.
    const selection = surLeSite(RouteNames.MatchCallUpSelection, {
      ...consultation, canEdit: true, readOnly: false,
    });
    // « Suivant » (MatchCallUpSelection.js:417) retransmet `...params` au terrain.
    const terrain = surLeSite(RouteNames.MatchCompositionBoard, { ...selection });

    // MatchCompositionBoard.js:165 : `isReadOnly = Boolean(readOnly)`.
    expect(Boolean(terrain.readOnly)).toBe(false);
    expect(terrain.canEdit).toBe(true);
  });
});

describe('URL-BOOLEENS — navigation.setParams, le 2e ecrivain, est relu juste', () => {
  it('Profile.js:124 consomme openAccountModal par setParams({ openAccountModal: false })', () => {
    /** @type {Record<string, unknown>[]} */
    const ecrit = [];
    const navigation = createWebNavigationAdapter({
      params: surLeSite(RouteNames.Profile, { openAccountModal: true }),
      setSearchParams: (/** @type {Record<string, unknown>} */ next) => ecrit.push(next),
    });

    navigation.setParams({ openAccountModal: false });

    // react-router (`createSearchParams`) met chaque valeur en chaine, sans passer
    // par buildQueryString : c'est ce que l'ecran relit ensuite.
    const adresse = new URLSearchParams(
      Object.entries(ecrit[0]).map(([key, value]) => [key, String(value)]),
    );
    expect(readWebQueryParams(adresse).openAccountModal).toBe(false);
  });
});

describe('URL-BOOLEENS — le reste reste une chaine', () => {
  it('identifiants, textes et nombres arrivent comme avant', () => {
    const lu = surLeSite(RouteNames.MatchCompositionBoard, {
      eventId: 'evt-1', publishedVersion: 2, teamName: 'Aix-Perd en Buvette',
    });

    expect(lu).toEqual({
      eventId: 'evt-1', publishedVersion: '2', teamName: 'Aix-Perd en Buvette',
    });
  });
});
