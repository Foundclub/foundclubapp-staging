import { ecouterLeDepot } from '../depotDeFichiers';

// 🖱️ COLL-C4A3 (03/10/2026) — l'écoute du glisser-déposer du site, seule, sur un élément qui
// écoute comme celui du navigateur (EventTarget). Ce que l'écran en fait est dans
// src/views/collectivite/__tests__/COLLC4A3.publier.test.js.

/**
 * Un glisser du navigateur : `dataTransfer` porte ses types et ses fichiers.
 * @param {string} type - dragenter, dragover, dragleave, drop.
 * @param {{ files?: any[], types?: string[] }} [transfert] - Ce qui est glissé.
 * @returns {Event} L'événement, annulable.
 */
const glisser = (type, { files = [], types = ['Files'] } = {}) => {
  const evenement = new Event(type, { cancelable: true });
  Object.defineProperty(evenement, 'dataTransfer', {
    value: { dropEffect: 'none', files, types },
  });
  return evenement;
};

describe('COLL-C4A3 — l’écoute du dépôt de fichiers', () => {
  it('un fichier survolé puis lâché : le navigateur ne l’OUVRE pas, l’écran le reçoit', () => {
    const zone = new EventTarget();
    const onFichiers = jest.fn();
    const onSurvol = jest.fn();
    const arreter = ecouterLeDepot(zone, { onFichiers, onSurvol });
    const survol = glisser('dragover');
    zone.dispatchEvent(glisser('dragenter'));
    zone.dispatchEvent(survol);
    // Sans `preventDefault`, le navigateur ouvrirait le fichier et la saisie serait perdue.
    expect(survol.defaultPrevented).toBe(true);
    expect(/** @type {any} */ (survol).dataTransfer.dropEffect).toBe('copy');
    const a = new File(['a'], 'a.png');
    const b = new File(['b'], 'b.pdf');
    const depot = glisser('drop', { files: [a, b] });
    zone.dispatchEvent(depot);
    expect(depot.defaultPrevented).toBe(true);
    expect(onFichiers).toHaveBeenCalledWith([a, b]);
    expect(onSurvol.mock.calls.map(([actif]) => actif)).toEqual([true, false]);
    arreter();
  });

  it('un glisser SANS fichier (du texte, un lien) est laissé au navigateur', () => {
    const zone = new EventTarget();
    const onFichiers = jest.fn();
    const onSurvol = jest.fn();
    const arreter = ecouterLeDepot(zone, { onFichiers, onSurvol });
    const texte = glisser('drop', { types: ['text/plain'] });
    zone.dispatchEvent(glisser('dragenter', { types: ['text/plain'] }));
    zone.dispatchEvent(texte);
    expect(texte.defaultPrevented).toBe(false);
    expect(onFichiers).not.toHaveBeenCalled();
    expect(onSurvol).not.toHaveBeenCalled();
    arreter();
  });

  it('le survol se compte : passer sur un enfant ne l’éteint pas, la vraie sortie si', () => {
    const zone = new EventTarget();
    const onSurvol = jest.fn();
    const arreter = ecouterLeDepot(zone, { onFichiers: jest.fn(), onSurvol });
    zone.dispatchEvent(glisser('dragenter'));
    zone.dispatchEvent(glisser('dragenter')); // entrée dans un enfant
    zone.dispatchEvent(glisser('dragleave')); // sortie de la zone vers l'enfant
    expect(onSurvol.mock.calls.map(([actif]) => actif)).toEqual([true]);
    zone.dispatchEvent(glisser('dragleave'));
    expect(onSurvol.mock.calls.map(([actif]) => actif)).toEqual([true, false]);
    arreter();
  });

  it('arrêter, c’est sourd ; sans élément du navigateur (le téléphone), rien ne casse', () => {
    const zone = new EventTarget();
    const onFichiers = jest.fn();
    ecouterLeDepot(zone, { onFichiers, onSurvol: jest.fn() })();
    zone.dispatchEvent(glisser('drop', { files: [new File(['a'], 'a.png')] }));
    expect(onFichiers).not.toHaveBeenCalled();
    expect(() => ecouterLeDepot(null, { onFichiers, onSurvol: jest.fn() })()).not.toThrow();
    // Une vue native (le téléphone) n'a pas d'`addEventListener` : rien n'est écouté.
    expect(() => ecouterLeDepot({ focus: jest.fn() }, { onFichiers, onSurvol: jest.fn() })())
      .not.toThrow();
  });
});
