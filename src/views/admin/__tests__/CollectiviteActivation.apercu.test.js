import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { toAdminCollectiviteRow } from '@/domains/collectivite/collectiviteDisplay';

import { useAdminCollectivites } from '@/services/collectivite/collectiviteQueries';

import CollectiviteActivation from '../components/CollectiviteActivation';

// COLL-CONSOLE (02/10) — « Activer / Couper » a QUITTE la liste (planche P2-liste) : ce temoin
// monte desormais le composant lui-meme, nourri par la MEME lecture que la console (le geste
// relit la liste, l etat affiche est celui du serveur). Ses garanties ne changent pas.
/**
 * Les collectivites de la console, chacune avec son « Activer / Couper ».
 * @returns {import('react').ReactElement} Le banc.
 */
function BancActivation() {
  const lecture = useAdminCollectivites();
  const lignes = (Array.isArray(lecture.data?.data) ? lecture.data.data : [])
    .map(toAdminCollectiviteRow);
  return (
    <View>
      {lignes.map((ligne) => (
        <View key={ligne.documentId} testID={`admin-collectivite-${ligne.documentId}`}>
          <CollectiviteActivation collectivite={ligne} />
        </View>
      ))}
    </View>
  );
}

// 🏛️ TEXTES-COLLECTIVITES (lot 1, 01/10/2026) — LES FENÊTRES « ACTIVER » ET « COUPER ».
//
// Le défaut, mesuré en recette le 01/10 à 02:09 UTC : la fenêtre annonçait « Les 3 clubs
// rattachés recevront l’offre Club offerte » ; le serveur n’en a touché que 2 (« Offre posée :
// 2 · Club qui paie déjà : 1 »), et la console ne disait pas LEQUEL payait.
//
// Ce que ce témoin exige (ROUGE avant le lot) :
//   - « Activer » / « Couper » demandent d’abord au serveur son APERÇU, club par club
//     (`PUT …/active` avec `{ data: { previewIsActive } }`, qui n’écrit rien) ;
//   - la fenêtre dit, AVANT la confirmation, quels clubs reçoivent, paient déjà, perdent,
//     ou ne bougent pas — par leur NOM ;
//   - le compte rendu après le geste nomme le club qui paie déjà ;
//   - un serveur qui ne sait pas faire l’aperçu (serveur d’avant le lot : 400) ne bloque
//     rien : la fenêtre dit une phrase VRAIE sans détail, et le geste reste possible.
// Le client HTTP est doublé ; le VRAI i18next (fr.js, pluriels compris) écrit les phrases.

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();

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

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
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

const ROUTE_ACTIVE = '/superadmin/collectivites/ville-montrivage/active';
const MONTRIVAGE = {
  // eslint-disable-next-line max-len
  clubs: [{ documentId: 'as-montrivage' }, { documentId: 'montrivage-fc' }, { documentId: 'basket' }],
  documentId: 'ville-montrivage',
  isActive: null,
  name: 'Ville de Montrivage',
  type: 'commune',
};
const VAL = {
  clubs: [{ documentId: 'club-du-val' }, { documentId: 'val-tennis' }],
  documentId: 'cc-du-val',
  isActive: true,
  name: 'Communauté de communes du Val',
  type: 'intercommunalite',
};

// Ce que le serveur répond, club par club (noms compris), pour Montrivage.
const VERDICTS_ACTIVER = [
  { clubDocumentId: 'as-montrivage', name: 'AS Montrivage', offer: 'granted' },
  { clubDocumentId: 'basket', name: 'Montrivage Basket', offer: 'granted' },
  { clubDocumentId: 'montrivage-fc', name: 'Montrivage FC', offer: 'already-paid' },
];
const VERDICTS_COUPER = [
  { clubDocumentId: 'club-du-val', name: 'Club du Val', offer: 'revoked' },
  { clubDocumentId: 'val-tennis', name: 'Val Tennis', offer: 'none' },
];

/** @type {any[]} */
let collectivitesServeur;
/** @type {any} */
let alerte;

