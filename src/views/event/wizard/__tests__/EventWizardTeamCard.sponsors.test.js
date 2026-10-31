import { createElement } from 'react';
import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventWizardTeamCard from '../components/EventWizardTeamCard';

// Filet D58 (E6) — LA CARTE D EQUIPE N AVAIT AUCUN TEST, et elle est PARTAGEE
// par 6 ecrans de 4 tunnels : evenement (etape Equipe), invitations, amical
// (`FriendlyMatchWizardTeam`) et recrutement (`AdWizardTeam`, `AdWizardRecap`).
//
// Le pack « Tunnel Evenement » §2.2 retire les sponsors de l'etape Equipe. Les
// retirer de la CARTE les aurait retires des 3 autres tunnels, que le pack ne
// couvre pas. D58 ajoute donc `showSponsors`, vrai par defaut. Ce fichier fige
// les deux directions : sans la propriete rien ne change pour les 5 autres
// appelants, avec `false` les sponsors disparaissent.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

// Le VRAI theme, sans le contexte React qui le porte. ⛔ Jamais un Proxy : il
// rend les echecs Jest illisibles (constat du lot paywall, 02/08).
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

jest.mock('@/components/atoms/sponsorLogoTile/SponsorLogoTile', () => () => null);
jest.mock('@/components/atoms/tag/Tag', () => () => null);
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);

const EQUIPE_SPONSORISEE = {
  category: { name: 'U15' },
  club: {
    name: 'FC Test',
    sponsor: [
      { documentId: 'sp-1', title: 'Garage Dupont' },
      { documentId: 'sp-2', title: 'Boulangerie Martin' },
    ],
  },
  documentId: 'equipe-1',
  name: 'U15 A',
  sport: { name: 'Football' },
};

/**
 * Tous les textes visibles rendus par la carte.
 * @param {any} arbre Arbre de test.
 * @returns {string[]} Les textes, dans l'ordre du rendu.
 */
const textesDe = (arbre) => {
  /** @type {string[]} */
  const sortie = [];
  const parcourir = (/** @type {any} */ noeud) => {
    if (typeof noeud === 'string' || typeof noeud === 'number') {
      sortie.push(String(noeud));
      return;
    }
    if (Array.isArray(noeud)) {
      noeud.forEach(parcourir);
      return;
    }
    if (noeud?.children) noeud.children.forEach(parcourir);
  };
  parcourir(arbre.toJSON());
  return sortie;
};

/**
 * Monte la carte et rend ses textes visibles.
 * @param {any} proprietes Proprietes passees a la carte.
 * @returns {string[]} Les textes rendus.
 */
const monterEtLire = (proprietes) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(EventWizardTeamCard, {
      onPress: () => {},
      team: EQUIPE_SPONSORISEE,
      ...proprietes,
    }));
  });
  const textes = textesDe(arbre);
  act(() => arbre.unmount());
  return textes;
};

describe('D58 — les sponsors de la carte d equipe', () => {
  test('par defaut ils s affichent : les 3 autres tunnels ne changent pas', () => {
    const textes = monterEtLire({});

    expect(textes).toContain('Garage Dupont');
    expect(textes).toContain('Boulangerie Martin');
  });

  test('showSponsors={false} les retire, et garde le reste de la carte', () => {
    const textes = monterEtLire({ showSponsors: false });

    expect(textes).not.toContain('Garage Dupont');
    expect(textes).not.toContain('Boulangerie Martin');
    // ⛔ Le garde-fou : on retire les sponsors, pas la carte. Sans cette ligne,
    // une carte devenue vide passerait le test precedent.
    expect(textes).toContain('U15 A');
  });
});

// 🐞 FINITIONS15 point 7 (tournée T14, A00) — « MEMBRES, 0 » PARTOUT DANS LE TUNNEL D'ANNONCE.
// L'annonce reçoit les équipes de l'utilisateur SANS leurs listes (ni `players`, ni `trainers`,
// ni `members`) ; la carte comptait alors « 0 » — un nombre faux (le tunnel d'événement, qui lit
// les effectifs, disait 2, 16, 1). Même règle que FINITIONS14 5f : un nombre qu'on n'a pas ne
// s'écrit pas. Une liste lue et VIDE, elle, dit vraiment 0. ROUGE avant le lot.
describe('FINITIONS15 point 7 — la carte ne compte pas des membres qu elle n a pas lus', () => {
  test('aucune liste lue : ni « Membres », ni « 0 »', () => {
    const textes = monterEtLire({});

    expect(textes).not.toContain('Membres');
    expect(textes).not.toContain('0');
    expect(textes).toContain('U15 A');
  });

  test('des listes lues : le nombre de personnes, sans doublon', () => {
    const textes = monterEtLire({
      team: {
        ...EQUIPE_SPONSORISEE,
        players: [{ documentId: 'j-1' }, { documentId: 'j-2' }],
        trainers: [{ documentId: 'j-2' }],
      },
    });

    expect(textes).toContain('Membres');
    expect(textes).toContain('2');
  });

  test('une liste lue et vide : « 0 » est vrai, il s écrit', () => {
    const textes = monterEtLire({ team: { ...EQUIPE_SPONSORISEE, players: [] } });

    expect(textes).toContain('Membres');
    expect(textes).toContain('0');
  });
});

// CORR-ROBUSTESSE point 55 (recette du site, 30/10, « A ») — la carte se touche mais n'était
// annoncée ni comme bouton, ni par son nom, ni « sélectionnée ».
test('point 55 — la carte est un bouton nommé (équipe, club) qui dit si elle est choisie', () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(EventWizardTeamCard, {
      isSelected: true, onPress: () => {}, team: EQUIPE_SPONSORISEE,
    }));
  });
  const { props } = arbre.root.findAllByType(TouchableOpacity)[0];
  act(() => arbre.unmount());

  expect([props.accessibilityRole, props.accessibilityLabel, props.accessibilityState])
    .toEqual(['button', 'U15 A, FC Test', { disabled: false, selected: true }]);
});
