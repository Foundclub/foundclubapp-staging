/**
 * PARENT P2 — LES TROIS TRANCHES D'ÂGE (E17 du plan, tranché par Adel le 07/09).
 *
 * 🧠 LE POUVOIR DU PARENT NE SE STOCKE JAMAIS : il se CALCULE à partir de l'âge
 * de l'enfant, à chaque lecture (B6 du plan). Aucun cron, aucune migration —
 * donc rien qui puisse être en retard, ni tourner deux fois. Le jour des 13 ans
 * et le jour des 18 ans, l'app change de comportement toute seule.
 *
 * | Âge         | Ce que le parent peut faire                                  |
 * |-------------|--------------------------------------------------------------|
 * | moins de 13 | TOUT ce qui existe, y compris demander à rejoindre un club    |
 * | 13 à 17     | il VOIT, il n'agit plus. L'ado répond lui-même                |
 * | 18 et plus  | RIEN. Le lien s'éteint                                       |
 *
 * ⛔ Un ado de 16 ans qui ne pourrait pas dire lui-même qu'il vient à
 * l'entraînement, « ça ne tient pas debout » (plan, E17).
 */

import {
  PARENTAL_POWER_ENDS_AGE,
  parentalPowerForAge,
} from '../parentalDeclaration';

describe('PARENT P2 — ce que le parent peut faire, selon l\'âge de l\'enfant', () => {
  test('moins de 13 ans : le parent agit sur TOUT', () => {
    expect(parentalPowerForAge(0)).toBe('full');
    expect(parentalPowerForAge(9)).toBe('full');
    expect(parentalPowerForAge(12)).toBe('full');
  });

  test('13 à 17 ans : le parent VOIT, il n\'agit plus', () => {
    expect(parentalPowerForAge(13)).toBe('view');
    expect(parentalPowerForAge(16)).toBe('view');
    expect(parentalPowerForAge(17)).toBe('view');
  });

  test('18 ans et plus : le lien s\'ÉTEINT', () => {
    expect(parentalPowerForAge(18)).toBe('none');
    expect(parentalPowerForAge(42)).toBe('none');
    expect(PARENTAL_POWER_ENDS_AGE).toBe(18);
  });

  test('🔢 un âge INCONNU ne vaut pas zéro : il ferme la main, il n\'ouvre pas tout', () => {
    // `Number('')` vaut 0, et 0 an tomberait dans « moins de 13 » — donc dans la
    // tranche la plus PERMISSIVE. Sur des données d'enfant, l'inconnu doit
    // fermer, jamais ouvrir.
    expect(parentalPowerForAge(null)).toBe('view');
    expect(parentalPowerForAge(undefined)).toBe('view');
    expect(parentalPowerForAge('')).toBe('view');
    expect(parentalPowerForAge('douze')).toBe('view');
  });
});
