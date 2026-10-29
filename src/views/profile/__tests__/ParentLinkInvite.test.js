import { Text, TextInput, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ParentLinkInvite from '../ParentLinkInvite';

/**
 * PARENT-LIEN — « RELIER LE COMPTE DE MON ENFANT » / F20 « DONNER UN COMPTE À LÉA ».
 *
 * 🤐 Le témoin qui compte le plus ici : après l'envoi, l'écran dit la MÊME chose quoi qu'il y
 * ait derrière le numéro. Le serveur ne révèle rien ; l'écran ne doit pas le trahir.
 * ✍️ Et rien ne part sans la déclaration parentale cochée.
 */

/** @type {any} */
let mockRouteParams;
// RW-PARENT e1 (29/10) — le prénom se relit dans « Mes enfants », jamais dans l'adresse.
let mockEnfantsDeclares = [{ documentId: 'enfant-1', firstname: 'Léa' }];
/** @type {any} */
let mockOptionsDeLaMutation;
const mockDemander = jest.fn();
const mockGoBack = jest.fn();
const mockSms = jest.fn();

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        const valeur = String(cle || '').split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        if (typeof valeur === 'string') {
          const source = (repli && typeof repli === 'object' ? repli : options) || {};
          return valeur.replace(/\{\{(\w+)\}\}/g, (/** @type {string} */ _t, /** @type {string} */ c) => String(source[c] ?? ''));
        }
        return `CLE_ABSENTE:${cle}`;
      },
    }),
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
  useRoute: () => ({ params: mockRouteParams }),
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
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: ChampRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => (
      <ChampRN onChangeText={props.onChangeText} testID={props.testID} value={props.value} />
    ),
  };
});

jest.mock('@/components/molecules/parentalDeclarationCard/ParentalDeclarationCard', () => {
  const { Text: TexteRN, TouchableOpacity: Presse } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => (
      <Presse onPress={() => props.onChange(!props.checked)} testID="declaration">
        <TexteRN>{`DECLARATION:${props.checked ? 'cochee' : 'vide'}`}</TexteRN>
      </Presse>
    ),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: Presse } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => (
      <Presse disabled={props.disabled} onPress={props.onPress} testID={props.testID}>
        <TexteRN>{props.title}</TexteRN>
      </Presse>
    ),
  };
});

jest.mock('@/services/parentLink/parentLinkQueries', () => ({
  useRequestParentLink: (/** @type {any} */ options) => {
    mockOptionsDeLaMutation = options;
    return { isPending: false, mutate: mockDemander };
  },
}));

jest.mock('@/services/declaredChild/declaredChildQueries', () => ({
  useGetMyDeclaredChildren: () => ({ data: mockEnfantsDeclares }),
}));

jest.mock('@/services/teamInvite/teamInviteShare', () => ({
  openInviteSms: (/** @type {any} */ params) => mockSms(params),
  resolveInviteLinkOrigin: () => 'https://staging.foundclub.app',
}));

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const texte = (/** @type {any} */ arbre) => arbre.root
  .findAllByType(Text)
  .map((n) => aplatir(n.props.children))
  .join(' | ');
const parRepere = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === id
    && (n.type === TouchableOpacity || n.type === TextInput),
)[0];

const rendre = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => { arbre = renderer.create(<ParentLinkInvite />); });
  return arbre;
};

const saisir = async (/** @type {any} */ arbre, /** @type {string} */ numero) => {
  await act(async () => { parRepere(arbre, 'parent-link-phone').props.onChangeText(numero); });
};
const cocher = async (/** @type {any} */ arbre) => {
  await act(async () => { parRepere(arbre, 'declaration').props.onPress(); });
};
const envoyer = async (/** @type {any} */ arbre) => {
  await act(async () => { parRepere(arbre, 'parent-link-submit').props.onPress(); });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = undefined;
  mockOptionsDeLaMutation = null;
});

// ① — et aucune clef de traduction absente.
test('LIEN-ÉCRAN ① relier : le titre, et ce que le parent verra', async () => {
  const arbre = await rendre();
  const affiche = texte(arbre);
  expect(affiche).toContain('Relier le compte de mon enfant');
  expect(affiche).toContain('Tu ne vois jamais ses messages');
  expect(affiche).not.toContain('CLE_ABSENTE');
});

