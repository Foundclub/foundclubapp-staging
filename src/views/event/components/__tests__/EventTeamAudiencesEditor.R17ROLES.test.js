import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import EventTeamAudiencesEditor from '../EventTeamAudiencesEditor';

// R17-ROLES (REC17-006) — le role sous le nom d'un membre passe par la table
// partagee (`libelleDuRole`), jamais par le nom technique du serveur.
//
// Le geste reel : « Ajouter » ouvre la feuille, on choisit l'equipe interne,
// on passe l'onglet de selection sur « Choisis » : la liste a cocher apparait.
// Avant le lot, la ligne grise montrait `role.name` brut (« Entraineur »).

// Le premier montage charge toute la chaine des composants : 5,1 s mesurees
// (19/10), au-dela des 5 s par defaut de Jest.
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

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL` et
// la suite entiere meurt au chargement (0 test execute).
jest.mock('@/services/club/clubService', () => ({
  getClubs: jest.fn(() => Promise.resolve({ data: [] })),
}));
jest.mock('@/services/team/teamService', () => ({
  getTeams: jest.fn(() => Promise.resolve({ data: [] })),
}));

// La feuille du bas rend son contenu des qu'elle est visible, sans @gorhom.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function FeuilleMock(
  /** @type {any} */ props,
) {
  return props.isVisible ? props.children : null;
});

// Publie en TypeScript non transforme (gesture-handler) : sans doublure, la
// suite meurt a l'import. La doublure garde ses props : le temoin appelle son
// `onChange` comme le ferait un appui sur l'onglet.
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return function OngletsMock() {
    return reactActuel.createElement(VueRN, { testID: 'doublure-onglets' });
  };
});

/** L'equipe interne a inviter : un membre par famille de role a traduire. */
const EQUIPE_INVITEE = {
  documentId: 'equipe-2',
  name: 'U17 B',
  players: [
    {
      documentId: 'membre-joueur',
      firstname: 'Sofiane',
      lastname: 'Amrani',
      role: { name: 'Joueur' },
    },
    {
      documentId: 'membre-technique',
      firstname: 'Noe',
      lastname: 'Girard',
      role: { name: 'Authenticated' },
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
 * Monte l'editeur comme EventEdit, puis fait les trois gestes qui ouvrent la
 * liste a cocher.
 * @returns {Promise<any>} L'arbre rendu, liste a cocher ouverte.
 */
const ouvrirLaListeACocher = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(createElement(EventTeamAudiencesEditor, {
      availableTeams: [EQUIPE_INVITEE],
      clubId: 'club-1',
      currentTeamId: 'equipe-1',
      editable: true,
      onChange: () => {},
      value: [],
    }));
  });

  await act(async () => { pressablePortant(arbre, 'Ajouter').props.onPress(); });
  await act(async () => { pressablePortant(arbre, 'U17 B').props.onPress(); });

  const ongletSelection = arbre.root.find((/** @type {any} */ noeud) => (
    typeof noeud.props?.onChange === 'function'
    && Array.isArray(noeud.props?.options)
    && noeud.props.options.some(
      (/** @type {any} */ option) => option.value === 'SELECTED_MEMBERS',
    )
  ));
  await act(async () => { ongletSelection.props.onChange('SELECTED_MEMBERS'); });

  return arbre;
};

describe('R17-ROLES — le role sous le nom, dans la liste a cocher de l editeur', () => {
  test('la liste a cocher est ouverte, avec les trois membres', async () => {
    const arbre = await ouvrirLaListeACocher();
    const textes = textesSous(arbre.root);

    expect(textes).toContain('Membres sélectionnés');
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
