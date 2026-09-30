import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import RecruitmentAdCard from '../RecruitmentAdCard';

// LOT ANNONCES-SPORT (2026-09-30) — point A10 de l'audit V1.
// La carte affichait « FOOTBALL » pour toute annonce sans sport : `ad.sport || team?.sport
// || 'Football'`. Or une annonce creee depuis l'app n'avait JAMAIS de sport (le crochet serveur
// perdait l'equipe, corrige cote `admin`) : une annonce d'arts martiaux se presentait donc en
// football. Ce temoin fige la regle : le sport de l'annonce, sinon l'activite de l'equipe quand
// la reponse la porte, sinon RIEN — jamais un sport invente.
//
// Couture : le TEXTE affiche, pas la forme de l'arbre.

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

const annonce = (/** @type {any} */ extra) => ({
  audienceType: 'player',
  city: 'Lyon',
  isActive: true,
  position: 'Ailier',
  team: { club: { name: 'Dojo de Lyon' }, name: 'Seniors' },
  ...extra,
});

describe('RecruitmentAdCard — etiquette du sport (ANNONCES-SPORT)', () => {
  it("affiche le sport de l'annonce", () => {
    const textes = texteAffiche(annonce({ sport: 'Basket' }));
    expect(textes).toContain('Basket');
    expect(textes).not.toContain('Football');
  });

  it("sans sport, reprend l'activite de l'equipe quand la reponse la porte", () => {
    const textes = texteAffiche(annonce({
      sport: null,
      team: {
        activities: [{ name: 'Arts martiaux' }],
        club: { name: 'Dojo de Lyon' },
        name: 'Seniors',
      },
    }));
    expect(textes).toContain('Arts martiaux');
    expect(textes).not.toContain('Football');
  });

  // FINITIONS-AUDIT (3) : sans poste, le titre est « <Sport> — <Catégorie> », jamais
  // « Poste non spécifié ».
  it('sans poste : le titre est « SPORT — CATEGORIE », le sport seul sans categorie', () => {
    const judo = {
      activities: [{ name: 'Arts martiaux' }], club: { name: 'Dojo de Lyon' }, name: 'Seniors',
    };
    const avecCategorie = texteAffiche(annonce({
      category: { name: 'U13' }, position: null, team: judo,
    }));
    expect(avecCategorie).toContain('ARTS MARTIAUX — U13');
    expect(avecCategorie).not.toContain('POSTE NON SPÉCIFIÉ');

    expect(texteAffiche(annonce({ category: null, position: '', sport: 'Arts martiaux' })))
      .toContain('ARTS MARTIAUX');
  });

  it('sans sport ni activite : AUCUNE etiquette de sport, surtout pas « Football »', () => {
    const textes = texteAffiche(annonce({ sport: null }));
    expect(textes).not.toContain('Football');
    // Le reste de la carte est toujours la : on n'a pas vide la carte pour faire taire le test.
    expect(textes).toContain('AILIER');
    expect(textes).toContain('Seniors');
  });
});
