import { Text, TextInput, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AdminPopupCampaignForm from '../AdminPopupCampaignForm';

/**
 * T-POPUP-TOURNOI (18/11) — annoncer le tournoi par la pop-up d accueil.
 *
 * C1-C2 : TEMOINS CARACTERISANTS (E6), poses avant toute ecriture : l id tape a la main
 * part bien dans `eventId`, et un brouillon relu garde son id. Ils restent verts.
 * R1-R2 : le SuperAdmin TROUVE l evenement par son nom (au lieu de taper son id), et
 * l apercu ouvre la fiche de cet evenement.
 */

const mockCreer = jest.fn(() => Promise.resolve({ data: { documentId: 'camp-neuve' } }));
const mockMaj = jest.fn(() => Promise.resolve({ data: { documentId: 'camp-1' } }));
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
/** @type {any} */
let mockBrouillon = null;
/** @type {any[]} */
const mockAppelsRecherche = [];
/** @type {any} */
let mockApercu = null;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, replace: mockReplace }),
  useRoute: () => ({ params: mockBrouillon ? { campaignId: 'camp-1' } : {} }),
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
      Spaces: espaces,
    }),
  };
});

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock(
  '@/components/organisms/popup/GlobalPromptModal',
  () => function GlobalPromptModalMock(/** @type {any} */ props) {
    mockApercu = props;
    return null;
  },
);
// IMPL-4-ACCUEIL (18/11) : le billet doublé, ses props gardées (il lit son événement).
/** @type {any} */
let mockBilletApercu = null;
jest.mock(
  '@/components/organisms/popup/BilletTournoiModal',
  () => function BilletMock(/** @type {any} */ props) {
    mockBilletApercu = props;
    return null;
  },
);
jest.mock(
  '@/views/admin/components/AdminStateView',
  () => function AdminStateViewMock() { return null; },
);
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

jest.mock('@/services/client', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('react-native-image-picker', () => ({ launchImageLibrary: jest.fn() }));

jest.mock('@/services/inAppPopupCampaign/inAppPopupCampaignQueries', () => ({
  useCreateInAppPopupCampaign: () => ({
    isPending: false,
    mutateAsync: (/** @type {any[]} */ ...args) => mockCreer(...args),
  }),
  // Le MEME objet a chaque rendu, comme le cache de react-query (sinon l effet boucle).
  useGetInAppPopupCampaign: () => ({
    data: mockBrouillon ? mockBrouillon.reponse : undefined,
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useUpdateInAppPopupCampaign: () => ({
    isPending: false,
    mutateAsync: (/** @type {any[]} */ ...args) => mockMaj(...args),
  }),
}));

// La recherche d evenements du dossier (celle de Recherche › Evenements) : une page de
// resultats au format du serveur (`data[].payload`).
jest.mock('@/services/search/searchQueries', () => ({
  useSearchEvents: (/** @type {any} */ params, /** @type {any} */ options) => {
    mockAppelsRecherche.push({ options, params });
    const actif = Boolean(options?.enabled) && String(params?.q || '').trim().length >= 2;
    return {
      data: actif ? {
        pages: [{
          data: [{
            payload: {
              date: '2026-12-19T18:00:00.000Z',
              documentId: 'evt-tournoi',
              name: 'FoundClub x AR Soccer',
            },
          }],
        }],
      } : undefined,
      isLoading: false,
    };
  },
}));

/** @type {any[]} */
const arbres = [];

/**
 * Pose le brouillon que le serveur renvoie.
 * @param {any} campagne
 */
const brouillon = (campagne) => {
  mockBrouillon = { reponse: { data: campagne } };
};

beforeEach(() => {
  mockBrouillon = null;
  mockApercu = null;
  mockAppelsRecherche.length = 0;
  mockCreer.mockClear();
  mockMaj.mockClear();
  mockNavigate.mockClear();
  mockReplace.mockClear();
});

afterEach(() => {
  while (arbres.length) {
    const arbre = arbres.pop();
    act(() => { arbre.unmount(); });
  }
});

/**
 * Monte le formulaire.
 * @returns {any} L arbre rendu.
 */
const monter = () => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<AdminPopupCampaignForm />); });
  arbres.push(arbre);
  return arbre;
};

/**
 * Les pastilles qui portent ce texte, dans l ordre de l ecran (action principale d abord).
 * @param {any} arbre
 * @param {string} texte
 * @returns {any[]} Les TouchableOpacity.
 */
