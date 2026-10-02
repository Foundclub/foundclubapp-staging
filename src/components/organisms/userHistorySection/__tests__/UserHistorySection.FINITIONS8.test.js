import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserHistorySection from '../UserHistorySection';

// FINITIONS8 · POINT 5 (tournee 9) — « 0 EXPERIENCE(S) · AUCUN HISTORIQUE RENSEIGNE ».
//
// Capture : .recette/tournee9/T9_A19b_1_papa_test_profil_de_hugo.png
// Papa Test lisait « 0 expérience(s) » sur le profil de Hugo, qui en a une. La cause est un
// refus du serveur (le role Parent n avait pas `user-history.findByUser` : admin,
// tests/authz/FINITIONS8-5-parent-historique.test.js). Mais la carte, elle, rendait un REFUS
// comme une liste VIDE : c est ce qui a cache le defaut. Une lecture tombee se dit tombee.
// Banc : les doublures de UserHistorySection.ajout.test.js, recopiees (fabrique).

/** @type {any} */
let mockHistories;
/** @type {boolean} */
let mockErreur = false;
const mockDelete = jest.fn();

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
        let brut = cle;
        if (typeof valeur === 'string') brut = valeur;
        else if (typeof repli === 'string') brut = repli;
        // `profile.history.count` porte un `{{count}}` : on l'interpole comme
        // i18next le ferait, sinon le texte rendu ne ressemble a rien.
        return brut.replace(
          /\{\{(\w+)\}\}/g,
          (/** @type {string} */ _entier, /** @type {string} */ cleOption) => (
            String(options?.[cleOption] ?? '')
          ),
        );
      },
    }),
  };
});

jest.mock('@/services/userHistory/userHistoryQueries', () => ({
  useDeleteHistory: () => ({ isPending: false, mutate: mockDelete }),
  useGetMyHistories: () => ({ data: mockHistories, isError: mockErreur, isLoading: false }),
  useGetUserHistories: () => ({ data: mockHistories, isError: mockErreur, isLoading: false }),
}));

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { club }) => <TexteRN>{`BLASON:${club?.name || ''}`}</TexteRN>,
  };
});

// Le VRAI theme, sans le contexte React qui le porte. Seul `Images` est un
// stub, et il l'est NOMMEMENT : c'est ce qui rend le bouton rond identifiable
// sans lire la forme de l'arbre.
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
      Images: { plus: 'IMAGE_PLUS', trash: 'IMAGE_CORBEILLE' },
      Spaces: espaces,
    }),
  };
});

/**
 * Aplati les enfants React en une chaine, pour lire le texte rendu.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Monte la carte sur le profil d'un autre (ici Hugo, vu par son parent).
 * @returns {Promise<any>}
 */
const rendreChezUnAutre = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<UserHistorySection isOwnProfile={false} userId="hugo" />);
  });
  return arbre;
};

/**
 * Tout le texte visible.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

beforeEach(() => {
  jest.clearAllMocks();
  mockHistories = undefined;
  mockErreur = false;
});

describe('FINITIONS8 · point 5 — un historique illisible ne se dit pas vide', () => {
  it('🚨 lecture refusee : « indisponible », jamais « 0 expérience(s) »', async () => {
    mockErreur = true;

    const texte = texteVisible(await rendreChezUnAutre());

    expect(texte).toContain('Historique indisponible pour le moment');
    expect(texte).not.toContain('0 expérience(s)');
    expect(texte).not.toContain('Aucun historique');
  });

  it('jumeau : une liste vraiment vide se dit vide', async () => {
    mockHistories = [];

    const texte = texteVisible(await rendreChezUnAutre());

    expect(texte).toContain('0 expérience(s)');
    expect(texte).toContain('Aucun historique');
  });

  it('jumeau : une experience se compte', async () => {
    mockHistories = [{
      club: { name: 'Aubagne Garlaban Basket' },
      documentId: 'exp-1',
      startYear: 2026,
    }];

    const texte = texteVisible(await rendreChezUnAutre());

    expect(texte).toContain('1 expérience(s)');
  });
});
