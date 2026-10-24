// BH02 (BUGHUNT 24/10) : témoin P3-06 (P3-02 renvoyé en phase 2 : choix de produit).
// P3-06 ne se voit qu'à l'ouest d'UTC ; sous Windows, jest n'applique pas TZ : on simule
// donc l'heure de la Martinique (UTC-4, sans heure d'été) par une Date dont l'heure locale = UTC-4.
import { computeAge } from '../cardModel';

const RealDate = Date;
const DECALAGE = 4 * 3600 * 1000;
class DateMartinique extends RealDate {
  constructor(...args) {
    if (args.length > 1) super(RealDate.UTC(...args) + DECALAGE);
    else super(...args);
  }

  getDate() { return this.local().getUTCDate(); }

  getFullYear() { return this.local().getUTCFullYear(); }

  getMonth() { return this.local().getUTCMonth(); }

  local() { return new RealDate(this.getTime() - DECALAGE); }
}

describe('cardModel - BH02', () => {
  afterEach(() => { global.Date = RealDate; });

  test('P3-06 : outre-mer, l\'âge ne prend pas un an la veille de l\'anniversaire', () => {
    global.Date = DateMartinique;
    expect(computeAge('2012-07-12', new DateMartinique(2026, 6, 11, 12))).toBe(13);
    expect(computeAge('2012-07-12', new DateMartinique(2026, 6, 12, 12))).toBe(14);
  });
});