const pastilles = (arbre, texte) => arbre.root.findAllByType(TouchableOpacity)
  .filter((noeud) => noeud.findAllByType(Text).some((t) => t.props.children === texte));

/**
 * Active l action principale et lui donne le type « open_event ».
 * @param {any} arbre
 */
const actionPrincipaleOuvreUnEvenement = (arbre) => {
  act(() => { pastilles(arbre, 'Inactif')[0].props.onPress(); });
  act(() => { pastilles(arbre, 'open_event')[0].props.onPress(); });
};

/**
 * Le champ dont le texte d aide est celui-ci.
 * @param {any} arbre
 * @param {string} aide
 * @returns {any} Le TextInput.
 */
const champ = (arbre, aide) => arbre.root.findAllByType(TextInput)
  .find((noeud) => noeud.props.placeholder === aide);

/**
 * Appuie sur « Créer le brouillon » ou « Enregistrer le brouillon ».
 * @param {any} arbre
 * @param {string} titre
 */
const enregistrer = async (arbre, titre) => {
  await act(async () => { arbre.root.findByProps({ testID: `bouton-${titre}` }).props.onPress(); });
};

test('C1 (caractérisant) — un id tapé à la main part dans eventId', async () => {
  const arbre = monter();
  actionPrincipaleOuvreUnEvenement(arbre);
  act(() => { champ(arbre, 'documentId ou URL').props.onChangeText('evt-1'); });

  await enregistrer(arbre, 'Créer le brouillon');

  expect(mockCreer).toHaveBeenCalledTimes(1);
  const [{ data }] = /** @type {any} */ (mockCreer.mock.calls[0]);
  expect(data.actions).toEqual([expect.objectContaining({
    actionType: 'open_event', eventId: 'evt-1', slot: 'primary',
  })]);
});

test('C2 (caractérisant) — un brouillon relu garde son eventId', async () => {
  brouillon({
    actions: [{
      actionType: 'open_event', eventId: 'evt-7', label: 'Voir', slot: 'primary',
    }],
    documentId: 'camp-1',
    status: 'draft',
    title: 'Le tournoi',
  });
  const arbre = monter();

  expect(champ(arbre, 'documentId ou URL').props.value).toBe('evt-7');
  await enregistrer(arbre, 'Enregistrer le brouillon');

  const [{ data }] = /** @type {any} */ (mockMaj.mock.calls[0]);
  expect(data.actions[0]).toEqual(expect.objectContaining({ eventId: 'evt-7' }));
});

const TITRE_R1 = 'R1 — le SuperAdmin cherche le tournoi par son nom et le choisit, '
  + 'sans taper d id';
test(TITRE_R1, async () => {
  const arbre = monter();
  actionPrincipaleOuvreUnEvenement(arbre);

  const recherche = arbre.root.findByProps({ testID: 'popup-recherche-evenement-primary' });
  act(() => { recherche.props.onChangeText('AR Soccer'); });

  const appel = mockAppelsRecherche.at(-1);
  expect(appel.params.q).toBe('AR Soccer');
  expect(appel.options.enabled).toBe(true);

  const resultat = arbre.root.findByProps({ testID: 'popup-evenement-evt-tournoi' });
  // Le nom ET la date, pour ne pas confondre deux tournois du même nom.
  const textes = resultat.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
  expect(textes.join(' ')).toMatch(/FoundClub x AR Soccer/);
  expect(textes.join(' ')).toMatch(/19\/12\/2026/);

  act(() => { resultat.props.onPress(); });
  await enregistrer(arbre, 'Créer le brouillon');

  const [{ data }] = /** @type {any} */ (mockCreer.mock.calls[0]);
  expect(data.actions[0]).toEqual(expect.objectContaining({
    actionType: 'open_event', eventId: 'evt-tournoi',
  }));
});

test('R2 — dans l aperçu, « Voir le tournoi » ouvre la fiche de CE tournoi', () => {
  brouillon({
    actions: [{
      actionType: 'open_event', eventId: 'evt-tournoi', label: 'Voir le tournoi', slot: 'primary',
    }],
    documentId: 'camp-1',
    status: 'draft',
    title: 'FoundClub x AR Soccer',
  });
  const arbre = monter();
  act(() => { arbre.root.findByProps({ testID: 'bouton-Prévisualiser' }).props.onPress(); });

  expect(mockApercu.visible).toBe(true);
  expect(mockApercu.title).toBe('FoundClub x AR Soccer');
  expect(mockApercu.primaryAction.label).toBe('Voir le tournoi');

  act(() => { mockApercu.primaryAction.onPress(); });

  expect(mockApercu.visible).toBe(false);
  expect(mockNavigate).toHaveBeenCalledWith('EventStack', {
    params: { eventId: 'evt-tournoi' },
    screen: 'EventDetails',
  });
});

