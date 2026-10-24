// BH04 / P3-04 — annuler le sélecteur de fichiers du navigateur rend `null` au lieu de bloquer.
import { pickDocument } from '../media.web';

describe('media.web — annuler le choix d un fichier', () => {
  afterEach(() => { delete global.document; });

  test('l événement « cancel » termine l attente avec null', async () => {
    const ecouteurs = {};
    const champ = {
      addEventListener: (nom, f) => { ecouteurs[nom] = f; },
      click: () => {},
      files: [],
    };
    global.document = { createElement: () => champ };
    const choix = pickDocument();
    ecouteurs.cancel?.();
    const issue = await Promise.race([choix, new Promise((r) => { setTimeout(() => r('bloqué'), 50); })]);
    expect(issue).toBeNull();
  });
});
