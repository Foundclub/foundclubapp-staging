import { SvgXml } from 'react-native-svg';
import renderer, { act } from 'react-test-renderer';

import TrainingBlocks, {
  splitBold,
  TrainingLinks,
} from '@/components/organisms/training/TrainingBlocks';

/**
 * LE RENDU DU CONTENU D'UNE FICHE.
 *
 * 🔎 CE QUE CES TEMOINS PROTEGENT : le contenu vient du serveur, ecrit par un
 * administrateur. Un bloc mal forme ne doit JAMAIS faire tomber l'ecran d'un
 * athlete au milieu d'un test — au pire il ne s'affiche pas. Et les tableaux,
 * qui portent les chronologies minutees et les distances au centimetre, doivent
 * rendre TOUTES leurs cellules : une colonne perdue, c'est une distance perdue.
 *
 * Le theme est le VRAI theme, pas un objet bricole : un jeton de couleur absent
 * tombe au rouge ici plutot qu'a l'ecran.
 */

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({ Colors, Fonts: genererPolices(Colors), Spaces }),
  };
});

/**
 * Monte des blocs et rend l'arbre de test.
 * @param {any} blocks les blocs typés à rendre
 * @returns {any} l'arbre react-test-renderer
 */
const rendre = (blocks) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<TrainingBlocks blocks={blocks} />); });
  return arbre;
};

/**
 * Tout le texte affiché par un arbre, mis à plat.
 * @param {any} arbre l'arbre rendu
 * @returns {string[]} les chaînes réellement rendues, dans l'ordre
 */
const textes = (arbre) => {
  /** @type {string[]} */
  const sortie = [];
  /**
   * Descend dans un noeud rendu et empile chaque chaine rencontree.
   * @param {any} noeud un noeud de l'arbre rendu
   * @returns {void} rien : la sortie est empilee dans `sortie`
   */
  const parcourir = (noeud) => {
    if (typeof noeud === 'string') { sortie.push(noeud); return; }
    if (Array.isArray(noeud)) { noeud.forEach(parcourir); return; }
    if (noeud && noeud.children) noeud.children.forEach(parcourir);
  };
  parcourir(arbre.toJSON());
  return sortie;
};

/**
 * Le nombre de cellules de chaque rangee d'un tableau rendu.
 * @param {any} arbre l'arbre rendu
 * @returns {number[]} une entree par rangee, en-tete compris
 */
const rangees = (arbre) => {
  /** @type {number[]} */
  const sortie = [];
  /**
   * Descend dans un noeud rendu et empile la largeur de chaque rangee.
   * @param {any} noeud un noeud de l'arbre rendu
   * @returns {void} rien : la sortie est empilee dans `sortie`
   */
  const parcourir = (noeud) => {
    if (!noeud || typeof noeud !== 'object') return;
    if (Array.isArray(noeud)) { noeud.forEach(parcourir); return; }
    const style = Array.isArray(noeud.props?.style) ? noeud.props.style[0] : noeud.props?.style;
    if (style?.flexDirection === 'row') sortie.push((noeud.children || []).length);
    (noeud.children || []).forEach(parcourir);
  };
  parcourir(arbre.toJSON());
  return sortie;
};

describe('le gras dans un texte', () => {
  it('decoupe autour des doubles asterisques', () => {
    const segments = splitBold('Le talon **reste au sol**, sinon essai nul');

    expect(segments.map((s) => s.value))
      .toEqual(['Le talon ', 'reste au sol', ', sinon essai nul']);
    expect(segments.map((s) => s.bold)).toEqual([false, true, false]);
  });

  it('laisse un texte sans marqueur intact', () => {
    expect(splitBold('trois essais').map((s) => s.value)).toEqual(['trois essais']);
  });

  it('accepte un texte vide sans casser', () => {
    expect(splitBold(undefined).map((s) => s.value)).toEqual(['']);
  });
});

