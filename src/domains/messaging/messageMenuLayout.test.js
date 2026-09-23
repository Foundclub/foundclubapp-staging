import {
  computeMessageMenuLayout,
  REACTION_PILL_GAP,
} from './reactionPillPlacement';

// WHATSAPP2 — LE CALCUL QUI EMPECHE LE DEFAUT D ADEL.
//
// 🧨 CE QUI S EST PASSE EN 2.6.56. La pilule se posait bien au-dessus du message,
// mais le panneau d actions occupait tout le bas de l ecran — et quand le message
// visé etait en bas (le cas le plus frequent : les derniers messages du fil), le
// panneau RECOUVRAIT la pilule. Adel a vu ses emojis tranches a mi-hauteur.
//
// La cause n est pas un style : c est que le placement de la pilule ne savait
// RIEN de la place prise par les actions. Les deux sont donc calcules ENSEMBLE
// ici, et le temoin central est « ils ne se chevauchent jamais ».

const FENETRE = { height: 800, width: 400 };
const ENCOCHES = { bottom: 34, top: 60 };
const PILULE = { height: 52, width: 344 };
const MENU = { height: 220, width: 220 };

const poser = (bulle, options = {}) => computeMessageMenuLayout({
  anchor: bulle,
  insets: ENCOCHES,
  menu: MENU,
  pill: PILULE,
  window: FENETRE,
  ...options,
});

/**
 * Deux rectangles se chevauchent-ils verticalement ?
 * @param {number} a Le haut du premier.
 * @param {number} hauteurA Sa hauteur.
 * @param {number} b Le haut du second.
 * @param {number} hauteurB Sa hauteur.
 * @returns {boolean} Vrai s ils se recouvrent, ne serait-ce que d un pixel.
 */
const seChevauchent = (a, hauteurA, b, hauteurB) => (
  a < b + hauteurB && b < a + hauteurA
);

describe('WHATSAPP2 — la pilule et le menu se partagent l ecran', () => {
  it('message au milieu : emojis au-dessus, actions en dessous', () => {
    const place = poser({
      height: 60, width: 220, x: 20, y: 380,
    });

    expect(place.pill.top).toBe(380 - REACTION_PILL_GAP - PILULE.height);
    expect(place.menu.top).toBe(380 + 60 + REACTION_PILL_GAP);
    expect(place.pillAbove).toBe(true);
    expect(place.menuBelow).toBe(true);
  });

  it('🧨 LE DEFAUT D ADEL — message EN BAS : le menu ne recouvre JAMAIS la pilule', () => {
    // Le dernier message du fil, juste au-dessus du clavier.
    const place = poser({
      height: 60, width: 220, x: 20, y: 690,
    });

    expect(seChevauchent(place.pill.top, PILULE.height, place.menu.top, MENU.height))
      .toBe(false);
    // Les deux restent dans l ecran utile.
    expect(place.pill.top).toBeGreaterThanOrEqual(ENCOCHES.top);
    expect(place.menu.top + MENU.height)
      .toBeLessThanOrEqual(FENETRE.height - ENCOCHES.bottom);
  });

  it('message tout en HAUT : les deux s empilent EN DESSOUS', () => {
    const place = poser({
      height: 60, width: 220, x: 20, y: 64,
    });

    expect(place.pillAbove).toBe(false);
    expect(place.pill.top).toBeGreaterThanOrEqual(64 + 60);
    expect(place.menu.top).toBeGreaterThanOrEqual(place.pill.top + PILULE.height);
    expect(seChevauchent(place.pill.top, PILULE.height, place.menu.top, MENU.height))
      .toBe(false);
  });

  it('message tout en BAS : les deux s empilent AU-DESSUS, dans l ordre emojis puis actions', () => {
    const place = poser({
      height: 40, width: 220, x: 20, y: 740,
    });

    expect(place.menuBelow).toBe(false);
    // L ordre de WhatsApp est garde : les emojis restent au-dessus des actions.
    expect(place.pill.top + PILULE.height).toBeLessThanOrEqual(place.menu.top);
    expect(place.pill.top).toBeGreaterThanOrEqual(ENCOCHES.top);
  });

  it('un message GEANT qui remplit l ecran : rien ne sort, rien ne se chevauche', () => {
    const place = poser({
      height: 700, width: 300, x: 20, y: 60,
    });

    expect(place.pill.top).toBeGreaterThanOrEqual(ENCOCHES.top);
    expect(place.menu.top + MENU.height)
      .toBeLessThanOrEqual(FENETRE.height - ENCOCHES.bottom);
    expect(seChevauchent(place.pill.top, PILULE.height, place.menu.top, MENU.height))
      .toBe(false);
  });

  it('les deux se rangent du MEME cote que la bulle', () => {
    const recu = poser({
      height: 60, width: 220, x: 12, y: 380,
    }, { alignEnd: false });
    expect(recu.pill.left).toBe(12);
    expect(recu.menu.left).toBe(12);

    const mien = poser({
      height: 60, width: 220, x: 168, y: 380,
    }, { alignEnd: true });
    expect(mien.pill.left).toBe(388 - PILULE.width);
    expect(mien.menu.left).toBe(388 - MENU.width);
  });

  it('ne sortent jamais par les bords, meme sur une bulle etroite collee a droite', () => {
    const place = poser({
      height: 40, width: 40, x: 352, y: 380,
    }, { alignEnd: true });

    expect(place.pill.left).toBeGreaterThanOrEqual(8);
    expect(place.pill.left + PILULE.width).toBeLessThanOrEqual(FENETRE.width - 8);
    expect(place.menu.left).toBeGreaterThanOrEqual(8);
    expect(place.menu.left + MENU.width).toBeLessThanOrEqual(FENETRE.width - 8);
  });

  it('ne rend jamais de valeur absurde quand on ne lui donne rien', () => {
    const place = computeMessageMenuLayout({});

    expect(Number.isFinite(place.pill.top)).toBe(true);
    expect(Number.isFinite(place.pill.left)).toBe(true);
    expect(Number.isFinite(place.menu.top)).toBe(true);
    expect(Number.isFinite(place.menu.left)).toBe(true);
  });
});
