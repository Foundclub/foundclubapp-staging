import {
  entendreFleche,
  oublierPlancherDepasse,
  poserGardienDesFleches,
  poserPlancherDeRetour,
} from '../gardienDesFleches';

// T3-CHEMINS (03/11) — UN ASSISTANT FINI NE SE ROUVRE PAS PAR LA FLÈCHE. Un site ne vide pas
// l'historique : après la création, la flèche retombait sur une étape de l'assistant, vidée.
// Rouge avant : les étapes mortes étaient servies au routeur.

const historiqueAvant = Object.getOwnPropertyDescriptor(window, 'history');
const locationAvant = Object.getOwnPropertyDescriptor(window, 'location');
const back = jest.fn();
const remplacer = jest.fn();

const placer = (/** @type {number} */ idx, /** @type {string} */ pathname) => {
  Object.defineProperty(window, 'history', {
    configurable: true,
    value: { back, state: { idx } },
  });
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname, replace: remplacer },
  });
};

const fleche = () => {
  const evenement = {
    cancelBubble: false,
    stopImmediatePropagation() { this.cancelBubble = true; },
  };
  entendreFleche(evenement);
  return evenement;
};

beforeEach(() => {
  back.mockClear();
  remplacer.mockClear();
  /** @type {Record<string, string>} */
  const memoire = {};
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (/** @type {string} */ cle) => memoire[cle] ?? null,
      removeItem: (/** @type {string} */ cle) => { delete memoire[cle]; },
      setItem: (/** @type {string} */ cle, /** @type {string} */ valeur) => { memoire[cle] = valeur; },
    },
  });
});

afterEach(() => {
  if (historiqueAvant) Object.defineProperty(window, 'history', historiqueAvant);
  if (locationAvant) Object.defineProperty(window, 'location', locationAvant);
});

test('sous le plancher, sur une étape d assistant : la flèche la saute', () => {
  placer(5, '/events/wizard/recap');
  poserPlancherDeRetour();
  placer(4, '/events/wizard/description');
  const evenement = fleche();
  expect(evenement.cancelBubble).toBe(true);
  expect(back).toHaveBeenCalledTimes(1);
});

test.each([
  '/teams/wizard/recap',
  '/clubs/onboarding/recap',
  '/recruitment/wizard/recap',
  '/friendly-matches/wizard/recap',
  '/admin/clubs/create/recap',
])('%s est un assistant', (adresse) => {
  placer(5, adresse);
  poserPlancherDeRetour();
  placer(4, adresse);
  expect(fleche().cancelBubble).toBe(true);
});

test('la première page de l onglet est une étape morte : l accueil, sans sortir du site', () => {
  placer(5, '/events/wizard/recap');
  poserPlancherDeRetour();
  placer(0, '/events/wizard/description');
  fleche();
  expect(back).not.toHaveBeenCalled();
  expect(remplacer).toHaveBeenCalledWith('/');
});

test('sous le plancher mais hors assistant : la page d avant s affiche', () => {
  placer(5, '/events/wizard/recap');
  poserPlancherDeRetour();
  placer(3, '/teams/t1');
  expect(fleche().cancelBubble).toBe(false);
  expect(back).not.toHaveBeenCalled();
});

test('au-dessus du plancher : rien à sauter', () => {
  placer(5, '/events/wizard/recap');
  poserPlancherDeRetour();
  placer(6, '/events/wizard/recap');
  expect(fleche().cancelBubble).toBe(false);
});

test('un assistant rouvert depuis plus bas : ses étapes reviennent normalement', () => {
  placer(5, '/events/wizard/recap');
  poserPlancherDeRetour();
  placer(3, '/events/wizard/type');
  oublierPlancherDepasse();
  placer(2, '/events/wizard/type');
  expect(fleche().cancelBubble).toBe(false);
});

test('un assistant jamais fini : son retour reste libre', () => {
  placer(2, '/events/wizard/type');
  expect(fleche().cancelBubble).toBe(false);
});

test('le gardien d une saisie modifiée passe avant', () => {
  placer(5, '/events/wizard/recap');
  poserPlancherDeRetour();
  placer(4, '/events/wizard/description');
  const retirer = poserGardienDesFleches((/** @type {any} */ e) => e.stopImmediatePropagation());
  fleche();
  retirer();
  expect(back).not.toHaveBeenCalled();
});
