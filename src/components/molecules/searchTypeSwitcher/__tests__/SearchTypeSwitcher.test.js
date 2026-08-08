import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import SearchTypeSwitcher from '../SearchTypeSwitcher';

// Filet E6 (lot D35) : ce composant EST le « dock » du pack de design, et il
// n'avait AUCUN test. Mesure faite avant d'ecrire une ligne de production :
//   · le dock du pack n'est PAS la barre d'onglets du bas — PrivateTabNavigator
//     monte 4 onglets (Search / MyEventList / MyTeamList / Chat) et ne connait
//     pas les 5 marches. Le seul appelant de ce composant est
//     SearchScreenShell, lui-meme monte par le seul SearchHubScreen ;
//   · LEAGUE n'en a pas : LeagueTabNavigator monte LeagueDashboard /
//     LeagueSquadTab / LeagueMatchTab / Chat, et views/league/search/
//     SquadSearchScreen.js n'importe ni ce dock ni son gabarit.
//
// Le filet porte sur LA LISTE des marches et LEURS CIBLES, jamais sur le rendu :
// un dock casse ne se voit pas dans un arbre monte sans son navigateur. Ce que
// ces lignes verrouillent, c'est « quels marches existent, dans quel ordre, et
// quelle cle part quand on appuie ».
//
// Deux etages : ce qui ne doit pas bouger, puis ce que D35 change. Le premier
// etage etait deja vert AVANT le lot.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

// Le VRAI theme : un Proxy rendrait les echecs illisibles, et un objet invente
// masquerait un jeton absent de la rampe.
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {
        calendar: 'image-calendar',
        flag: 'image-flag',
        shield: 'image-shield',
        stadium: 'image-stadium',
        users: 'image-users',
      },
      Spaces: espaces,
    }),
  };
});

// La feuille est doublee, pas simulee : elle rend son contenu UNIQUEMENT quand
// on la demande. C'est ce qui permet de prouver « l'appui explique au lieu
// d'activer » sans dependre de @gorhom/bottom-sheet.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, View: VueRN } = jest.requireActual('react-native');
  return function FeuilleMock(/** @type {any} */ props) {
    if (!props.isVisible) return null;
    return reactActuel.createElement(
      VueRN,
      null,
      reactActuel.createElement(TexteRN, null, 'temoin-feuille-ouverte'),
      props.children,
    );
  };
});

const MARCHES_ATTENDUS = [
  ['events', 'Événement'],
  ['clubs', 'Club'],
  ['reservations', 'Réservations'],
  ['recruitment', 'Recrutement'],
  ['amicaux', 'Matchs amicaux'],
];

// Les quatre marches reellement ouverts : eux seuls changent la categorie.
const MARCHES_OUVERTS = MARCHES_ATTENDUS.filter(([cle]) => cle !== 'reservations');

/**
 * Rend le dock.
 * @param {any} [props] Props supplementaires.
 * @returns {{ arbre: any, onTypeChange: jest.Mock }} L'arbre et l'espion.
 */
const rendre = (props = {}) => {
  const onTypeChange = jest.fn();
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      createElement(SearchTypeSwitcher, {
        activeType: 'recruitment',
        onTypeChange,
        ...props,
      }),
    );
  });
  return { arbre, onTypeChange };
};

/**
 * Les pastilles du dock, dans l'ordre du rendu, reperees par leur role d'onglet
 * — pas par la forme de l'arbre, qui change avec le design.
 * @param {any} arbre L'arbre rendu.
 * @returns {any[]} Les noeuds pressables du dock.
 */
const pastilles = (arbre) => {
  const estPastille = (/** @type {any} */ noeud) => noeud?.props?.accessibilityRole === 'tab'
    && typeof noeud.props?.onPress === 'function';

  // Une pastille se presente DEUX fois : le composant, puis la vue hote qu'il
  // rend. On ne garde que la plus exterieure — sinon le dock parait compter le
  // double, et le decompte est precisement ce que ce filet protege.
  const aUnAncetrePastille = (/** @type {any} */ noeud) => {
    for (let parent = noeud.parent; parent; parent = parent.parent) {
      if (estPastille(parent)) return true;
    }
    return false;
  };

  return arbre.root
    .findAll(estPastille, { deep: true })
    .filter((/** @type {any} */ noeud) => !aUnAncetrePastille(noeud));
};

/**
 * Tous les textes reellement affiches, dans l'ordre du rendu.
 * @param {any} arbre L'arbre rendu.
 * @returns {string[]} Les textes affiches.
 */
