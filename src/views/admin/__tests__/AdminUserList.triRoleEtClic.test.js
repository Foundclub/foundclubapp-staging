import renderer, { act } from 'react-test-renderer';

import AdminUserList from '../AdminUserList';

/**
 * ADMIN-USERS — TROIS DEMANDES D ADEL DU 2026-09-08, APRES AVOIR TESTE LA 2.6.36.
 *
 * 🐛 1. « QUAND JE CLIQUE SUR UN UTILISATEUR J AI UNE ERREUR ».
 * Sentry, la meme minute (SERVEUR-STRAPI-7, 6 occurrences, client foundclub 1231) :
 *   GET /api/users/h7ogtmeqmzy18mtcj3h0w2fk
 *   invalid input syntax for type integer: "h7ogtmeqmzy18mtcj3h0w2fk"
 * La liste passait le `documentId` de la personne. Or la route du greffon
 * users-permissions cherche par NUMERO :
 *   node_modules/@strapi/plugin-users-permissions/.../services/user.js:88
 *   fetch(id, params) -> db.query(...).findOne({ where: { $and: [{ id }] } })
 * PostgreSQL recoit une chaine la ou il attend un entier, et il refuse.
 * ⚠️ MAIS la SUPPRESSION, elle, passe par notre route maison
 * `/superadmin/users/:documentId` : elle a besoin de l identifiant document.
 * Les deux identifiants coexistent, et chacun va a sa porte.
 *
 * 📅 2. « QUE CA AFFICHE D ABORD LES DERNIERS UTILISATEURS ».
 * Le tri etait DEJA demande (`sort: ['createdAt:desc']`, verifie : l app envoie
 * bien `sort[]=createdAt:desc`). Ce qui manquait, c est de POUVOIR LE VOIR :
 * une ligne montrait le nom, un e-mail (toujours vide, le serveur le retire) et
 * le role — jamais la date. Impossible de constater l ordre.
 *
 * 🎭 3. « QUE JE PUISSE LES TRIER EN FONCTION AU MOINS DU ROLE ».
 * Le service acceptait deja un parametre `role` ; aucun ecran ne l utilisait.
 * Les noms techniques, releves en production le 2026-09-08 :
 *   joueur (74) · authenticated (46) · dirigeant (14) · entraineur (2)
 *   parent (2) · superadmin (1)
 * ⚠️ « entraineur » N A PAS D ACCENT en base. La pastille de couleur cherchait
 * « entraîneur » : elle n a donc JAMAIS pris sa couleur depuis qu elle existe.
 */

/** @type {any} */
let mockEtatRequete;
/** @type {any[]} */
let mockParamsRecus;
/** @type {any} */
let mockNavigation;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('@/services/admin/adminQueries', () => ({
  useGetAdminUsers: (params) => {
    mockParamsRecus.push(params);
    return mockEtatRequete;
  },
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

const PERSONNE = {
  createdAt: '2026-09-08T09:50:00.000Z',
  documentId: 'h7ogtmeqmzy18mtcj3h0w2fk',
  firstname: 'Sylvain',
  id: 195,
  lastname: 'Touy',
  role: { name: 'Entraineur', type: 'entraineur' },
};

/**
 * Monte l ecran.
 * @returns {any} L arbre rendu.
 */
const monter = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<AdminUserList />);
  });
  return arbre;
};

/**
 * Tout le texte affiche, aplati.
 * @param {any} arbre - L arbre rendu.
 * @returns {string} Le texte.
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

/**
 * Appuie sur le premier element dont le libelle d accessibilite correspond.
 * @param {any} arbre - L arbre rendu.
 * @param {string} libelle - Le libelle cherche.
 * @returns {boolean} Vrai si un element a ete touche.
 */
const appuyerSur = (arbre, libelle) => {
  const cible = arbre.root.findAll(
    (noeud) => noeud.props?.accessibilityLabel === libelle && typeof noeud.props?.onPress === 'function',
    { deep: true },
  )[0];
  if (!cible) return false;
  act(() => { cible.props.onPress(); });
  return true;
};

beforeEach(() => {
  mockParamsRecus = [];
  mockNavigation = { navigate: jest.fn() };
  mockEtatRequete = {
    data: { data: [PERSONNE] },
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  };
});

test('USERS/1 — toucher une personne envoie son NUMERO, pas son identifiant document', () => {
  const arbre = monter();

  const ligne = arbre.root.findAll(
    (noeud) => typeof noeud.props?.onPress === 'function'
      && noeud.props?.accessibilityLabel === 'Ouvrir la fiche de Sylvain Touy',
    { deep: true },
  )[0];
  expect(ligne).toBeTruthy();
  act(() => { ligne.props.onPress(); });

  expect(mockNavigation.navigate).toHaveBeenCalledWith(
    expect.anything(),
    { userId: 195 },
  );
});

test('USERS/2 — chaque ligne montre la date d inscription', () => {
  // Sans elle, impossible de CONSTATER que les derniers inscrits sont en haut.
  const arbre = monter();

  expect(texteDe(arbre)).toContain('08/09/2026');
});

test('USERS/3 — par defaut, on demande les DERNIERS inscrits', () => {
  monter();

  const dernier = mockParamsRecus[mockParamsRecus.length - 1];
  expect(dernier.sort).toEqual(['createdAt:desc']);
});

test('USERS/4 — on peut demander les PLUS ANCIENS', () => {
  const arbre = monter();

  expect(appuyerSur(arbre, 'Trier par date d inscription')).toBe(true);

  const dernier = mockParamsRecus[mockParamsRecus.length - 1];
  expect(dernier.sort).toEqual(['createdAt:asc']);
});

test('USERS/5 — on peut filtrer par role', () => {
  const arbre = monter();

  expect(appuyerSur(arbre, 'Filtrer sur le role Dirigeant')).toBe(true);

  const dernier = mockParamsRecus[mockParamsRecus.length - 1];
  expect(dernier.role).toBe('dirigeant');
});

test('USERS/6 — appuyer deux fois sur le meme role retire le filtre', () => {
  const arbre = monter();

  appuyerSur(arbre, 'Filtrer sur le role Dirigeant');
  appuyerSur(arbre, 'Filtrer sur le role Dirigeant');

  const dernier = mockParamsRecus[mockParamsRecus.length - 1];
  expect(dernier.role).toBe('');
});

test('USERS/7 — la pastille « Entraineur » prend enfin sa couleur', () => {
  // Le code cherchait « entraîneur » avec un accent circonflexe ; le role
  // s appelle « entraineur » en base. La pastille restait grise depuis toujours.
  const arbre = monter();

  const pastille = arbre.root.findAll(
    (noeud) => noeud.props?.accessibilityLabel === 'Role Entraineur',
    { deep: true },
  )[0];
  expect(pastille).toBeTruthy();
  const fond = []
    .concat(pastille.props.style || [])
    .flat()
    .map((s) => s?.backgroundColor)
    .filter(Boolean);
  expect(fond.length).toBeGreaterThan(0);
  expect(fond[0]).not.toMatch(/neutral/i);
});
