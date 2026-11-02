import {
  confirmerDansLApp, demanderDansLApp, ouvrirFenetre, poserHoteDeFenetre,
} from '../fenetreDeLApp';

// REPRISE-ROBUSTESSE (01/11/2026, Adel « 1- B ») — le registre de la fenêtre de l'app. Sans hôte
// (téléphone, jest, banc sans racine), tout retombe sur le navigateur comme avant ; avec l'hôte,
// la question part dans la fenêtre de l'app et la réponse revient par ses boutons.

/** @type {(() => void) | null} */
let retirer = null;
// L'environnement de jest n'a ni window.confirm ni window.prompt : on les pose, puis on les retire.
const confirmDOrigine = window.confirm;
const promptDOrigine = window.prompt;
afterEach(() => {
  retirer?.();
  retirer = null;
  window.confirm = confirmDOrigine;
  window.prompt = promptDOrigine;
});

describe('sans hôte posé : le comportement d avant', () => {
  test('ouvrirFenetre ne prend rien en charge', () => {
    expect(ouvrirFenetre({ title: 'Club créé !' })).toBe(false);
  });

  test('confirmerDansLApp et demanderDansLApp retombent sur confirm et prompt', async () => {
    const confirm = jest.fn(() => true);
    window.confirm = confirm;
    const prompt = jest.fn(() => 'Météo');
    window.prompt = prompt;

    const texte = 'Annuler ?\n\nLes inscrits seront prévenus.';
    await expect(confirmerDansLApp(texte)).resolves.toBe(true);
    await expect(demanderDansLApp('Pourquoi ?', 'x')).resolves.toBe('Météo');
    expect(confirm).toHaveBeenCalledWith(texte);
    expect(prompt).toHaveBeenCalledWith('Pourquoi ?', 'x');
  });
});

describe('avec l hôte : la fenêtre de l app, jamais la boîte du navigateur', () => {
  /** @type {import('../fenetreDeLApp').Fenetre[]} */
  let ouvertes = [];
  beforeEach(() => {
    ouvertes = [];
    retirer = poserHoteDeFenetre((fenetre) => { ouvertes.push(fenetre); });
  });

  test('la confirmation sépare le titre du texte, et « OK » répond oui', async () => {
    const confirm = jest.fn();
    window.confirm = confirm;
    const reponse = confirmerDansLApp('Annuler ?\n\nLes inscrits seront prévenus.');

    expect(ouvertes).toHaveLength(1);
    expect(ouvertes[0])
      .toMatchObject({ message: 'Les inscrits seront prévenus.', title: 'Annuler ?' });
    expect(ouvertes[0].buttons?.map((bouton) => bouton.style || 'ok')).toEqual(['cancel', 'ok']);
    ouvertes[0].buttons?.[1].onPress?.();
    await expect(reponse).resolves.toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  test('« Annuler » répond non', async () => {
    const reponse = confirmerDansLApp('Signaler ce message ?');
    expect(ouvertes[0]).toMatchObject({ message: undefined, title: 'Signaler ce message ?' });
    ouvertes[0].buttons?.[0].onPress?.();
    await expect(reponse).resolves.toBe(false);
  });

  test('la question écrite rend ce qui a été tapé, ou null', async () => {
    const prompt = jest.fn();
    window.prompt = prompt;
    const reponse = demanderDansLApp('Pourquoi ?', 'Météo');
    expect(ouvertes[0]).toMatchObject({ champ: { defaultValue: 'Météo' }, title: 'Pourquoi ?' });
    ouvertes[0].champ?.onSubmit('Terrain gelé');
    await expect(reponse).resolves.toBe('Terrain gelé');
    expect(prompt).not.toHaveBeenCalled();
  });

  test('un hôte retiré ne reçoit plus rien', () => {
    retirer?.();
    retirer = null;
    expect(ouvrirFenetre({ title: 'x' })).toBe(false);
    expect(ouvertes).toHaveLength(0);
  });
});
