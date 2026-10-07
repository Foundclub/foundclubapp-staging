import renderer, { act } from 'react-test-renderer';

import ChatAttachmentActionIcon from '../ChatAttachmentActionIcon';

// E6 (MESSAGERIE-1C) — LE JEU D'ICONES DE LA FEUILLE « + » DU FIL, caracterise AVANT d'y ajouter
// l'entree « Convocation ». Ce fichier n'avait aucun temoin : un cas de plus dans son `switch`
// ne doit rien deplacer des 7 autres, ni le repli d'une clef inconnue (un cercle).

/**
 * Les noeuds dessines pour une clef : le type et les attributs de forme, rien d'autre.
 * @param {string} actionKey
 * @returns {Array<{ type: string, d?: string, r?: string }>}
 */
const dessin = (actionKey) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<ChatAttachmentActionIcon actionKey={actionKey} color="#01b3f4" />);
  });
  const noeuds = arbre.root.findAll((/** @type {any} */ n) => typeof n.type === 'string'
    || (n.type && typeof n.type === 'object'))
    .filter((/** @type {any} */ n) => n.props && (n.props.d || n.props.r || n.props.points
      || n.props.x1 || n.props.width === '16' || n.props.rx));
  const rendu = noeuds.map((/** @type {any} */ n) => ({
    d: n.props.d, points: n.props.points, r: n.props.r,
  }));
  act(() => { arbre.unmount(); });
  return rendu;
};

const REPLI = [{ d: undefined, points: undefined, r: '7.2' }];

describe('E6 · les icones de la feuille « + »', () => {
  test.each(['camera', 'contact', 'document', 'event', 'location', 'photos', 'poll'])(
    'la clef %s a son propre dessin (pas le cercle de repli)',
    (cle) => {
      const rendu = dessin(cle);
      expect(rendu.length).toBeGreaterThan(0);
      expect(rendu).not.toEqual(REPLI);
    },
  );

  test('une clef inconnue retombe sur un cercle', () => {
    expect(dessin('inconnue')).toEqual(REPLI);
  });

  test('MESSAGERIE-1C : « convocation » dessine le presse-papiers du pack (ClipboardUser)', () => {
    const rendu = dessin('convocation');
    expect(rendu).not.toEqual(REPLI);
    expect(rendu).toHaveLength(1);
    expect(String(rendu[0].d)).toMatch(/^M 8 7 L 7 7 /);
  });
});
