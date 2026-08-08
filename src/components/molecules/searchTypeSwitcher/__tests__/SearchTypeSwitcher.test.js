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
      Images: {},
      Spaces: espaces,
    }),
  };
});

const MARCHES_ATTENDUS = [
  ['events', 'Événement'],
  ['clubs', 'Club'],
  ['reservations', 'Réservations'],
  ['recruitment', 'Recrutement'],
  ['amicaux', 'Matchs amicaux'],
];

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
 * Les pastilles du dock, dans l'ordre du rendu, reperees par leur role de
 * bouton — pas par la forme de l'arbre, qui change avec le design.
 * @param {any} arbre L'arbre rendu.
 * @returns {any[]} Les noeuds pressables.
 */
const pastilles = (arbre) => {
  const estPressable = (/** @type {any} */ noeud) => noeud?.props?.accessibilityRole === 'button'
    && typeof noeud.props?.onPress === 'function';

  // Un pressable se presente DEUX fois : le composant, puis la vue hote qu'il
  // rend. On ne garde que le plus exterieur — sinon le dock parait compter le
  // double, et le decompte est precisement ce que ce filet protege.
  const aUnAncetrePressable = (/** @type {any} */ noeud) => {
    for (let parent = noeud.parent; parent; parent = parent.parent) {
      if (estPressable(parent)) return true;
    }
    return false;
  };

  return arbre.root
    .findAll(estPressable, { deep: true })
    .filter((/** @type {any} */ noeud) => !aUnAncetrePressable(noeud));
};

describe('Dock des marches — LA LISTE ET LES CIBLES', () => {
  it('propose exactement 5 marches', () => {
    expect(pastilles(rendre().arbre)).toHaveLength(MARCHES_ATTENDUS.length);
  });

  it('les propose dans l ordre du pack, chacun annonce par son libelle', () => {
    const libelles = pastilles(rendre().arbre)
      .map((/** @type {any} */ noeud) => noeud.props.accessibilityLabel);
    expect(libelles).toEqual(MARCHES_ATTENDUS.map(([, libelle]) => libelle));
  });

  it.each(MARCHES_ATTENDUS)('appuyer sur %s demande bien ce marche', (cle) => {
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
});
