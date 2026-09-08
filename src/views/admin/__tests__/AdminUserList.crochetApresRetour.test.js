import { FlatList } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AdminUserList from '../AdminUserList';

/**
 * ADMIN-CRASH — L ECRAN « UTILISATEURS » PLANTE DES QUE LA LISTE MET UN INSTANT A ARRIVER.
 *
 * LE SYMPTOME, REMONTE PAR ADEL LE 2026-09-08 : « sur le compte superadmin, quand je vais
 * dans l onglet du dashboard user, ca crash complet ».
 * Sentry, la meme minute : REACT-NATIVE-4, « Rendered more hooks than during the previous
 * render », culprit updateWorkInProgressHook, view_names ["AdminUserList"], version des
 * MAGASINS 2.6.35+1221, iPhone15,4, FR/Marseille. 2 occurrences, 1 personne.
 *
 * LA CAUSE, LISIBLE EN TROIS LIGNES DU FICHIER :
 *   ligne 46  if (isLoading && !users.length) { return (...) }   <- sortie anticipee
 *   ligne 55  if (error && !users.length)     { return (...) }   <- sortie anticipee
 *   ligne 78  const renderItem = useCallback(...)                <- crochet APRES
 *
 * Au PREMIER rendu la liste charge : la sortie est prise, et useCallback n est jamais
 * appele. Au rendu SUIVANT, les donnees sont la, la sortie n est plus prise, et useCallback
 * s execute. React compte alors UN crochet de plus qu au tour precedent — et il jette.
 *
 * ⚠️ C EST POUR CA QUE L ECRAN NE PLANTE PAS TOUJOURS : si les donnees sont deja en cache,
 * le premier rendu ne sort pas en avance, les deux tours comptent le meme nombre de
 * crochets, et tout se passe bien. Il faut le VA-ET-VIENT pour le declencher — ce temoin le
 * reproduit exactement.
 *
 * LA REGLE, ET ELLE N A PAS D EXCEPTION : dans un composant React, TOUS les crochets
 * s appellent AVANT le premier return, toujours, dans le meme ordre.
 */

/** @type {any} */
let mockEtatRequete;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('@/services/admin/adminQueries', () => ({
  useGetAdminUsers: () => mockEtatRequete,
}));

jest.mock('@/utils/errors/displayError', () => ({
  getErrorMessage: () => 'erreur',
}));

// Le VRAI theme, jamais un Proxy : un Proxy rend les echecs Jest illisibles.
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
      Spaces: espaces,
    }),
  };
});

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

jest.mock(
  '@/views/admin/components/AdminStateView',
  () => function AdminStateViewMock() {
    return null;
  },
);

jest.mock(
  '@/components/molecules/profileAvatar/ProfileAvatar',
  () => function ProfileAvatarMock() {
    return null;
  },
);

const UTILISATEURS = [
  {
    club: { name: 'SMUC' },
    documentId: 'u-1',
    email: 'a@b.fr',
    firstname: 'Anissa',
    lastname: 'Dubelloy',
    role: { name: 'Joueur', type: 'joueur' },
  },
];

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte l ecran, puis le rend une seconde fois — c est le va-et-vient qui declenche le defaut.
 * @returns {any} L arbre monte.
 */
const monterPuisRecevoirLesDonnees = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<AdminUserList />);
  });
  arbresMontes.push(arbre);

  // Les donnees arrivent : le rendu suivant ne prend plus la sortie anticipee.
  mockEtatRequete = {
    data: UTILISATEURS, error: null, isLoading: false, refetch: jest.fn(),
  };
  act(() => {
    arbre.update(<AdminUserList />);
  });
  return arbre;
};

beforeEach(() => {
  mockEtatRequete = {
    data: undefined, error: null, isLoading: true, refetch: jest.fn(),
  };
});

afterEach(() => {
  arbresMontes.forEach((arbre) => act(() => arbre.unmount()));
  arbresMontes.length = 0;
});

describe('ADMIN-CRASH — l ecran Utilisateurs survit a l arrivee des donnees', () => {
  it('LE CAS D ADEL : la liste charge, puis arrive — l ecran ne doit PAS jeter', () => {
    expect(() => monterPuisRecevoirLesDonnees()).not.toThrow();
  });

  // ⚠️ On observe la LISTE, pas le rendu : `toJSON()` sur un arbre contenant une FlatList
  // rend une structure circulaire, et un lecteur virtualise ne dessine pas forcement ses
  // lignes hors d un vrai ecran. La donnee qui ARRIVE a la liste est la bonne preuve.
  it('et la personne arrive bien jusqu a la liste', () => {
    const arbre = monterPuisRecevoirLesDonnees();

    const liste = arbre.root.findByType(FlatList);
    expect(liste.props.data).toHaveLength(1);
    expect(liste.props.data[0].firstname).toBe('Anissa');
  });

  // Le meme va-et-vient, mais par l ERREUR : c est la seconde sortie anticipee du fichier,
  // et elle a exactement le meme defaut.
  it('une erreur qui se resout ne fait pas jeter l ecran non plus', () => {
    mockEtatRequete = {
      data: undefined, error: new Error('panne'), isLoading: false, refetch: jest.fn(),
    };

    expect(() => monterPuisRecevoirLesDonnees()).not.toThrow();
  });
});
