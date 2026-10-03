/* eslint-disable max-len -- les phrases de l’écran sont citées en entier */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';
import { getWebRoutePattern } from '@/navigation/webRoutes';

import AdminCollectiviteInvitations from '../AdminCollectiviteInvitations';
import AdminCollectiviteList from '../AdminCollectiviteList';

// 🏛️ COLL-CONSOLE (02/10) — PLANCHE 1 : la carte « Collectivités » porte ce qui attend l'équipe
// FoundClub (design HY521H1, page 2, « P2-console », état 2 et B) : les mairies à activer, la
// file des demandes de gestionnaire (COLL-ACCUEIL), et les demandes de rattachement et
// invitations « Par FoundClub » du lot COLL-CLUBS — qui n'avaient AUCUN écran (ROUGE avant
// le lot : l'écran AdminCollectiviteInvitations n'existait pas).
//
//   A1-A2 — « À traiter » en tête de la liste : les nombres, le filtre « Mairies à activer »,
//           et les portes vers les demandes ;
//   I1    — les trois onglets et ce que dit chaque demande (Ville, date, hors commune) ;
//   I2    — « Rattacher » fait le geste de la fiche (POST …/clubs/:clubId) ; le serveur
//           prévient les dirigeants, l'écran le dit ; les demandes sont RELUES ;
//   I3    — « Par FoundClub » : le contact donné par la mairie, les relances ; « Relier à son
//           club inscrit » cherche le club et pose la liaison (PUT …/club) ;
//   I4    — une demande reliée se rattache, ou se délie (PUT …/club, null) ;
//   I5    — un refus du serveur (409) s'écrit sous la demande ; une lecture refusée (403) le dit.
// Le client HTTP est doublé ; le VRAI i18next (fr.js) écrit les phrases.

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
// COLL-CONSOLE (02/10) — un écran entier monté avec react-query : sous charge (suite complète,
// PC occupé), le premier cas paie le chargement des modules et dépassait les 5 s par défaut.
jest.setTimeout(30000);

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: (...args) => mockDelete(...args),
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
  },
}));

