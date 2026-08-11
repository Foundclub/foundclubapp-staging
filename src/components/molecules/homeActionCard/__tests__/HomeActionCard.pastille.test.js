import { Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { colors } from '@/theme/colors';

import HomeActionCard from '../HomeActionCard';

// D72 — LA PASTILLE D'ATTENTE (pack accueil, tache 1 + critere de recette 7).
//
// Deux choses a prouver, et la SECONDE est la plus importante :
//   1. `hasAlert` pose un point ROUGE, et `badgeCount` une pilule chiffree ;
//   2. sans ces deux proprietes, la carte est EXACTEMENT celle d'avant le lot.
// La carte est utilisee par tout l'accueil (jusqu'a 20 fois par ecran) : une
// regression ici se voit partout a la fois.
//
// 🎨 Le theme est monte avec les VRAIES couleurs (`requireActual`) et non un
// Proxy qui rend « couleur-error500 ». C'est ce qui permet d'affirmer « le rouge
// exact du pack » plutot que « une couleur » : la regle porte sur la VALEUR.
// `theme/colors.js` n'importe rien : le charger pour de vrai est sans risque.

jest.mock('@/theme/themeContext', () => {
  const { colors: vraiesCouleurs } = jest.requireActual('@/theme/colors');
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: vraiesCouleurs,
      Fonts: makeRamp(),
      Images: new Proxy({}, { get: (/** @type {any} */ _t, /** @type {any} */ k) => `image-${String(k)}` }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

// Le rouge du pack EST le jeton `error-500` (le pack le dit lui-meme). On le lit
// donc dans le theme plutot que de le recopier : un litteral hexadecimal
// dans un test fait regresser `verify:theme-contract`, qui scanne AUSSI les tests.
const ROUGE_DU_PACK = colors.error500;

/**
 * @param {any} props
 * @returns {Promise<any>}
 */
const monter = async (props = {}) => {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <HomeActionCard
        onPress={jest.fn()}
        subtitle="Traite les demandes de ton organisation"
        title="Demandes"
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...props}
      />,
    );
  });
  return tree;
};

/**
 * Les vues qui ressemblent a la pastille : un carre absolu de 10 de cote.
 * @param {any} tree
 * @returns {any[]}
 */
const pastilles = (tree) => tree.root.findAllByType(View).filter(
  (/** @type {any} */ node) => node.props?.style?.position === 'absolute'
    && node.props.style?.height === 10
    && node.props.style?.width === 10,
);

describe('D72 — la pastille rouge d une action en attente', () => {
  it('LE TEMOIN : `hasAlert` pose un point du rouge d alerte sur le glyphe', async () => {
    const tree = await monter({ hasAlert: true });
    const trouvees = pastilles(tree);

    expect(trouvees).toHaveLength(1);
    expect(trouvees[0].props.style.backgroundColor).toBe(ROUGE_DU_PACK);
  });

  it('elle est collee en haut a droite du glyphe, et cerclee du fond de la carte', async () => {
    const [pastille] = pastilles(await monter({ hasAlert: true }));
    const {
      borderColor, borderWidth, right, top,
    } = pastille.props.style;

    expect({ right, top }).toEqual({ right: -5, top: -3 });
    // Le pack demande « la couleur de fond de la carte » : c'est primary700,
    // le jeton dont la carte tire deja son fond (`${Colors.primary700}59`).
    // ⚠️ Le pack ecrivait un opaque equivalent qui n'est AUCUN jeton du theme.
    expect(borderColor).toBe(colors.primary700);
    expect(borderWidth).toBe(1.5);
  });

  it('ZERO en attente = AUCUNE pastille (critere de recette 3)', async () => {
    expect(pastilles(await monter({ hasAlert: false }))).toHaveLength(0);
    expect(pastilles(await monter({}))).toHaveLength(0);
  });

  it('la pastille ne parle pas aux lecteurs d ecran : elle double le titre', async () => {
    const [pastille] = pastilles(await monter({ hasAlert: true }));

    expect(pastille.props.importantForAccessibility).toBe('no');
  });
});

describe('D72 — la pilule chiffree (carte « A traiter » du super admin)', () => {
  /**
   * @param {any} tree
   * @returns {string[]}
   */
  const textes = (tree) => tree.root.findAllByType(Text).map(
    (/** @type {any} */ node) => node.props.children,
  ).filter((/** @type {any} */ valeur) => typeof valeur === 'string');

  it('affiche le nombre tel quel jusqu a 9', async () => {
    expect(textes(await monter({ badgeCount: 3 }))).toContain('3');
    expect(textes(await monter({ badgeCount: 9 }))).toContain('9');
  });

  // ⚠️ CONTRADICTION DU PACK, ASSUMEE ICI : son TEXTE dit « 9+ au-dela de 9 »,
  // sa capture 04 montre « 14 ». C'est le texte qui fait foi (il est explicite),
  // et ce test est l'endroit ou basculer si Adel tranche l'inverse — une ligne.
  it('s arrete a « 9+ » au-dela de 9, comme le TEXTE du pack le demande', async () => {
    const rendus = textes(await monter({ badgeCount: 14 }));

    expect(rendus).toContain('9+');
    expect(rendus).not.toContain('14');
  });

  it('a zero ou absente, aucune pilule n est rendue', async () => {
    expect(textes(await monter({ badgeCount: 0 }))).not.toContain('0');
    expect(textes(await monter({}))).toEqual(['Demandes', 'Traite les demandes de ton organisation']);
  });
});

// CRITERE DE RECETTE 7 — le vrai filet du lot. `HomeActionCard` est appelee par
// toutes les sections de l'accueil ET par d'autres ecrans : les deux proprietes
// doivent etre INERTES quand personne ne les passe.
describe('D72 — non-regression : les deux proprietes sont facultatives', () => {
  it('sans elles, l arbre rendu est IDENTIQUE a celui des valeurs neutres', async () => {
    const sansRien = await monter({});
    const neutre = await monter({ badgeCount: 0, hasAlert: false });

    expect(JSON.stringify(sansRien.toJSON())).toBe(JSON.stringify(neutre.toJSON()));
  });

  it('sans elles, la carte ne contient AUCUN element rouge', async () => {
    const rendu = JSON.stringify((await monter({})).toJSON());

    expect(rendu).not.toContain(ROUGE_DU_PACK);
  });
});
