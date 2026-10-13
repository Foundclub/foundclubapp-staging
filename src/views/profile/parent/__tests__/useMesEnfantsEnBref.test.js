import renderer, { act } from 'react-test-renderer';

import { peutAvoirDesEnfants } from '../mesEnfantsEnBref';
import useMesEnfantsEnBref from '../useMesEnfantsEnBref';

/**
 * PAR-L7 (13/10) — LE CROCHET QUI LIT « MES ENFANTS » POUR L'ACCUEIL, LE MENU ET LE PROFIL.
 *
 * Ce qu'il doit garantir, et que le rendu ne dirait pas :
 * 1. il ne lit RIEN pour un compte qui ne peut pas avoir d'enfant (super admin, compte sans
 *    rôle : le serveur ne leur ouvre ni `/declared-children/mine` ni `/parent-links/as-parent`,
 *    admin `src/index.ts`, blocs Joueur / Entraîneur / Dirigeant / Parent seulement) ;
 * 2. il ne lit les demandes qu'avec au moins une fiche, et avec la MÊME clé que « Mes enfants »
 *    (`includeChildRequests` + `includeHistory`) : l'écran s'ouvre déjà rempli.
 */

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

/** @type {{ fiches: any, liens: any, demandes: any }} */
const mockDonnees = { demandes: undefined, fiches: undefined, liens: undefined };
const mockAppels = { demandes: [], fiches: [], liens: [] };

jest.mock('@/services/declaredChild/declaredChildQueries', () => ({
  useGetMyDeclaredChildren: (options) => {
    mockAppels.fiches.push(options);
    return { data: mockDonnees.fiches };
  },
}));
jest.mock('@/services/parentLink/parentLinkQueries', () => ({
  useParentLinksAsParent: (options) => {
    mockAppels.liens.push(options);
    return { data: mockDonnees.liens };
  },
}));
jest.mock('@/services/clubInterestRequest/clubInterestRequestQueries', () => ({
  useGetMyClubInterestRequests: (params, options) => {
    mockAppels.demandes.push({ options, params });
    return { data: mockDonnees.demandes };
  },
}));

/** @type {any} */
let resultat;
/**
 * La sonde : elle appelle le crochet et garde ce qu'il rend.
 * @param {{ actif: boolean }} props - Le compte peut-il avoir des enfants.
 * @returns {null} - Rien a l'ecran.
 */
function Sonde({ actif }) {
  resultat = useMesEnfantsEnBref({ actif });
  return null;
}

const monter = (actif) => {
  let arbre;
  act(() => { arbre = renderer.create(<Sonde actif={actif} />); });
  return arbre;
};

beforeEach(() => {
  mockAppels.demandes = [];
  mockAppels.fiches = [];
  mockAppels.liens = [];
  mockDonnees.fiches = undefined;
  mockDonnees.liens = undefined;
  mockDonnees.demandes = undefined;
});

test('peutAvoirDesEnfants — les quatre rôles du club ; ni le super admin ni un compte neuf', () => {
  expect(['parent', 'player', 'coach', 'president'].map(peutAvoirDesEnfants))
    .toEqual([true, true, true, true]);
  expect(['superAdmin', 'new', undefined].map(peutAvoirDesEnfants)).toEqual([false, false, false]);
});

test('éteint : aucune lecture ne part, et il ne dit rien', () => {
  const arbre = monter(false);

  expect(mockAppels.fiches.at(-1)).toEqual({ enabled: false });
  expect(mockAppels.liens.at(-1)).toEqual({ enabled: false });
  expect(mockAppels.demandes.at(-1).options).toEqual({ enabled: false });
  expect(resultat).toEqual({ lignes: [], reste: 0, total: 0 });
  act(() => arbre.unmount());
});

test('allumé sans fiche : les demandes ne sont pas lues', () => {
  mockDonnees.liens = {
    children: [{ documentId: 'user-hugo', firstname: 'Hugo' }],
    requests: [],
  };
  const arbre = monter(true);

  expect(mockAppels.fiches.at(-1)).toEqual({ enabled: true });
  expect(mockAppels.liens.at(-1)).toEqual({ enabled: true });
  expect(mockAppels.demandes.at(-1).options).toEqual({ enabled: false });
  expect(resultat.total).toBe(1);
  expect(resultat.lignes[0].etat).toBe('A son compte');
  act(() => arbre.unmount());
});

test('allumé avec une fiche : les demandes sont lues avec la clé de « Mes enfants »', () => {
  mockDonnees.fiches = [{ documentId: 'fiche-martin', firstname: 'Martin' }];
  mockDonnees.demandes = {
    data: [{
      declaredChild: { documentId: 'fiche-martin' }, status: 'pending', team: { name: 'U9' },
    }],
  };
  const arbre = monter(true);

  expect(mockAppels.demandes.at(-1)).toEqual({
    options: { enabled: true },
    params: { includeChildRequests: true, includeHistory: true },
  });
  expect(resultat.lignes.map((ligne) => `${ligne.prenom} · ${ligne.etat}`)).toEqual([
    'Martin · Demande en attente',
  ]);
  act(() => arbre.unmount());
});
