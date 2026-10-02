import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import RecruitmentAdCard from '../RecruitmentAdCard';

// FINITIONS8 · POINT 9 (tournee 9) — « ENTRAINEUR ADJOINT », « benevole » SUR LA CARTE.
//
// La carte d'une annonce ENTRAINEUR lisait ses deux valeurs techniques telles quelles :
//   · le titre : `humanizeEnumLabel(coachRole)` => « Entraineur Adjoint », mis en capitales ;
//   · la ligne du bas : `ad.engagementType` brut => « benevole ».
// Les tables existent : `getCoachRoleLabel` (constants/coachRoles.js, H3) et les libelles
// d'engagement du tunnel, qui en sortent ici (`getEngagementLabel`).
// Banc : les doublures de RecruitmentAdCard.test.js (fabrique).

jest.mock('@react-navigation/native', () => {
  const mockNavigation = { navigate: () => {} };
  return { useNavigation: () => mockNavigation };
});

jest.mock('react-i18next', () => {
  const mockTraduction = {
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  };
  return { useTranslation: () => mockTraduction };
});

// react-native-reanimated est publie en ESM pur et n'est PAS dans transformIgnorePatterns.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    useAnimatedStyle: () => ({}),
    useSharedValue: (/** @type {any} */ value) => ({ value }),
    withTiming: (/** @type {any} */ value) => value,
  };
});

// Le VRAI theme : un Proxy rendrait les echecs illisibles.
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const couleurs = genererCouleurs();
  const mockTheme = { Colors: couleurs, Fonts: genererPolices(couleurs), Images: {} };
  return { __esModule: true, default: () => mockTheme };
});

jest.mock('@/domains/auth/useAuth', () => {
  const mockAuth = { userData: null };
  return { __esModule: true, default: () => mockAuth };
});

// Double ENTIER : le service importe le client HTTP, qui refuse de se charger sans API_URL.
jest.mock('@/services/recruitment/recruitmentService', () => {
  const mockEtat = { hasApplied: false, status: null };
  return { resolveRecruitmentAdApplicationState: () => mockEtat };
});

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);

jest.mock('@/components/atoms/marqueeText/MarqueeText', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return (/** @type {any} */ props) => reactActuel.createElement(TexteRN, null, props.text);
});

/**
 * Tout le texte affiche par la carte, un element par `Text`, concatene comme a l'ecran.
 * @param {any} ad
 * @returns {string[]}
 */
const texteAffiche = (ad) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(RecruitmentAdCard, { ad }));
  });
  const textes = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.type === 'string' && noeud.type === 'Text')
    .map((/** @type {any} */ noeud) => [].concat(noeud.props.children)
      .filter((enfant) => typeof enfant === 'string')
      .join(''));
  act(() => arbre.unmount());
  return textes;
};

const annonceEntraineur = (/** @type {any} */ extra) => ({
  audienceType: 'coach',
  city: 'Marseille',
  coachRole: 'entraineur_adjoint',
  engagementType: 'benevole',
  isActive: true,
  team: { club: { name: 'AS Montrivage' }, name: 'U15' },
  ...extra,
});

describe('FINITIONS8 · point 9 — la carte d une annonce entraineur se lit en francais', () => {
  it('🚨 le titre dit « ENTRAÎNEUR ADJOINT », jamais « ENTRAINEUR ADJOINT »', () => {
    const textes = texteAffiche(annonceEntraineur());

    expect(textes).toContain('ENTRAÎNEUR ADJOINT');
    expect(textes).not.toContain('ENTRAINEUR ADJOINT');
  });

  it('🚨 l engagement dit « Bénévole », jamais la valeur « benevole »', () => {
    const textes = texteAffiche(annonceEntraineur());

    expect(textes).toContain('Bénévole');
    expect(textes).not.toContain('benevole');
  });

  it('un role « autre » se lit par sa precision', () => {
    const textes = texteAffiche(annonceEntraineur({
      coachRole: 'other',
      coachRoleOther: 'Coach mental',
    }));

    expect(textes).toContain('COACH MENTAL');
  });
});
