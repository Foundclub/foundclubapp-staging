import { createElement } from 'react';
import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import RecruitmentAdCard from '../RecruitmentAdCard';

// FINITIONS16 · POINT 5 (tournee T15, chez Hugo, annonce « Préparateur physique » de Montrivage FC)
// — LA CARTE DE LA LISTE GARDAIT « Candidater » ACTIF SUR UNE ANNONCE EXPIRÉE, alors que la fiche
// dit « EXPIRÉE » et grise « Annonce expirée ». La carte ne lisait que `isActive` ; l'echeance
// n'est fermee par aucun serveur (recruitmentAdRenewal.js). Meme borne que la fiche :
// `getRecruitmentAdExpiry` (une annonce liee a un EVENEMENT n'a pas d'echeance propre).
// ROUGE avant. Dates relatives a MAINTENANT : une date ecrite en dur vieillit avec l'horloge.
// Banc : les doublures de RecruitmentAdCard.FINITIONS8.test.js.

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

const JOUR_MS = 24 * 60 * 60 * 1000;
const ilYA = (/** @type {number} */ jours) => new Date(Date.now() - (jours * JOUR_MS))
  .toISOString();
const dansJours = (/** @type {number} */ jours) => new Date(Date.now() + (jours * JOUR_MS))
  .toISOString();

/** @type {any} */
let arbre = null;

const monter = (/** @type {any} */ props) => {
  act(() => {
    arbre = renderer.create(createElement(RecruitmentAdCard, props));
  });
  return arbre;
};

const textes = () => arbre.root
  .findAll((/** @type {any} */ noeud) => typeof noeud.type === 'string' && noeud.type === 'Text')
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children)
    .filter((enfant) => typeof enfant === 'string')
    .join(''));

/**
 * Le bouton « Candidater » / « Postuler », quand la carte le rend appuyable.
 * @returns {any} Le noeud, ou undefined.
 */
const boutonCandidater = () => arbre.root.findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud.props.accessibilityRole === 'button');

const preparateurPhysique = (/** @type {any} */ extra) => ({
  audienceType: 'coach',
  city: 'Montrivage',
  coachRole: 'preparateur_physique',
  isActive: true,
  team: { club: { name: 'Montrivage FC' }, name: 'Seniors' },
  ...extra,
});

afterEach(() => {
  if (arbre) act(() => { arbre.unmount(); });
  arbre = null;
});

describe('FINITIONS16 5 — la carte d une annonce EXPIRÉE ne propose plus de candidater', () => {
  it('🔴 echeance passee : pas de bouton, la carte dit « Annonce expirée », comme la fiche', () => {
    const onApply = jest.fn();
    monter({ ad: preparateurPhysique({ expirationDate: ilYA(2) }), onApply });

    expect(boutonCandidater()).toBeUndefined();
    expect(textes()).toContain('Annonce expirée');
    expect(textes()).not.toContain('Candidater');
  });

  it('🔴 son auteur lit « Expirée », pas « En ligne »', () => {
    monter({ ad: preparateurPhysique({ expirationDate: ilYA(2) }), isOwner: true });

    expect(textes()).toContain('Expirée');
    expect(textes()).not.toContain('En ligne');
  });

  it('🔒 echeance a venir : « Candidater » reste appuyable et part', () => {
    const onApply = jest.fn();
    const annonce = preparateurPhysique({ expirationDate: dansJours(10) });
    monter({ ad: annonce, onApply });

    expect(textes()).toContain('Candidater');
    act(() => { boutonCandidater().props.onPress(); });
    expect(onApply).toHaveBeenCalledWith(annonce);
  });

  it('🔒 une annonce liee a un EVENEMENT n a pas d echeance propre : la carte ne change pas', () => {
    monter({
      ad: preparateurPhysique({ event: { documentId: 'detection-1' }, expirationDate: ilYA(2) }),
      onApply: jest.fn(),
    });

    expect(boutonCandidater()).toBeDefined();
    expect(textes()).not.toContain('Annonce expirée');
  });

  it('🔒 sans echeance lisible : rien ne change', () => {
    monter({ ad: preparateurPhysique(), isOwner: true });

    expect(textes()).toContain('En ligne');
  });
});
