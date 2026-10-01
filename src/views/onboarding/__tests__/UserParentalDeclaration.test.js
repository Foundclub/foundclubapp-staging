import { Platform, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { updateMe } from '@/services/auth/authService';

import UserParentalDeclaration from '../UserParentalDeclaration';

// CONSENTEMENT-PHRASE (2026-10-01) — E6 : l'ecran de la case n'avait AUCUN test.
//
// C'est pourtant lui que voient les 8 parcours d'un 13-14 ans (les 4 branches du
// tunnel `authUseCases.js`, le refus serveur et la date saisie dans `UserName.js`,
// la carte de collection `PlayerCardScreen.js`). Ce fichier le monte AVEC la vraie
// carte et la vraie case a cocher : ce qui est lu, c'est ce que l'ado VOIT, et ce
// qui part, c'est ce que le serveur ENREGISTRE comme preuve.

let mockUserData;
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{}, jest.fn()],
}));

// Doublure de `t` branchee sur la VRAIE fr.js : l'ecran prend fr.js des que la
// clef existe, et c'est fr.js qui dit ce que l'ado lit.
jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
        const valeur = String(cle || '').split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        if (typeof valeur === 'string') return valeur;
        return typeof repli === 'string' ? repli : cle;
      },
    }),
  };
});

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

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    refetchUserData: jest.fn(),
    userData: mockUserData,
    userDataError: null,
    userDataLoading: false,
  }),
}));

// Doublure fidele de react-query : la mutation appelle vraiment sa mutationFn
// puis onSuccess, sinon rien ne partirait sur le reseau.
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve()
      .then(() => options.mutationFn(variables))
      .then((/** @type {any} */ data) => options.onSuccess?.(data, variables))
      .catch((/** @type {any} */ error) => options.onError?.(error, variables)),
  }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueriesData: jest.fn() }),
}));

jest.mock('@/services/auth/authService', () => ({
  updateMe: jest.fn(),
}));

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      {
        accessibilityLabel: props.title,
        disabled: props.disabled || props.isLoading,
        onPress: props.onPress,
      },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

jest.mock('@/components/templates/FormScreenContainer', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return function FormScreenContainerMock(/** @type {any} */ { children }) {
    return reactActuel.createElement(VueRN, null, children);
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

/**
 * Aplati les enfants React en une chaine.
 * @param {any} enfants - Les enfants React.
 * @returns {string} Le texte.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Tout le texte visible, une entree par composant `Text`.
 * @param {any} arbre - L'arbre rendu.
 * @returns {string} Le texte.
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

/**
 * La case a cocher de la carte (le seul pressable `checkbox`).
 * @param {any} arbre - L'arbre rendu.
 * @returns {any} Le noeud.
 */
const laCase = (arbre) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud.props.accessibilityRole === 'checkbox');

/**
 * Le bouton « Continuer ».
 * @param {any} arbre - L'arbre rendu.
 * @returns {any} Le noeud.
 */
const continuer = (arbre) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud.props.accessibilityLabel === 'Continuer');

/**
 * Monte l'ecran.
 * @param {any} [params] - Les parametres de route.
 * @returns {Promise<any>} L'arbre rendu.
 */
const rendre = async (params = {}) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <UserParentalDeclaration
        navigation={{ goBack: mockGoBack, navigate: mockNavigate }}
        route={{ params }}
      />,
    );
  });
  return arbre;
};

/**
 * Coche la case puis appuie sur « Continuer ».
 * @param {any} arbre - L'arbre rendu.
 * @returns {Promise<any>} Ce qui est parti vers le serveur.
 */
const cocherEtContinuer = async (arbre) => {
  await act(async () => { laCase(arbre).props.onPress(); });
  await act(async () => { continuer(arbre).props.onPress(); });
  return updateMe.mock.calls[0]?.[0];
};

const OS_D_ORIGINE = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = OS_D_ORIGINE;
  mockUserData = { birthdate: '2012-03-01', documentId: 'ado-14' };
  updateMe.mockResolvedValue({ documentId: 'ado-14', parentalDeclarationAccepted: true });
});

afterAll(() => {
  Platform.OS = OS_D_ORIGINE;
});

test('E6 ① sans la case, « Continuer » ne part pas', async () => {
  const arbre = await rendre();

  expect(continuer(arbre).props.disabled).toBe(true);
  expect(texteVisible(arbre)).toContain('Continuer');
  await act(async () => { continuer(arbre).props.onPress(); });
  expect(updateMe).not.toHaveBeenCalled();
});

test('E6 ② la case cochee envoie la preuve legale et la declaration', async () => {
  const arbre = await rendre();
  const envoi = await cocherEtContinuer(arbre);

  expect(envoi.parentalDeclarationAccepted).toBe(true);
  expect(envoi.legalAcceptance).toEqual(expect.objectContaining({
    accepted: true,
    locale: 'fr-FR',
    scope: 'minor_parental_declaration',
    sourceScreen: 'onboarding_parental_declaration',
    targetDocumentId: 'ado-14',
    targetType: 'user_profile',
  }));
  expect(typeof envoi.legalAcceptance.legalTextHash).toBe('string');
  expect(typeof envoi.legalAcceptance.legalVersion).toBe('string');
});