test('LIEN-ÉCRAN ② sans la déclaration parentale cochée, RIEN ne part', async () => {
  const arbre = await rendre();
  await saisir(arbre, '06 11 11 11 11');
  await envoyer(arbre);
  expect(mockDemander).not.toHaveBeenCalled();
  expect(texte(arbre)).toContain('Coche la déclaration parentale pour continuer.');
});

test('LIEN-ÉCRAN ③ un numéro impossible ne part pas', async () => {
  const arbre = await rendre();
  await saisir(arbre, '12');
  await cocher(arbre);
  await envoyer(arbre);
  expect(mockDemander).not.toHaveBeenCalled();
  expect(texte(arbre)).toContain('Ce numéro n’est pas valide.');
});

test('LIEN-ÉCRAN ④ la demande part, et la réponse ne dit RIEN du numéro', async () => {
  const arbre = await rendre();
  await saisir(arbre, '06 11 11 11 11');
  await cocher(arbre);
  await envoyer(arbre);
  expect(mockDemander)
    .toHaveBeenCalledWith({ declaredChildDocumentId: undefined, phoneNumber: '06 11 11 11 11' });

  await act(async () => { mockOptionsDeLaMutation.onSuccess({ state: 'pending' }); });
  const affiche = texte(arbre);
  expect(affiche).toContain('Demande envoyée');
  expect(affiche).toContain('Si ce numéro est celui d’un compte FoundClub de 13 à 17 ans');
  expect(affiche).not.toMatch(/introuvable|n'existe pas|compte trouvé/i);
});

// ⑤ — et l'écran propose de prévenir Léa par SMS.
test('LIEN-ÉCRAN ⑤ F20 : « Donner un compte à Léa » porte la fiche', async () => {
  mockRouteParams = { childDocumentId: 'enfant-1' };
  const arbre = await rendre();
  expect(texte(arbre)).toContain('Donner un compte à Léa');

  await saisir(arbre, '06 77 77 77 77');
  await cocher(arbre);
  await envoyer(arbre);
  expect(mockDemander)
    .toHaveBeenCalledWith({ declaredChildDocumentId: 'enfant-1', phoneNumber: '06 77 77 77 77' });

  await act(async () => { mockOptionsDeLaMutation.onSuccess({ state: 'pending' }); });
  await act(async () => { parRepere(arbre, 'parent-link-sms').props.onPress(); });
  expect(mockSms).toHaveBeenCalledWith(expect.objectContaining({
    phoneNumber: '06 77 77 77 77',
    url: 'https://staging.foundclub.app',
  }));
});

// ⑥ — âge du parent, fiche trop jeune, débit.
test('LIEN-ÉCRAN ⑥ les refus du serveur se disent en français', async () => {
  mockRouteParams = { childDocumentId: 'enfant-1' };
  const arbre = await rendre();
  await act(async () => {
    mockOptionsDeLaMutation.onError({
      details: { code: 'PARENT_LINK_REQUESTER_AGE_REQUIRED' },
      status: 403,
    });
  });
  expect(texte(arbre)).toContain('Renseigne ta date de naissance dans ton profil');

  await act(async () => {
    mockOptionsDeLaMutation.onError({ details: { code: 'DECLARED_CHILD_TOO_YOUNG' }, status: 400 });
  });
  expect(texte(arbre)).toContain('Léa aura son compte à 13 ans.');

  await act(async () => { mockOptionsDeLaMutation.onError({ status: 429 }); });
  expect(texte(arbre)).toContain('Trop de demandes');
});

// RW-PARENT e1 (29/10) — sur le site, l'adresse de la page ne porte plus le prénom du mineur :
// l'écran le relit dans la fiche, et n'en invente pas un quand la fiche est absente.
test('RW-PARENT e1 : le prénom vient de la fiche, pas de l adresse', async () => {
  mockRouteParams = { childDocumentId: 'enfant-1', childFirstname: 'Intrus' };
  const arbre = await rendre();
  expect(texte(arbre)).toContain('Donner un compte à Léa');
  expect(texte(arbre)).not.toContain('Intrus');

  mockEnfantsDeclares = [];
  mockRouteParams = { childDocumentId: 'enfant-1' };
  const sansFiche = await rendre();
  expect(texte(sansFiche)).not.toContain('Léa');
  mockEnfantsDeclares = [{ documentId: 'enfant-1', firstname: 'Léa' }];
});
