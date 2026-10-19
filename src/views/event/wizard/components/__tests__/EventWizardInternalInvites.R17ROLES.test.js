import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider } from '../../EventWizardContext';
import EventWizardInternalInvites from '../EventWizardInternalInvites';

// R17-ROLES (REC17-006) — le role sous le nom d'un membre passe par la table
// partagee (`libelleDuRole`), jamais par le nom technique du serveur.
//
// Le geste reel : l'etape « Participants » charge les equipes du club, on
// appuie sur la carte d'une equipe, la feuille s'ouvre ; « Choisir certains
// membres » montre la liste a cocher. Avant le lot, la ligne grise montrait
// `role.name` brut (« Entraineur »), et « Membre » seulement sans role.

// Le premier montage charge toute la chaine des composants : plus de 5 s
// mesurees sur l'editeur voisin (19/10), au-dela des 5 s par defaut de Jest.
jest.setTimeout(30000);

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
      let modele = cle;
      if (typeof repli === 'string') modele = repli;
      else if (repli && typeof repli.defaultValue === 'string') modele = repli.defaultValue;

      const valeurs = (repli && typeof repli === 'object') ? repli : options;
      if (!valeurs) return modele;

      return String(modele).replace(
        /\{\{(\w+)\}\}/g,
        (/** @type {string} */ trouve, /** @type {string} */ nom) => (
          valeurs[nom] === undefined ? trouve : String(valeurs[nom])
        ),
      );
    },
  }),
}));

// Le VRAI theme, sans le contexte React qui le porte. ⛔ Jamais un Proxy pour
// les jetons lus : il rend les echecs Jest illisibles.
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
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces: espaces,
    }),
  };
});

// L'organisateur, rattache au club dont on charge les equipes.
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    userData: {
      club: { documentId: 'club-1' },
      documentId: 'moi',
      trainedTeams: [],
    },
  }),
}));

/** L'equipe de mon club a inviter : un membre par famille de role a traduire. */
const mockEquipeDuClub = {
  club: { documentId: 'club-1', name: 'FC Test' },
  documentId: 'equipe-2',
  members: [
    {
      documentId: 'membre-technique',
      firstname: 'Noe',
      lastname: 'Girard',
      role: { name: 'Authenticated' },
    },
  ],
  name: 'U17 B',
  players: [
    {
      documentId: 'membre-joueur',
      firstname: 'Sofiane',
      lastname: 'Amrani',
      role: { name: 'Joueur' },
    },
  ],
  trainers: [
    {
      documentId: 'membre-coach',
      firstname: 'Paul',
      lastname: 'Renard',
      role: { name: 'Entraineur' },
    },
  ],
};

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL` et
// la suite entiere meurt au chargement (0 test execute).
jest.mock('@/services/team/teamService', () => ({
  getTeams: jest.fn(() => Promise.resolve({ data: [mockEquipeDuClub] })),
}));

// La feuille du bas rend son contenu des qu'elle est visible, sans @gorhom.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function FeuilleMock(
  /** @type {any} */ props,
) {
  return props.isVisible ? props.children : null;
});

/** Ce que la ligne grise doit dire sous chaque nom. */
const LIBELLES_ATTENDUS = [
  ['Paul Renard', 'Coach / Prof'],
  ['Sofiane Amrani', 'Pratiquant / Joueur'],
  ['Noe Girard', 'Membre'],
];

/**
 * Tous les textes rendus sous un noeud de l'arbre de test, dans l'ordre.
 * @param {any} noeud Le noeud a parcourir.
 * @returns {string[]} Les textes trouves.
 */
const textesSous = (noeud) => {
  /** @type {string[]} */
  const sortie = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      sortie.push(String(enfant));
      return;
    }
    if (Array.isArray(enfant)) {
      enfant.forEach(parcourir);
      return;
    }
    if (enfant?.children) enfant.children.forEach(parcourir);
  };
  parcourir(noeud.children);
  return sortie;
};

/**
 * Le premier pressable (le plus exterieur) qui porte ce texte.
 * @param {any} arbre L'arbre rendu.
 * @param {string} libelle Le texte a viser.
 * @returns {any} Le noeud pressable.
 */
const pressablePortant = (arbre, libelle) => {
  const pressables = arbre.root.findAll(
    (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function',
    { deep: true },
  );
  const cible = pressables.find(
    (/** @type {any} */ noeud) => textesSous(noeud).includes(libelle),
  );
  if (!cible) {
    const vus = pressables
      .map((/** @type {any} */ noeud) => textesSous(noeud).join('|'))
      .filter(Boolean);
    throw new Error(
      `aucun pressable ne porte le texte « ${libelle} ». Pressables vus : ${JSON.stringify(vus)}`,
    );
  }
  return cible;
};

/**
 * Monte la section dans le VRAI tunnel, laisse `getTeams` repondre, puis fait
 * les deux gestes qui ouvrent la liste a cocher.
 * @returns {Promise<any>} L'arbre rendu, liste a cocher ouverte.
 */
const ouvrirLaListeACocher = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(createElement(
      EventWizardProvider,
      null,
      createElement(EventWizardInternalInvites, { surfaceStyle: null }),
    ));
  });
  // La section appelle `getTeams` dans un effet : on laisse la promesse rendre.
  await act(async () => { await Promise.resolve(); });

  await act(async () => { pressablePortant(arbre, 'U17 B').props.onPress(); });
  // Une equipe pas encore invitee ouvre deja en « certains membres » ; l'appui
  // garde le temoin vrai si ce defaut change.
  await act(async () => {
    pressablePortant(arbre, 'Choisir certains membres').props.onPress();
  });

  return arbre;
};

describe('R17-ROLES — le role sous le nom, dans la liste a cocher du tunnel', () => {
  test('la liste a cocher est ouverte, avec les trois membres', async () => {
    const arbre = await ouvrirLaListeACocher();
    const textes = textesSous(arbre.root);

    expect(textes).toContain('Sélectionne les membres à inviter');
    LIBELLES_ATTENDUS.forEach(([nom]) => expect(textes).toContain(nom));
  });

  test.each(LIBELLES_ATTENDUS)('sous « %s », la ligne grise dit « %s »', async (nom, libelle) => {
    const arbre = await ouvrirLaListeACocher();
    const textesDeLaLigne = textesSous(pressablePortant(arbre, nom));

    expect(textesDeLaLigne[textesDeLaLigne.indexOf(nom) + 1]).toBe(libelle);
  });

  test('aucun nom technique du serveur n est affiche', async () => {
    const arbre = await ouvrirLaListeACocher();
    const textes = textesSous(arbre.root);

    expect(textes.filter((texte) => texte.includes('Entraineur'))).toEqual([]);
    expect(textes.filter((texte) => texte.includes('Authenticated'))).toEqual([]);
  });
});