const mockNavigate = jest.fn();
const mockSetParams = jest.fn();
/** @type {any} */
let mockParams;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setParams: mockSetParams }),
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: espaces,
    }),
  };
});
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress, testID: `bouton-${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN, View: Vue } = jest.requireActual('react-native');
  return function SegmentedControlMock(/** @type {any} */ { onChange, options }) {
    return reactActuel.createElement(Vue, null, options.map((option) => reactActuel.createElement(
      PressableRN,
      { key: option.value, onPress: () => onChange(option.value), testID: `onglet-${option.value}` },
      reactActuel.createElement(TexteRN, null, option.label),
    )));
  };
});

const ROUTE_DEMANDES = '/superadmin/collectivite-invitations';
const EXPLORATEUR = '/superadmin/content/api%3A%3Acollectivite.collectivite/list';
const RECHERCHE_CLUB = '/superadmin/relations/api%3A%3Aclub.club/search';
const MONTRIVAGE = { documentId: 'ville-montrivage', name: 'Ville de Montrivage' };

/** @type {any} */
let serveur;

const demandeRattachement = {
  club: { documentId: 'recette-fc', name: 'Recette Stripe FC' },
  clubContact: null,
  clubName: 'Recette Stripe FC',
  collectivite: MONTRIVAGE,
  createdAt: '2026-10-01T09:00:00.000Z',
  documentId: 'demande-r1',
  kind: 'attach_request',
  outsideCommune: true,
  remindCount: 0,
  remindedAt: null,
  status: 'registered',
};
const parFoundClubEnvoyee = {
  club: null,
  clubContact: 'contact@judo-montrivage.example.invalid',
  clubName: 'Judo Montrivage',
  collectivite: MONTRIVAGE,
  createdAt: '2026-10-01T10:00:00.000Z',
  documentId: 'demande-f1',
  kind: 'foundclub',
  outsideCommune: null,
  remindCount: 2,
  remindedAt: '2026-10-02T08:00:00.000Z',
  status: 'sent',
};
const parFoundClubInscrit = {
  ...parFoundClubEnvoyee,
  club: { documentId: 'tennis-club', name: 'Tennis Club de Montrivage' },
  clubContact: '04 00 00 00 00',
  clubName: 'Tennis de Montrivage',
  documentId: 'demande-f2',
  remindCount: 0,
  remindedAt: null,
  status: 'registered',
};
const dejaRattachee = {
  ...demandeRattachement, club: { documentId: 'as-montrivage', name: 'AS Montrivage' }, documentId: 'demande-r0', status: 'attached',
};

const aplatirTexte = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
const attendre = async (/** @type {() => boolean} */ condition) => {
  for (let i = 0; i < 80 && !condition(); i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fin) => { setImmediate(fin); }); });
  }
};
const parTestID = (/** @type {any} */ noeud, /** @type {string} */ testID) => noeud.find(
  (/** @type {any} */ n) => n.props?.testID === testID,
);
const bouton = (/** @type {any} */ noeud, /** @type {string} */ titre) => noeud.find(
  (/** @type {any} */ n) => n.props?.testID === `bouton-${titre}` && typeof n.props?.onPress === 'function',
);
const appuyer = async (/** @type {any} */ noeud) => { await act(async () => { noeud.props.onPress(); }); };

const monter = async (/** @type {any} */ Ecran, /** @type {() => boolean} */ pret) => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { gcTime: 0, retry: false } },
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<QueryClientProvider client={client}><Ecran /></QueryClientProvider>);
  });
  await attendre(() => pret(arbre));
  return arbre;
};
const monterDemandes = () => monter(
  AdminCollectiviteInvitations,
  (arbre) => !textes(arbre.root).includes('Lecture des demandes…'),
);

beforeEach(() => {
  mockParams = undefined;
  serveur = {
    clubsTrouves: [],
    collectivites: [
      {
        clubs: [{ documentId: 'a' }, { documentId: 'b' }], documentId: 'ville-montrivage', isActive: null, name: 'Ville de Montrivage', type: 'commune',
      },
      {
        clubs: [{ documentId: 'c' }], documentId: 'cc-du-val', isActive: true, name: 'Communauté de communes du Val', type: 'intercommunalite',
      },
    ],
    demandes: [demandeRattachement, parFoundClubEnvoyee, parFoundClubInscrit, dejaRattachee],
    postPersonnalise: null,
  };
  [mockGet, mockPost, mockPut, mockDelete, mockNavigate, mockSetParams].forEach((doublure) => doublure.mockReset());
  mockGet.mockImplementation(async (/** @type {string} */ route) => {
    if (route === ROUTE_DEMANDES) return { data: { data: serveur.demandes.map((d) => ({ ...d })) } };
    if (route === '/superadmin/collectivite-manager-requests') return { data: { data: [] } };
    throw new Error(`GET inattendu ${route}`);
  });
  mockPost.mockImplementation(async (/** @type {string} */ route) => {
    if (route === EXPLORATEUR) {
      return { data: { data: serveur.collectivites, meta: { pagination: { total: serveur.collectivites.length } } } };
    }
    if (route === RECHERCHE_CLUB) return { data: { data: serveur.clubsTrouves } };
    if (serveur.postPersonnalise) return serveur.postPersonnalise(route);
    throw new Error(`POST inattendu ${route}`);
  });
});

describe('COLL-CONSOLE — « À traiter » en tête de la console des collectivités', () => {
  it('A1 — les nombres : 1 mairie à activer, 1 demande de rattachement, 2 clubs à inviter', async () => {
    const arbre = await monter(
      AdminCollectiviteList,
      (a) => textes(a.root).includes('Demandes de rattachement') && textes(a.root).includes('Ville de Montrivage'),
    );
    await attendre(() => textes(parTestID(arbre.root, 'a-traiter-foundclub')).includes('2'));
    const bloc = parTestID(arbre.root, 'collectivites-a-traiter');
    expect(textes(bloc)).toEqual(expect.arrayContaining(['À TRAITER', 'Mairies à activer', 'Demandes de gestionnaire']));
    expect(textes(parTestID(arbre.root, 'a-traiter-mairies'))).toEqual(['Mairies à activer', '1']);
    expect(textes(parTestID(arbre.root, 'a-traiter-rattachements'))).toEqual(['Demandes de rattachement', '1']);
    expect(textes(parTestID(arbre.root, 'a-traiter-foundclub'))).toEqual(['Clubs à inviter, par FoundClub', '2']);

    await appuyer(parTestID(arbre.root, 'a-traiter-rattachements'));
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.AdminCollectiviteInvitations, { onglet: 'rattachements' });
    await appuyer(parTestID(arbre.root, 'a-traiter-foundclub'));
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.AdminCollectiviteInvitations, { onglet: 'foundclub' });
  });

  // 🎨 COLL-FIX2 (03/10), planche 13 (tournée T10) : rien à traiter, et les 3 lignes n'avaient
  // AUCUN compteur — elles ne disaient pas « rien ». Elles disent « 0 », discret.
  it('A0 — rien à traiter : chaque ligne dit « 0 »', async () => {
    serveur.demandes = [];
    const arbre = await monter(AdminCollectiviteList, (a) => textes(a.root).includes('Demandes de rattachement'));
    await attendre(() => textes(parTestID(arbre.root, 'gestionnaire-entree-file')).includes('0'));
    expect(textes(parTestID(arbre.root, 'a-traiter-rattachements'))).toEqual(['Demandes de rattachement', '0']);
    expect(textes(parTestID(arbre.root, 'a-traiter-foundclub'))).toEqual(['Clubs à inviter, par FoundClub', '0']);
    expect(textes(parTestID(arbre.root, 'gestionnaire-entree-file'))).toEqual(['Demandes de gestionnaire', '0']);
  });

  it('A2 — « Mairies à activer » filtre la liste sur les inactives ; « Toutes » y ramène', async () => {
    const arbre = await monter(AdminCollectiviteList, (a) => textes(a.root).includes('Ville de Montrivage'));
    await appuyer(parTestID(arbre.root, 'a-traiter-mairies'));
    expect(textes(arbre.root)).toContain('Ville de Montrivage');
    expect(textes(arbre.root)).not.toContain('Communauté de communes du Val');
    await appuyer(parTestID(arbre.root, 'onglet-all'));
    expect(textes(arbre.root)).toContain('Communauté de communes du Val');
  });

  it('A3 — l écran a son adresse sur le site, hors de /admin/collectivites/:id', () => {
    expect(getWebRoutePattern(RouteNames.AdminCollectiviteInvitations)).toBe('/admin/rattachements-collectivites');
  });
});

describe('COLL-CONSOLE — l écran des demandes de rattachement et « Par FoundClub »', () => {
  it('I1 — trois onglets comptés ; une demande dit son club, sa Ville, sa date, et « hors commune »', async () => {
    const arbre = await monterDemandes();
    expect(mockGet).toHaveBeenCalledWith(ROUTE_DEMANDES);
    expect(textes(arbre.root)).toEqual(expect.arrayContaining([
      'Rattachements et invitations', 'Rattachements (1)', 'Par FoundClub (2)', 'Rattachés (1)',
    ]));
    const carte = textes(parTestID(arbre.root, 'demande-demande-r1'));
    expect(carte[0]).toBe('Recette Stripe FC');
    expect(carte[1]).toMatch(/^Pour la Ville de Montrivage · le .*01\/10/);
    expect(carte).toContain('Hors de la commune : vérifie que le club joue bien à Ville de Montrivage avant de le rattacher.');

    await appuyer(parTestID(arbre.root, 'onglet-faits'));
    expect(textes(parTestID(arbre.root, 'demande-demande-r0'))).toEqual(['AS Montrivage', 'Rattaché à Ville de Montrivage']);
  });

  it('I2 — « Rattacher » : POST …/clubs/:clubId ; les dirigeants sont prévenus ; les demandes sont relues', async () => {
    serveur.postPersonnalise = async (/** @type {string} */ route) => {
      if (route !== '/superadmin/collectivites/ville-montrivage/clubs/recette-fc') throw new Error(`route ${route}`);
      serveur.demandes = serveur.demandes.map((d) => (d.documentId === 'demande-r1' ? { ...d, status: 'attached' } : d));
      return {
        data: {
          data: {
            attached: true, changed: true, clubDocumentId: 'recette-fc', offer: 'collectivite-inactive',
          },
        },
      };
    };
    const arbre = await monterDemandes();
    const lecturesAvant = mockGet.mock.calls.filter(([route]) => route === ROUTE_DEMANDES).length;
    await appuyer(bouton(parTestID(arbre.root, 'demande-demande-r1'), 'Rattacher à Ville de Montrivage'));
    await attendre(() => textes(arbre.root).includes('Rattachés (2)'));

    expect(mockPost).toHaveBeenCalledWith('/superadmin/collectivites/ville-montrivage/clubs/recette-fc');
    expect(mockGet.mock.calls.filter(([route]) => route === ROUTE_DEMANDES).length).toBeGreaterThan(lecturesAvant);
    await appuyer(parTestID(arbre.root, 'onglet-faits'));
    expect(textes(parTestID(arbre.root, 'demande-demande-r1'))).toEqual(expect.arrayContaining([
      'Recette Stripe FC est rattaché à la Ville de Montrivage. Elle est inactive : l’offre Club sera posée à son activation. Ses dirigeants sont prévenus.',
    ]));
  });

  it('I3 — « Par FoundClub » : contact et relances ; « Relier à son club inscrit » cherche puis PUT …/club', async () => {
    serveur.clubsTrouves = [{ documentId: 'judo-club', label: 'Judo Club de Montrivage', subtitle: null }];
    mockPut.mockImplementation(async () => ({ data: { data: { ...parFoundClubEnvoyee, status: 'registered' } } }));
    mockParams = { onglet: 'foundclub' };
    const arbre = await monterDemandes();
    const carte = () => parTestID(arbre.root, 'demande-demande-f1');
    expect(textes(carte())).toEqual(expect.arrayContaining([
      'Judo Montrivage',
      'Contact donné par la mairie : contact@judo-montrivage.example.invalid',
    ]));
    expect(textes(carte()).some((texte) => texte.startsWith('Relancée 2 fois, la dernière le '))).toBe(true);

    await appuyer(bouton(carte(), 'Relier à son club inscrit'));
    const champ = arbre.root.findAllByType(TextInput).find((n) => n.props.testID === 'relier-demande-f1');
    await act(async () => { champ.props.onChangeText('judo'); });
    await attendre(() => arbre.root.findAll((n) => n.props?.testID === 'relier-demande-f1-resultat-judo-club').length > 0);
    expect(mockPost).toHaveBeenCalledWith(RECHERCHE_CLUB, { fields: ['documentId', 'name', 'addressDetails'], pageSize: 10, q: 'judo' });
    await appuyer(bouton(parTestID(arbre.root, 'relier-demande-f1-resultat-judo-club'), 'Relier'));
    await attendre(() => mockPut.mock.calls.length > 0);
    expect(mockPut).toHaveBeenCalledWith(
      '/superadmin/collectivite-invitations/demande-f1/club',
      { data: { clubDocumentId: 'judo-club' } },
    );
  });

  it('I4 — une demande reliée : « Inscrit sur FoundClub » ; elle se rattache, ou se délie (null)', async () => {
    mockPut.mockImplementation(async () => ({ data: { data: { ...parFoundClubInscrit, club: null, status: 'sent' } } }));
    mockParams = { onglet: 'foundclub' };
    const arbre = await monterDemandes();
    const carte = parTestID(arbre.root, 'demande-demande-f2');
    expect(textes(carte)).toEqual(expect.arrayContaining([
      'Tennis de Montrivage', 'Inscrit sur FoundClub : Tennis Club de Montrivage', 'Rattacher à Ville de Montrivage',
    ]));
    await appuyer(bouton(carte, 'Délier ce club'));
    await attendre(() => mockPut.mock.calls.length > 0);
    expect(mockPut).toHaveBeenCalledWith('/superadmin/collectivite-invitations/demande-f2/club', { data: { clubDocumentId: null } });
  });

  it('I5 — un refus du serveur (409) s écrit sous la demande ; une lecture refusée (403) le dit', async () => {
    serveur.postPersonnalise = async () => {
      const erreur = /** @type {any} */ (new Error('Ce club est deja rattache a une autre collectivite.'));
      erreur.response = { data: { error: { message: 'Ce club est deja rattache a une autre collectivite.' } }, status: 409 };
      throw erreur;
    };
    const arbre = await monterDemandes();
    await appuyer(bouton(parTestID(arbre.root, 'demande-demande-r1'), 'Rattacher à Ville de Montrivage'));
    await attendre(() => textes(parTestID(arbre.root, 'demande-demande-r1')).length > 4);
    expect(textes(parTestID(arbre.root, 'demande-demande-r1')).join(' ')).toMatch(/rattache a une autre collectivite/);

    mockGet.mockImplementation(async () => {
      const refus = /** @type {any} */ (new Error('Forbidden'));
      refus.response = { data: { error: { message: 'Forbidden' } }, status: 403 };
      throw refus;
    });
    const refuse = await monterDemandes();
    await attendre(() => textes(refuse.root).includes('Demandes indisponibles'));
    expect(textes(refuse.root)).toContain('Demandes indisponibles');
    expect(refuse.root.findAll((n) => String(n.props?.testID || '').startsWith('demande-'))).toHaveLength(0);
  });
});