describe('le rendu des blocs', () => {
  it('affiche un paragraphe, gras compris', () => {
    const arbre = rendre([{ text: 'Trois essais **valides**.', type: 'p' }]);

    expect(textes(arbre).join('')).toContain('Trois essais valides.');
  });

  it('affiche toutes les puces d une liste', () => {
    const arbre = rendre([{ items: ['talon decolle', 'genou hors du ruban'], type: 'ul' }]);
    const rendu = textes(arbre).join(' ');

    expect(rendu).toContain('talon decolle');
    expect(rendu).toContain('genou hors du ruban');
    expect(textes(arbre).filter((t) => t === '•')).toHaveLength(2);
  });

  it('numerote une liste ordonnee', () => {
    const rendu = textes(rendre([{ items: ['se placer', 'sauter'], type: 'ol' }]));

    expect(rendu).toContain('1.');
    expect(rendu).toContain('2.');
  });

  it('rend TOUTES les cellules d un tableau, en-tetes compris', () => {
    const arbre = rendre([{
      head: ['Heure', 'Bloc', 'Duree'],
      rows: [['T+0', 'Echauffement', '18 min'], ['T+20', 'Controle', '4 min']],
      type: 'table',
    }]);
    const rendu = textes(arbre).join(' ');

    ['Heure', 'Bloc', 'Duree', 'T+0', 'Echauffement', '18 min', 'T+20', 'Controle', '4 min']
      .forEach((cellule) => expect(rendu).toContain(cellule));
  });

  it('complete une ligne plus courte que l en-tete au lieu de decaler les colonnes', () => {
    const arbre = rendre([{
      head: ['Essai', 'Gauche', 'Droite'],
      rows: [['1', '31.4']],
      type: 'table',
    }]);

    // 3 colonnes d'en-tete ⇒ 3 cellules de corps, la troisieme VIDE. Sans ce
    // rembourrage, « 31.4 » glisserait sous « Gauche » alors qu'il est a droite.
    const lignes = rangees(arbre);

    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toBe(3);
    expect(lignes[1]).toBe(3);
  });

  it('affiche une note avec son texte', () => {
    const arbre = rendre([{
      text: 'Reporter si le sommeil est court.', tone: 'warn', type: 'note',
    }]);

    expect(textes(arbre).join(' ')).toContain('Reporter si le sommeil est court.');
  });

  it('affiche un schema et sa legende', () => {
    const arbre = rendre([{
      caption: 'Vue de dessus, cotes en metres',
      svg: '<svg viewBox="0 0 10 10"></svg>',
      type: 'svg',
    }]);

    expect(arbre.root.findAllByType(SvgXml)).toHaveLength(1);
    expect(textes(arbre).join(' ')).toContain('Vue de dessus');
  });
});

describe('ce qui ne doit jamais faire tomber l ecran', () => {
  it('ignore un bloc sans type', () => {
    expect(() => rendre([{ text: 'orphelin' }])).not.toThrow();
    expect(textes(rendre([{ text: 'orphelin' }]))).toEqual([]);
  });

  it('ignore un type inconnu venu du serveur', () => {
    expect(() => rendre([{ type: 'video-360' }])).not.toThrow();
  });

  it('ignore un schema qui n est pas du SVG', () => {
    const arbre = rendre([{ caption: 'legende', svg: 'rm -rf /', type: 'svg' }]);

    expect(arbre.root.findAllByType(SvgXml)).toHaveLength(0);
    expect(textes(arbre).join(' ')).not.toContain('legende');
  });

  it('accepte une liste de blocs absente', () => {
    expect(() => rendre(undefined)).not.toThrow();
    expect(rendre(undefined).toJSON()).toBeNull();
  });

  it('accepte un tableau sans en-tete', () => {
    expect(textes(rendre([{ rows: [['seule cellule']], type: 'table' }])).join(' '))
      .toContain('seule cellule');
  });
});

describe('les liens « pour voir le geste »', () => {
  /**
   * Monte la liste de liens et rend l'arbre de test.
   * @param {any} links les liens venus du serveur
   * @returns {any} l'arbre react-test-renderer
   */
  const rendreLiens = (links) => {
    /** @type {any} */
    let arbre;
    act(() => { arbre = renderer.create(<TrainingLinks links={links} />); });
    return arbre;
  };

  it('affiche le titre du lien, pas son adresse', () => {
    const rendu = textes(rendreLiens([
      { titre: 'Le geste en video', url: 'https://exemple.test/a' },
    ]));

    expect(rendu).toContain('Le geste en video');
    expect(rendu).not.toContain('https://exemple.test/a');
  });

  it('REFUSE tout ce qui n est pas http(s) — le contenu vient du serveur', () => {
    const arbre = rendreLiens([
      // Assemble en deux morceaux : la regle `no-script-url` interdit le litteral,
      // or c'est precisement l'adresse que ce temoin doit voir refusee.
      { titre: 'piege', url: `java${'script'}:alert(1)` },
      { titre: 'fichier', url: 'file:///etc/passwd' },
      { titre: 'bon', url: 'https://exemple.test/ok' },
    ]);
    const rendu = textes(arbre);

    expect(rendu).toEqual(['bon']);
  });

  it('ne rend rien quand aucun lien n est utilisable', () => {
    expect(rendreLiens([]).toJSON()).toBeNull();
    expect(rendreLiens(undefined).toJSON()).toBeNull();
  });
});
