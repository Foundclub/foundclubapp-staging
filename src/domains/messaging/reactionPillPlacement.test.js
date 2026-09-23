import {
  REACTION_PILL_GAP,
  computeReactionPillPlacement,
} from './reactionPillPlacement';

// WHATSAPP — OU SE POSE LA PILULE. Tout le lot tient dans ce calcul : sur
// WhatsApp, l appui long fait sortir la rangee JUSTE AU-DESSUS du message, qui
// reste visible dessous. Chez nous, elle montait du bas de l ecran dans une
// feuille qui cachait la conversation — on choisissait une reaction sans plus
// voir a quoi on reagissait.
//
// 🪤 CE CALCUL EST PUR, ET C EST DELIBERE : la geometrie de `BottomModal` ment
// (memoire `piege-bottommodal-geometrie-feuille`), donc rien ici ne doit
// dependre d une mesure de feuille. On ne prend que la bulle mesuree a l ecran,
// la taille de la fenetre et les encoches.

const FENETRE = { height: 800, width: 400 };
const ENCOCHES = { bottom: 34, top: 60 };
const PILULE = { height: 48, width: 280 };

const placer = (bulle, options = {}) => computeReactionPillPlacement({
  anchor: bulle,
  insets: ENCOCHES,
  pill: PILULE,
  window: FENETRE,
  ...options,
});

describe('WHATSAPP — la pilule de reactions se pose sur la bulle', () => {
  it('se pose AU-DESSUS de la bulle quand la place existe', () => {
    const place = placer({ height: 60, width: 200, x: 20, y: 400 });

    expect(place.placedAbove).toBe(true);
    expect(place.top).toBe(400 - REACTION_PILL_GAP - PILULE.height);
  });

  it('BASCULE EN DESSOUS quand la bulle touche le haut de l ecran', () => {
    // Une bulle a 70 px du haut : au-dessus, la pilule passerait sous l encoche.
    const place = placer({ height: 60, width: 200, x: 20, y: 70 });

    expect(place.placedAbove).toBe(false);
    expect(place.top).toBe(70 + 60 + REACTION_PILL_GAP);
  });

  it('ne sort JAMAIS de l ecran, ni par le haut ni par le bas', () => {
    const enBas = placer({ height: 60, width: 200, x: 20, y: 760 });
    expect(enBas.top + PILULE.height).toBeLessThanOrEqual(FENETRE.height - ENCOCHES.bottom);

    const enHaut = placer({ height: 10, width: 200, x: 20, y: 0 });
    expect(enHaut.top).toBeGreaterThanOrEqual(ENCOCHES.top);
  });

  it('se range sur le bord de la bulle : a gauche pour un message recu', () => {
    const place = placer({ height: 60, width: 220, x: 12, y: 400 }, { alignEnd: false });
    expect(place.left).toBe(12);
  });

  it('se range a droite pour MON message, comme sur WhatsApp', () => {
    // Bulle collee au bord droit : 400 - 12 - 220 = 168.
    const place = placer({ height: 60, width: 220, x: 168, y: 400 }, { alignEnd: true });
    // Alignee sur le bord droit de la bulle (388), donc 388 - 280 = 108.
    expect(place.left).toBe(108);
  });

  it('reste dans l ecran quand la bulle est etroite et collee a un bord', () => {
    // Une bulle de 40 px a l extreme droite : alignee a droite, la pilule de
    // 280 px sortirait de l ecran par la gauche comme par la droite.
    const place = placer({ height: 40, width: 40, x: 352, y: 400 }, { alignEnd: true });

    expect(place.left).toBeGreaterThanOrEqual(8);
    expect(place.left + PILULE.width).toBeLessThanOrEqual(FENETRE.width - 8);
  });

  it('ne rend jamais de valeur absurde quand on ne lui donne rien', () => {
    const place = computeReactionPillPlacement({});

    expect(Number.isFinite(place.left)).toBe(true);
    expect(Number.isFinite(place.top)).toBe(true);
  });
});