const reponseListe = () => ({
  data: {
    data: collectivitesServeur.map((ligne) => ({ ...ligne })),
    meta: {
      pagination: {
        page: 1, pageCount: 1, pageSize: 100, total: collectivitesServeur.length,
      },
    },
  },
});

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

const monter = async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { gcTime: 0, retry: false } },
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <BancActivation />
      </QueryClientProvider>,
    );
  });
  // eslint-disable-next-line max-len
  await attendre(() => arbre.root.findAll((n) => n.props?.testID === 'admin-collectivite-ville-montrivage').length > 0);
  return arbre;
};

const carte = (/** @type {any} */ arbre, /** @type {string} */ documentId) => arbre.root.find(
  (/** @type {any} */ n) => n.props?.testID === `admin-collectivite-${documentId}`,
);
const bouton = (/** @type {any} */ noeud, /** @type {string} */ titre) => noeud.find(
  // eslint-disable-next-line max-len
  (/** @type {any} */ n) => n.props?.testID === `bouton-${titre}` && typeof n.props?.onPress === 'function',
);

/**
 * Le serveur : l APERÇU (corps sans `isActive`) ou le GESTE.
 * @param {{ apercu: () => Promise<any>, geste?: () => Promise<any> }} reponses - Les deux voies.
 */
const serveur = ({ apercu, geste = async () => ({ data: { data: {} } }) }) => {
  mockPut.mockImplementation(async (/** @type {string} */ _url, /** @type {any} */ corps) => (
    corps?.data && 'previewIsActive' in corps.data ? apercu() : geste()
  ));
};

