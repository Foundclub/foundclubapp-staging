import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import TourAnnonceExemple from '../TourAnnonceExemple';
import TourCampagneExemple from '../TourCampagneExemple';

// GUIDE-D-B1B4 (décision d'Adel « 80- B », 05/11) : la fin de B1 et de B4 montre un écran d'exemple
// complet. Rien ne part : ces écrans n'importent aucun service, et leur état reste local.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => (
      String(typeof repli === 'string' ? repli : cle).replace(
        /\{\{(\w+)\}\}/g,
        (_, nom) => String(valeurs?.[nom] ?? ''),
      )
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const { createElement: creer } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ children }) => creer(View, null, children) };
});
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);
jest.mock('@/components/atoms/tag/Tag', () => {
  const { createElement: creer } = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ text }) => creer(Text, null, text) };
});
jest.mock('@/components/atoms/button/Button', () => {
  const { createElement: creer } = jest.requireActual('react');
  const { Text, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onPress, title }) => creer(
      TouchableOpacity,
      { onPress, testID: `bouton-${title}` },
      creer(Text, null, title),
    ),
  };
});
jest.mock('@/components/molecules/tour/TourTarget', () => {
  const { createElement: creer } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children, id }) => creer(View, { testID: `ancre-${id}` }, children),
  };
});

/**
 * Textes d'un arbre, dans l'ordre.
 * @param {any} arbre - Arbre monté.
 * @returns {string[]} Tous les textes rendus.
 */
const textes = (arbre) => {
  /** @type {string[]} */
  const trouves = [];
  /**
   * Parcourt un noeud.
   * @param {any} noeud - Noeud JSON.
   */
  const parcourir = (noeud) => {
    if (noeud === null || noeud === undefined) return;
    if (typeof noeud === 'string') {
      trouves.push(noeud);
      return;
    }
    if (Array.isArray(noeud)) {
      noeud.forEach(parcourir);
      return;
    }
    parcourir(noeud.children);
  };
  parcourir(arbre.toJSON());
  return trouves;
};
const texte = (/** @type {any} */ arbre) => textes(arbre)
  .join(' ')
  .replace(/[\s\u00a0\u202f]+/g, ' ');
const hotes = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ noeud) => noeud.props.testID === testID && typeof noeud.type === 'string',
);
const toucher = (/** @type {any} */ arbre, /** @type {string} */ titre, rang = 0) => {
  const bouton = arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.props.testID === `bouton-${titre}`
      && typeof noeud.props.onPress === 'function'
      && typeof noeud.type !== 'string',
  )[rang];
  act(() => bouton.props.onPress());
};

describe('B1 : la campagne d exemple', () => {
  const monter = (/** @type {any} */ props = {}) => {
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(createElement(TourCampagneExemple, {
        amountCents: 25000,
        currency: 'EUR',
        name: 'Cotisation licences 2026/2027',
        ...props,
      }));
    });
    return arbre;
  };

  it('reprend le nom et le montant saisis, avec 2 membres fictifs et les 4 chiffres', () => {
    const arbre = monter();
    const lu = texte(arbre);
    expect(lu).toContain('Cotisation licences 2026/2027');
    ['Attendu', 'Encaissé', 'Reste', 'Retards', 'Membres', 'Exemple'].forEach((mot) => {
      expect(lu).toContain(mot);
    });
    expect(lu).toContain('500,00');
    expect(hotes(arbre, 'ancre-camp-list')).toHaveLength(1);
    expect(hotes(arbre, 'ancre-camp-relance')).toHaveLength(1);
    // La puce du filtre, plus les 2 membres.
    expect(textes(arbre).filter((mot) => mot === 'En attente')).toHaveLength(3);
  });

  it('« A payé » déplace le montant, en local', () => {
    const arbre = monter();
    toucher(arbre, 'A payé');
    const lu = texte(arbre);
    expect(textes(arbre)).toContain('Payé');
    expect(textes(arbre).filter((mot) => mot === 'En attente')).toHaveLength(2);
    // Encaissé 250, reste 250, attendu 500 : le montant du membre payé ne « reste » plus.
    expect(lu).toContain('500,00');
    expect(lu.match(/250,00/g).length).toBe(3);
  });

  it('« Relancer » dit que rien n est parti', () => {
    const arbre = monter();
    expect(texte(arbre)).not.toContain('rien n’est envoyé à ce membre');
    toucher(arbre, 'Relancer');
    expect(texte(arbre)).toContain('rien n’est envoyé à ce membre');
  });

  it('montant vide : le montant du pack, jamais 0 €', () => {
    expect(texte(monter({ amountCents: 0, name: '' }))).toContain('500,00');
  });
});

describe('B4 : l annonce d exemple', () => {
  const monter = (/** @type {any} */ props = {}) => {
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(createElement(TourAnnonceExemple, {
        address: 'Gymnase bouc',
        categoryName: 'Sénior',
        club: { name: 'FoundClub' },
        description: '',
        levelName: 'Régional 1',
        now: new Date(2026, 9, 26),
        positionLabel: 'Ailier gauche',
        sectionName: 'Masculine',
        teamName: 'Senior',
        ...props,
      }));
    });
    return arbre;
  };

  it('se lit comme une annonce en ligne, sans candidature, avec ses 3 boutons', () => {
    const arbre = monter();
    const lu = texte(arbre);
    [
      'Ailier gauche', 'EN LIGNE', 'Exemple', 'FoundClub', 'Régional 1', 'Sénior', 'Publiée le',
      'Gymnase bouc', 'Candidatures (0)', 'Aucune candidature pour le moment.', 'Description',
      'Aucune description fournie pour cette annonce.', 'Modifier', 'Supprimer',
      'Créer l’affiche à partager',
    ].forEach((mot) => expect(lu).toContain(mot));
    expect(hotes(arbre, 'ancre-ad-cand')).toHaveLength(1);
    expect(hotes(arbre, 'ancre-ad-poster')).toHaveLength(1);
  });

  it('expire 30 jours après sa publication, comme une vraie', () => {
    const lu = texte(monter());
    expect(lu).toContain('26 octobre');
    expect(lu).toContain('Expire le 25 novembre');
  });

  it('sans poste choisi : le poste du pack', () => {
    expect(texte(monter({ positionLabel: '' }))).toContain('Ailier gauche');
  });
});
