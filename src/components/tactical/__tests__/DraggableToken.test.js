import { Image } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import DraggableToken from '../DraggableToken';

// C-F — FILET DE DEMENAGEMENT (E6).
//
// `DraggableToken` vivait dans `views/tactical_v2/` et n'avait AUCUN test, alors
// que c'est une piece PARTAGEE : le nouveau terrain de composition s'en sert
// (`matchCallUp/MatchCompositionBoard.js`) et la compo type d'une equipe aussi
// (`team/composition/TeamCompoTemplateScreen.js`). Le sortir du dossier
// condamne sans filet, c'etait parier que ses branches ne servaient a personne.
//
// ⚠️ CE FICHIER NE JUGE RIEN : il DECRIT le comportement du jour du
// demenagement, pour qu'un ecart apparaisse. Ses temoins sont les 4 decisions
// que le jeton prend seul, et qu'aucun appelant ne peut rattraper :
//   1. les INITIALES et leur repli ;
//   2. un joueur ajoute A LA MAIN n'affiche JAMAIS de photo ;
//   3. les 3 formes d'avatar que le serveur peut envoyer ;
//   4. les 3 apparences — banc, terrain, fantome — et ce qui les distingue.

jest.mock('@/utils/imageUrl', () => ({
  getImageUrl: (/** @type {any} */ url) => url || undefined,
}));

jest.mock('react-native-reanimated', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View: VueRN },
    useAnimatedStyle: () => ({}),
  };
});

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({ Colors: couleurs }),
  };
});

const collecterTextes = (/** @type {any} */ noeud, /** @type {string[]} */ acc = []) => {
  if (noeud === null || noeud === undefined) return acc;
  if (typeof noeud === 'string') {
    acc.push(noeud);
    return acc;
  }
  if (Array.isArray(noeud)) {
    noeud.forEach((enfant) => collecterTextes(enfant, acc));
    return acc;
  }
  collecterTextes(noeud.children, acc);
  return acc;
};

const rendre = (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    arbre = renderer.create(<DraggableToken {...props} />);
  });
  return arbre;
};

const textesDe = (/** @type {any} */ arbre) => collecterTextes(arbre.toJSON());
const urlsDe = (/** @type {any} */ arbre) => arbre.root
  .findAllByType(Image)
  .map((/** @type {any} */ noeud) => noeud.props.source?.uri);

const JOUEUR = { firstname: 'Jean', id: 'p1', lastname: 'Dupont' };

describe('DraggableToken — les initiales, et leur repli', () => {
  it('sans photo : rend les initiales du prenom et du nom, en majuscules', () => {
    expect(textesDe(rendre({ player: JOUEUR }))).toContain('JD');
  });

  it('un seul nom renseigne : une seule initiale, pas de trou', () => {
    expect(textesDe(rendre({ player: { firstname: 'Jean' } }))).toContain('J');
  });

  it('aucun nom : le repli est « ? », jamais une chaine vide', () => {
    expect(textesDe(rendre({ player: {} }))).toContain('?');
  });

  it('joueur absent : ne plante pas, et rend le repli', () => {
    expect(textesDe(rendre({ player: null }))).toContain('?');
  });
});

describe("DraggableToken — un joueur ajoute A LA MAIN n'a jamais de photo", () => {
  it('isManual : meme avec un avatar, aucune image n est rendue', () => {
    const arbre = rendre({ player: { ...JOUEUR, avatar: '/photo.jpg', isManual: true } });
    expect(urlsDe(arbre)).toHaveLength(0);
    expect(textesDe(arbre)).toContain('JD');
  });

  it('identifiant prefixe « manual_ » : meme regle, sans le drapeau isManual', () => {
    const arbre = rendre({ player: { ...JOUEUR, avatar: '/photo.jpg', id: 'manual_7' } });
    expect(urlsDe(arbre)).toHaveLength(0);
  });
});

describe('DraggableToken — les 3 formes d avatar que le serveur envoie', () => {
  it('avatar en chaine de caracteres', () => {
    const arbre = rendre({ player: { ...JOUEUR, avatar: '/direct.jpg' } });
    expect(urlsDe(arbre)).toEqual(['/direct.jpg']);
  });

  it('avatar en objet, champ `url`', () => {
    const arbre = rendre({ player: { ...JOUEUR, avatar: { url: '/objet.jpg' } } });
    expect(urlsDe(arbre)).toEqual(['/objet.jpg']);
  });

  it('avatar en objet, vignette `formats.thumbnail.url`', () => {
    const player = { ...JOUEUR, avatar: { formats: { thumbnail: { url: '/vignette.jpg' } } } };
    expect(urlsDe(rendre({ player }))).toEqual(['/vignette.jpg']);
  });

  it('avatar absent : aucune image, on retombe sur les initiales', () => {
    const arbre = rendre({ player: JOUEUR });
    expect(urlsDe(arbre)).toHaveLength(0);
    expect(textesDe(arbre)).toContain('JD');
  });
});

describe('DraggableToken — les 3 apparences', () => {
  it('banc (defaut) : prenom ET nom, et le numero quand il existe', () => {
    const textes = textesDe(rendre({ player: { ...JOUEUR, number: 10 } }));
    expect(textes).toContain('Jean');
    expect(textes).toContain('Dupont');
    // Le dossard traverse l'arbre en TEXTE, jamais en nombre.
    expect(textes).toContain('10');
  });

  it('banc sans numero : aucun dossard affiche', () => {
    expect(textesDe(rendre({ player: JOUEUR }))).not.toContain('10');
  });

  it('terrain : le prenom seul — le nom de famille ne descend pas sur le terrain', () => {
    const textes = textesDe(rendre({ isOnField: true, player: JOUEUR }));
    expect(textes).toContain('Jean');
    expect(textes).not.toContain('Dupont');
  });

  it('terrain : le dossard est rendu quand le joueur en a un', () => {
    expect(textesDe(rendre({ isOnField: true, player: { ...JOUEUR, number: 7 } }))).toContain('7');
  });

  it('fantome (isGhost) : le prenom, et il ne capte AUCUN toucher (il suit le doigt)', () => {
    const arbre = rendre({ isGhost: true, player: JOUEUR });
    expect(textesDe(arbre)).toContain('Jean');
    expect(arbre.toJSON().props.pointerEvents).toBe('none');
  });

  it('banc et terrain, eux, captent les touchers : le fantome est le seul inerte', () => {
    expect(rendre({ player: JOUEUR }).toJSON().props.pointerEvents).toBeUndefined();
    const terrain = rendre({ isOnField: true, player: JOUEUR });
    expect(terrain.toJSON().props.pointerEvents).toBeUndefined();
  });
});