beforeEach(() => {
  collectivitesServeur = [MONTRIVAGE, VAL];
  alerte = null;
  // eslint-disable-next-line max-len
  [mockGet, mockPost, mockPut, mockDelete, mockNavigate].forEach((doublure) => doublure.mockReset());
  mockPost.mockImplementation(async () => reponseListe());
  jest.spyOn(Alert, 'alert').mockImplementation((titre, message, boutons) => {
    alerte = { boutons, message, titre };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// eslint-disable-next-line max-len
describe('TEXTES-COLLECTIVITES — « Activer » dit, club par club, ce que le serveur va faire', () => {
  // eslint-disable-next-line max-len
  it('l aperçu est demandé AVANT la fenêtre, sans rien écrire ; la fenêtre nomme chaque club', async () => {
    // eslint-disable-next-line max-len
    serveur({ apercu: async () => ({ data: { data: { clubs: VERDICTS_ACTIVER, isActive: true, preview: true } } }) });
    const arbre = await monter();
    await act(async () => { bouton(carte(arbre, 'ville-montrivage'), 'Activer').props.onPress(); });
    await attendre(() => alerte !== null);

    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(mockPut).toHaveBeenCalledWith(ROUTE_ACTIVE, { data: { previewIsActive: true } });
    expect(alerte.titre).toBe('Activer la Ville de Montrivage ?');
    expect(alerte.message).toBe([
      '2 clubs recevront l’offre Club offerte : AS Montrivage, Montrivage Basket.',
      '1 club paie déjà son abonnement, rien ne change pour lui : Montrivage FC.',
    ].join('\n'));
    expect(alerte.message).not.toMatch(/Les 3 clubs/);
  });

  it('confirmer fait le VRAI geste ; le compte rendu nomme le club qui paie déjà', async () => {
    serveur({
      // eslint-disable-next-line max-len
      apercu: async () => ({ data: { data: { clubs: VERDICTS_ACTIVER, isActive: true, preview: true } } }),
      geste: async () => {
        collectivitesServeur = [{ ...MONTRIVAGE, isActive: true }, VAL];
        return { data: { data: { changed: true, clubs: VERDICTS_ACTIVER, isActive: true } } };
      },
    });
    const arbre = await monter();
    await act(async () => { bouton(carte(arbre, 'ville-montrivage'), 'Activer').props.onPress(); });
    await attendre(() => alerte !== null);
    const confirmer = alerte.boutons.find((/** @type {any} */ b) => b.style !== 'cancel');
    expect(confirmer.text).toBe('Activer');
    await act(async () => { confirmer.onPress(); });
    // eslint-disable-next-line max-len
    await attendre(() => textes(carte(arbre, 'ville-montrivage')).some((texte) => texte.startsWith('Activée.')));

    expect(mockPut).toHaveBeenCalledTimes(2);
    expect(mockPut).toHaveBeenLastCalledWith(ROUTE_ACTIVE, { data: { isActive: true } });
    expect(textes(carte(arbre, 'ville-montrivage'))).toContain(
      'Activée. Offre posée : 2 · Club qui paie déjà : 1 (Montrivage FC)',
    );
  });

  it('« Annuler » après l aperçu : aucun geste', async () => {
    // eslint-disable-next-line max-len
    serveur({ apercu: async () => ({ data: { data: { clubs: VERDICTS_ACTIVER, isActive: true, preview: true } } }) });
    const arbre = await monter();
    await act(async () => { bouton(carte(arbre, 'ville-montrivage'), 'Activer').props.onPress(); });
    await attendre(() => alerte !== null);
    const annuler = alerte.boutons.find((/** @type {any} */ b) => b.style === 'cancel');
    await act(async () => { annuler.onPress?.(); });
    await attendre(() => false);
    expect(mockPut).toHaveBeenCalledTimes(1);
  });

  it('« Couper » : qui perd l offre, et qui n avait rien à perdre', async () => {
    // eslint-disable-next-line max-len
    serveur({ apercu: async () => ({ data: { data: { clubs: VERDICTS_COUPER, isActive: false, preview: true } } }) });
    const arbre = await monter();
    await act(async () => { bouton(carte(arbre, 'cc-du-val'), 'Couper').props.onPress(); });
    await attendre(() => alerte !== null);
    expect(mockPut).toHaveBeenCalledWith('/superadmin/collectivites/cc-du-val/active', {
      data: { previewIsActive: false },
    });
    expect(alerte.message).toBe([
      '1 club perdra l’offre Club offerte : Club du Val.',
      '1 club n’a pas l’offre de la collectivité, rien ne change pour lui : Val Tennis.',
    ].join('\n'));
  });

  // eslint-disable-next-line max-len
  it('un serveur sans aperçu (400) : la fenêtre dit une phrase VRAIE, et le geste reste possible', async () => {
    serveur({
      apercu: async () => {
        // eslint-disable-next-line no-throw-literal
        throw {
          response: {
            // eslint-disable-next-line max-len
            data: { error: { details: { code: 'COLLECTIVITE_INVALID_PAYLOAD' }, message: 'isActive', status: 400 } },
            status: 400,
          },
        };
      },
      geste: async () => ({ data: { data: { changed: true, clubs: [], isActive: true } } }),
    });
    const arbre = await monter();
    await act(async () => { bouton(carte(arbre, 'ville-montrivage'), 'Activer').props.onPress(); });
    await attendre(() => alerte !== null);
    expect(alerte.message).toBe(
      // eslint-disable-next-line max-len
      'Les 3 clubs rattachés recevront l’offre Club offerte, sauf ceux qui paient déjà leur abonnement.',
    );
    // eslint-disable-next-line max-len
    await act(async () => { alerte.boutons.find((/** @type {any} */ b) => b.style !== 'cancel').onPress(); });
    await attendre(() => mockPut.mock.calls.length === 2);
    // L aperçu a bien été DEMANDÉ (et refusé) avant la fenêtre ; puis le vrai geste.
    expect(mockPut).toHaveBeenCalledTimes(2);
    expect(mockPut).toHaveBeenNthCalledWith(1, ROUTE_ACTIVE, { data: { previewIsActive: true } });
    expect(mockPut).toHaveBeenLastCalledWith(ROUTE_ACTIVE, { data: { isActive: true } });
  });
});