// T-POPUP-ZONE (18/11, décision d'Adel D236) — n'annoncer le tournoi qu'aux comptes de sa zone.
const TITRE_ZONE_R1 = 'ZONE-R1 — « Départements ciblés » part dans targetDepartments, '
  + 'et vide = toute la France';
test(TITRE_ZONE_R1, async () => {
  const arbre = monter();
  const aide = arbre.root.findAllByType(Text)
    .map((t) => [].concat(t.props.children).join(''))
    .find((texte) => /Vide = toute la France/.test(texte));
  expect(aide).toBeTruthy();

  await enregistrer(arbre, 'Créer le brouillon');
  expect(/** @type {any} */ (mockCreer.mock.calls[0])[0].data.targetDepartments).toEqual([]);

  act(() => { champ(arbre, '34, 30').props.onChangeText('34, 30'); });
  await enregistrer(arbre, 'Créer le brouillon');
  expect(/** @type {any} */ (mockCreer.mock.calls[1])[0].data.targetDepartments)
    .toEqual(['34', '30']);
});

test('ZONE-R2 — un brouillon relu garde ses départements', async () => {
  brouillon({
    actions: [],
    audience: { targetDepartments: ['34'] },
    documentId: 'camp-1',
    status: 'draft',
    title: 'Le tournoi',
  });
  const arbre = monter();

  expect(champ(arbre, '34, 30').props.value).toBe('34');
  await enregistrer(arbre, 'Enregistrer le brouillon');
  expect(/** @type {any} */ (mockMaj.mock.calls[0])[0].data.targetDepartments).toEqual(['34']);
});

// IMPL-4-ACCUEIL, page 5 (variante B « billet », Adel 18/11) — le SuperAdmin choisit le billet par
// le modèle `hero_image_modal` avec « Voir le tournoi » (open_event), le formulaire le lui dit, et
// l'aperçu montre le billet. La maquette 5c est simplifiée : aucun champ n'est retiré.
const BROUILLON_BILLET = {
  actions: [{
    actionType: 'open_event', eventId: 'evt-tournoi', label: 'Voir le tournoi', slot: 'primary',
  }],
  documentId: 'camp-1',
  eyebrow: 'Tournoi de foot à 5',
  status: 'draft',
  templateKey: 'hero_image_modal',
  title: 'FoundClub x AR Soccer',
};

test('BILLET-1 — avec hero_image_modal, le formulaire dit que la pop-up sera un billet', () => {
  brouillon(BROUILLON_BILLET);
  const arbre = monter();
  const textes = arbre.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
  expect(textes.some((texte) => /billet/i.test(texte))).toBe(true);
});

test('BILLET-2 — l aperçu montre le billet de CE tournoi, la fenêtre d avant en repli', () => {
  mockBilletApercu = null;
  brouillon(BROUILLON_BILLET);
  const arbre = monter();
  act(() => { arbre.root.findByProps({ testID: 'bouton-Prévisualiser' }).props.onPress(); });

  expect(mockBilletApercu.visible).toBe(true);
  expect(mockBilletApercu.eventId).toBe('evt-tournoi');
  expect(mockBilletApercu.title).toBe('FoundClub x AR Soccer');
  expect(mockBilletApercu.eyebrow).toBe('Tournoi de foot à 5');
  expect(mockBilletApercu.repli).toBeTruthy();
  act(() => { mockBilletApercu.primaryAction.onPress(); });
  expect(mockNavigate).toHaveBeenCalledWith('EventStack', {
    params: { eventId: 'evt-tournoi' },
    screen: 'EventDetails',
  });
});

test('📌 BILLET-3 — modèle standard : l aperçu reste la fenêtre d avant, aucun champ retiré', () => {
  mockBilletApercu = null;
  brouillon({ ...BROUILLON_BILLET, templateKey: 'standard_modal' });
  const arbre = monter();
  act(() => { arbre.root.findByProps({ testID: 'bouton-Prévisualiser' }).props.onPress(); });
  expect(mockBilletApercu).toBeNull();
  expect(mockApercu.visible).toBe(true);
  expect(champ(arbre, '34, 30')).toBeTruthy();
});