test('E6 ③ inscription : on continue vers l adresse ; depuis la carte : retour a la carte', async () => {
  const inscription = await rendre();
  await cocherEtContinuer(inscription);
  expect(mockNavigate).toHaveBeenCalledWith('UserAddress');
  expect(mockGoBack).not.toHaveBeenCalled();

  jest.clearAllMocks();
  updateMe.mockResolvedValue({ documentId: 'ado-14' });
  const carte = await rendre({ returnRoute: 'PlayerCard', source: 'player_card' });
  await cocherEtContinuer(carte);
  expect(mockGoBack).toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// CONSENTEMENT-PHRASE — LE CONSTAT E6 ④ RETOURNE (decision d'Adel « 3-A corrige »)
// ---------------------------------------------------------------------------
// E6 ④ figeait, sur la base 718b1421, un ado de 14 ans qui devait cocher « Je déclare
// être le parent ou le représentant legal de cet enfant », sous l'intro « tu dois
// confirmer que tu es son parent », avec le titre d'un AUTRE ecran (« Quelle est ta date
// de naissance ? », clef `profile.titles.birthdate`). Les temoins ci-dessous le retournent.

const PHRASE_DE_L_ADO = 'Un de mes parents (ou mon représentant légal) m\'a donné son accord '
  + 'pour créer ce compte.';
const PHRASE_DU_PARENT = 'Je déclare être le parent';

test('CONSENTEMENT ⑤ l ado lit une phrase VRAIE, plus aucun « tu es son parent »', async () => {
  const arbre = await rendre();
  const texte = texteVisible(arbre);

  expect(texte).toContain(PHRASE_DE_L_ADO);
  expect(texte).toContain('L’accord de tes parents');
  expect(texte).not.toContain(PHRASE_DU_PARENT);
  expect(texte).not.toMatch(/tu es son parent|de l enfant|cet enfant|en son nom/);
  expect(texte).not.toContain('Quelle est ta date de naissance ?');
});

test('CONSENTEMENT ⑥ la preuve envoyee est la NOUVELLE version, celle de l ado', async () => {
  const arbre = await rendre();
  const envoi = await cocherEtContinuer(arbre);

  expect(envoi.legalAcceptance.legalVersion).toBe('minor-parental-declaration-v2-self-2026-10-01');
  expect(envoi.legalAcceptance.legalTextHash)
    .toBe('8bdc055408f8d93f68dfea13bccd4e0402d7afc4299eec467285dca668081ae3');
  expect(envoi.legalAcceptance.consentFlags).toEqual({ parentalPermissionObtained: true });
  expect(envoi.parentalDeclarationAccepted).toBe(true);
});

test('CONSENTEMENT ⑦ sur le telephone, le lien parent est propose comme autre voie', async () => {
  Platform.OS = 'android';
  const texte = texteVisible(await rendre());

  expect(texte)
    .toContain('Ton parent peut aussi donner son accord depuis son propre compte FoundClub');
  expect(texte).toContain('Profil → Mes enfants');
});

test('CONSENTEMENT ⑦ bis sur le site, l ecran dit que le lien parent n y est pas', async () => {
  Platform.OS = 'web';
  const texte = texteVisible(await rendre());

  expect(texte).toContain('Ton parent peut aussi donner son accord depuis son propre compte');
  expect(texte).toContain('application mobile FoundClub');
  expect(texte).toContain('pas encore possible sur le site');
  expect(texte).not.toContain('Profil → Mes enfants');
});

// Parcours 7 (carte de collection) et 8 (ProfileEdit natif et web) affichent LA CARTE
// seule, sans passer par l'ecran : son libelle par defaut est celui de l'ado.
test('CONSENTEMENT ⑧ la carte montre la phrase de l ado ; celle du parent sur demande', () => {
  const { default: ParentalDeclarationCard } = jest.requireActual(
    '@/components/molecules/parentalDeclarationCard/ParentalDeclarationCard',
  );
  const { PARENTAL_DECLARATION_SIGNATORIES } = jest.requireActual(
    '@/constants/parentalDeclaration',
  );

  /** @type {any} */
  let ado;
  act(() => {
    ado = renderer.create(<ParentalDeclarationCard checked={false} onChange={() => {}} />);
  });
  const texteAdo = texteVisible(ado);
  expect(texteAdo).toContain(PHRASE_DE_L_ADO);
  expect(texteAdo).toContain('L’accord de tes parents');
  expect(texteAdo).not.toMatch(/Je déclare être le parent|tu es son parent/);

  /** @type {any} */
  let parent;
  act(() => {
    parent = renderer.create(
      <ParentalDeclarationCard
        checked={false}
        description="Tu confirmes être son parent."
        onChange={() => {}}
        signatory={PARENTAL_DECLARATION_SIGNATORIES.PARENT}
        title="Déclaration parentale"
      />,
    );
  });
  expect(texteVisible(parent)).toContain(PHRASE_DU_PARENT);
  expect(texteVisible(parent)).not.toContain(PHRASE_DE_L_ADO);
});

test('CONSENTEMENT ⑨ ProfileEdit annonce le bon seuil : 15 ans, plus 13', () => {
  const fr = jest.requireActual('@/theme/strings/translations/fr').default;

  expect(fr.profileEdit.parentalDeclaration.required).toContain('15 ans');
  expect(fr.profileEdit.parentalDeclaration.required).not.toContain('13 ans');
});
