import { createElement } from 'react';
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
