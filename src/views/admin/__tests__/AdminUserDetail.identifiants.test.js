import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AdminUserDetail from '../AdminUserDetail';

/**
 * ADMIN-USER-FICHE — DEUX IDENTIFIANTS, DEUX PORTES, ET IL NE FAUT PAS LES
 * INTERVERTIR.
 *
 * Depuis le 2026-09-08, la liste passe le NUMERO de la personne (`item.id`) :
 * c'est ce qu'exige `/api/users/:id`, la route du greffon users-permissions
 * (services/user.js:88, `where: { $and: [{ id }] }`). Avant, elle passait le
 * `documentId` et PostgreSQL refusait — Sentry SERVEUR-STRAPI-7.
 *
 * ⚠️ MAIS LA SUPPRESSION NE PASSE PAS PAR LA. Elle appelle notre route maison
 * `/superadmin/users/:documentId`, qui veut l'IDENTIFIANT DOCUMENT. Lui envoyer
 * le numero echouerait — et cette fois sur un geste IRREVERSIBLE : l'anonymisation
 * definitive d'un compte.
 *
 * ⇒ La fiche lit donc l'identifiant document sur la personne CHARGEE, jamais sur
 * le parametre de navigation.
 *
 * 🛡️ Et le garde-fou qui compte plus que tout : le bouton « Supprimer » doit
 * rester INVISIBLE sur son propre compte. Un superadmin qui s'anonymise lui-meme
 * perd l'acces a l'administration, definitivement.
 */

/** @type {any} */
let mockUtilisateur;
/** @type {any} */
let mockCompteCourant;
/** @type {any[]} */
let mockSuppressions;
/** @type {any[]} */
let mockMisesAJour;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
  useRoute: () => ({ params: { userId: 195 } }),
}));

jest.mock('@/services/admin/adminQueries', () => ({
  useDeleteAdminUser: () => ({
    isPending: false,
    mutate: (payload) => { mockSuppressions.push(payload); },
  }),
  useGetAdminUser: () => ({ data: mockUtilisateur, error: null, isLoading: false }),
  useUpdateAdminUser: () => ({
    isPending: false,
    mutate: (payload) => { mockMisesAJour.push(payload); },
  }),
}));

jest.mock('@/services/auth/authQueries', () => ({
  useGetRoles: () => ({ data: { roles: [] }, isLoading: false }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockCompteCourant }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ openDirectChat: jest.fn() }),
}));

jest.mock('@/utils/errors/displayError', () => ({
  getErrorMessage: () => 'erreur',
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
      Spaces: espaces,
    }),
  };
});

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock(
  '@/views/admin/components/AdminStateView',
  () => function AdminStateViewMock() { return null; },
);
jest.mock(
  '@/components/molecules/profileAvatar/ProfileAvatar',
  () => function ProfileAvatarMock() { return null; },
);
jest.mock(
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function ClubLogoMarkMock() { return null; },
);
jest.mock(
  '@/components/atoms/button/Button',
  () => function ButtonMock() { return null; },
);

/**
 * 🧨 UN ARBRE JAMAIS DEMONTE FAIT ROUGIR LA CI SANS QU AUCUN TEMOIN NE SOIT ROUGE.
 *
 * Le `clearInterval` d un ecran vit dans le retour de son `useEffect` : il ne
 * tourne QU AU DEMONTAGE. Un arbre laisse en vie garde donc son minuteur, qui se
 * reveille dans un environnement Jest deja demoli et jette « You are trying to
 * import a file after the Jest environment has been torn down ». C est CETTE
 * exception qui fait le code de sortie 1, pas l attente.
 *
 * 🪤 On garde une LISTE, pas une variable : un test qui monte DEUX fois ecraserait
 * la variable et le premier arbre ne serait jamais demonte.
 * @type {any[]}
 */
const arbresMontes = [];

afterEach(() => {
  while (arbresMontes.length) {
    const arbre = arbresMontes.pop();
    act(() => { arbre.unmount(); });
  }
});

/**
 * Monte la fiche.
 * @returns {any} L arbre rendu.
 */
const monter = () => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<AdminUserDetail />); });
  arbresMontes.push(arbre);
  return arbre;
};

/**
 * Tout le texte affiche.
 * @param {any} arbre - L arbre rendu.
 * @returns {string} Le texte aplati.
 */
const texteDe = (arbre) => {
  const morceaux = [];
  const parcourir = (noeud) => {
    if (noeud == null) return;
    if (typeof noeud === 'string' || typeof noeud === 'number') {
      morceaux.push(String(noeud));
      return;
    }
    if (Array.isArray(noeud)) { noeud.forEach(parcourir); return; }
    parcourir(noeud.children);
  };
  parcourir(arbre.toJSON());
  return morceaux.join(' ');
};

beforeEach(() => {
  mockSuppressions = [];
  mockMisesAJour = [];
  mockUtilisateur = {
    documentId: 'h7ogtmeqmzy18mtcj3h0w2fk',
    firstname: 'Sylvain',
    id: 195,
    lastname: 'Touy',
    role: { id: 4, name: 'Entraineur', type: 'entraineur' },
  };
  mockCompteCourant = { documentId: 'moi-superadmin-doc', id: 1 };
  jest.spyOn(Alert, 'alert').mockImplementation((titre, message, boutons) => {
    // On appuie tout de suite sur le bouton destructeur, pour aller au geste.
    const destructeur = (boutons || []).find((b) => typeof b?.onPress === 'function');
    if (destructeur) destructeur.onPress();
  });
});

afterEach(() => { jest.restoreAllMocks(); });

test('FICHE/1 — la suppression envoie l identifiant DOCUMENT, pas le numero', () => {
  const arbre = monter();

  const bouton = arbre.root.findAll(
    (noeud) => noeud.props?.accessibilityLabel === 'Supprimer le compte'
      && typeof noeud.props?.onPress === 'function',
    { deep: true },
  )[0];
  expect(bouton).toBeTruthy();
  act(() => { bouton.props.onPress(); });

  expect(mockSuppressions).toHaveLength(1);
  expect(mockSuppressions[0].documentId).toBe('h7ogtmeqmzy18mtcj3h0w2fk');
  expect(mockSuppressions[0].documentId).not.toBe(195);
});

test('FICHE/2 — le bouton Supprimer reste INVISIBLE sur son propre compte', () => {
  // Un superadmin qui s anonymise lui-meme perd l acces, definitivement.
  mockCompteCourant = { documentId: 'h7ogtmeqmzy18mtcj3h0w2fk', id: 195 };

  const arbre = monter();

  expect(texteDe(arbre)).not.toContain('Supprimer le compte');
});

test('FICHE/3 — tant que la personne n est pas chargee, aucune suppression n est possible', () => {
  // Sans la personne, on n a PAS son identifiant document : envoyer le numero
  // a la route de suppression viserait la mauvaise porte, sur un geste
  // irreversible. Mieux vaut ne rien pouvoir faire.
  mockUtilisateur = null;

  const arbre = monter();

  expect(texteDe(arbre)).not.toContain('Supprimer le compte');
});