const textesVisibles = (arbre) => {
  /** @type {string[]} */
  const sortie = [];
  const parcourir = (/** @type {any} */ noeud) => {
    if (noeud === null || noeud === undefined || typeof noeud === 'boolean') return;
    if (typeof noeud === 'string' || typeof noeud === 'number') {
      sortie.push(String(noeud));
      return;
    }
    if (Array.isArray(noeud)) {
      noeud.forEach(parcourir);
      return;
    }
    parcourir(noeud.children);
  };
  parcourir(arbre.toJSON());
  return sortie;
};

describe('Dock des marches — CE QUI NE DOIT PAS BOUGER', () => {
  it('propose exactement 5 marches', () => {
    expect(pastilles(rendre().arbre)).toHaveLength(MARCHES_ATTENDUS.length);
  });

  it('les propose dans l ordre du pack, chacun annonce par son libelle', () => {
    const libelles = pastilles(rendre().arbre)
      .map((/** @type {any} */ noeud) => noeud.props.accessibilityLabel);
    expect(libelles).toEqual(MARCHES_ATTENDUS.map(([, libelle]) => libelle));
  });

  it.each(MARCHES_OUVERTS)('appuyer sur %s demande bien ce marche', (cle) => {
    const { arbre, onTypeChange } = rendre({ activeType: 'events' });
    const rang = MARCHES_ATTENDUS.findIndex(([candidate]) => candidate === cle);

    act(() => {
      pastilles(arbre)[rang].props.onPress();
    });

    expect(onTypeChange).toHaveBeenCalledWith(cle);
  });

  it('annonce le marche actif comme selectionne, et lui seul', () => {
    const selectionnes = pastilles(rendre({ activeType: 'amicaux' }).arbre)
      .map((/** @type {any} */ noeud) => Boolean(noeud.props.accessibilityState?.selected));
    expect(selectionnes).toEqual([false, false, false, false, true]);
  });

  it('ne demande aucun changement au simple rendu', () => {
    expect(rendre().onTypeChange).not.toHaveBeenCalled();
  });

  // Le marche non ouvert RESTE dans le dock : la case « Reservations » de
  // l'Accueil navigue encore vers lui, et SearchHubScreen sait toujours
  // l'afficher. Le retirer casserait cet appelant.
  it('garde le marche Reservations dans la liste', () => {
    const cles = pastilles(rendre().arbre)
      .map((/** @type {any} */ noeud) => noeud.props.accessibilityLabel);
    expect(cles).toContain('Réservations');
  });
});

describe('Dock des marches — CE QUE D35 CHANGE', () => {
  // Definition of done du pack : « dock (role onglet + etat) » annonce a
  // VoiceOver / TalkBack. C'etait `button` avant le lot.
  it('annonce chaque marche comme un ONGLET, dans une liste d onglets', () => {
    const { arbre } = rendre();
    expect(pastilles(arbre)).toHaveLength(MARCHES_ATTENDUS.length);
    expect(arbre.root.findAll(
      (/** @type {any} */ noeud) => noeud?.props?.accessibilityRole === 'tablist',
      { deep: true },
    ).length).toBeGreaterThan(0);
  });

  // Le coeur du geste : « le tap n'active PAS la categorie ». Une liste vide de
  // creneaux se lirait comme une panne ; la feuille dit pourquoi il n'y a rien.
  it('appuyer sur Reservations n active PAS le marche', () => {
    const { arbre, onTypeChange } = rendre({ activeType: 'events' });
    const rang = MARCHES_ATTENDUS.findIndex(([cle]) => cle === 'reservations');

    act(() => {
      pastilles(arbre)[rang].props.onPress();
    });

    expect(onTypeChange).not.toHaveBeenCalled();
  });

  it('appuyer sur Reservations ouvre la feuille « Bientot disponible ! »', () => {
    const { arbre } = rendre({ activeType: 'events' });
    const rang = MARCHES_ATTENDUS.findIndex(([cle]) => cle === 'reservations');

    expect(textesVisibles(arbre)).not.toContain('temoin-feuille-ouverte');

    act(() => {
      pastilles(arbre)[rang].props.onPress();
    });

    const affiches = textesVisibles(arbre);
    expect(affiches).toContain('temoin-feuille-ouverte');
    expect(affiches).toContain('Bientôt disponible !');
    expect(affiches).toContain('Compris');
  });

  it('« Compris » referme la feuille', () => {
    const { arbre } = rendre({ activeType: 'events' });
    const rang = MARCHES_ATTENDUS.findIndex(([cle]) => cle === 'reservations');

    act(() => {
      pastilles(arbre)[rang].props.onPress();
    });

    const compris = arbre.root.find((/** @type {any} */ noeud) => (
      noeud?.props?.accessibilityRole === 'button'
      && typeof noeud.props?.onPress === 'function'
      && typeof noeud.type !== 'string'
    ));

    act(() => {
      compris.props.onPress();
    });

    expect(textesVisibles(arbre)).not.toContain('temoin-feuille-ouverte');
  });
});
