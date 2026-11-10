// COMPLEXE-TERRAINS (7) — choisir PLUSIEURS photos à la fois sur le site : `selectionLimit` > 1
// ouvre un choix multiple et rend `{ assets: [...] }` (la forme du téléphone), coupé à la limite.
// Sans l'option, rien ne change : un seul fichier, rendu tel quel.
import { pickImage } from '../media.web';

/**
 * Un faux champ « fichier » du navigateur.
 * @param {any[]} fichiers - Ce que le gérant choisit.
 * @returns {{ champ: any, choisir: () => void }} Le champ et le geste.
 */
const fauxChamp = (fichiers) => {
  /** @type {Record<string, () => void>} */
  const ecouteurs = {};
  const champ = {
    addEventListener: (/** @type {string} */ nom, /** @type {() => void} */ f) => {
      ecouteurs[nom] = f;
    },
    click: () => {},
    files: fichiers,
    multiple: false,
  };
  return { champ, choisir: () => ecouteurs.change() };
};

describe('media.web — plusieurs photos', () => {
  afterEach(() => { delete global.document; });

  test('selectionLimit 3, quatre fichiers choisis : choix multiple, trois rendus', async () => {
    const { champ, choisir } = fauxChamp(['a', 'b', 'c', 'd']);
    global.document = { createElement: () => champ };
    const choix = pickImage({ selectionLimit: 3 });
    choisir();
    expect(champ.multiple).toBe(true);
    await expect(choix).resolves.toEqual({ assets: ['a', 'b', 'c'] });
  });

  test('sans option : un seul fichier, rendu tel quel (contrat inchangé)', async () => {
    const { champ, choisir } = fauxChamp(['a', 'b']);
    global.document = { createElement: () => champ };
    const choix = pickImage();
    choisir();
    expect(champ.multiple).toBe(false);
    await expect(choix).resolves.toBe('a');
  });
});
