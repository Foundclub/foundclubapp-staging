import { formatBannerShortTime, selectBannerDay } from '../homeCounters';

// FINITIONS (recette émulateur du 2026-09-28, tournée 2) — l'accueil DIRIGEANT rangeait
// le match du MERCREDI 30/09 sous « AUJOURD'HUI », un LUNDI (capture
// T2-accueil-aujourdhui-mercredi).
//
// 🔎 LA CAUSE N'ÉTAIT NI UN FUSEAU NI UNE DATE COMPARÉE EN TEXTE : il n'y avait AUCUNE
// règle. L'étiquette du bandeau était une constante (« Aujourd'hui »), posée au-dessus
// du PROCHAIN événement quel que soit son jour — `HomeHub.js`, branche dirigeant.
// ⇒ La règle vit ici, dans le module partagé, testable sans l'écran. Écrit ROUGE.
//
// Les dates sont construites en heure LOCALE (comme le fait l'écran) : le témoin dit la
// même chose quel que soit le fuseau de la machine qui le fait tourner.

const LUNDI_28_09_9H = new Date(2026, 8, 28, 9, 0);
const le = (/** @type {number} */ jour, /** @type {number} */ mois, heure = 18) => (
  new Date(2026, mois - 1, jour, heure, 0).toISOString()
);

describe('FINITIONS 3 — sous quel jour ranger le prochain événement', () => {
  it('🥇 lundi 28/09, match mercredi 30/09 → « cette semaine », PAS « aujourd hui »', () => {
    expect(selectBannerDay(le(30, 9), LUNDI_28_09_9H)).toBe('thisWeek');
  });

  it.each([
    ['plus tard le même jour', le(28, 9, 20), 'today'],
    ['déjà commencé ce matin', le(28, 9, 8), 'today'],
    ['demain', le(29, 9), 'tomorrow'],
    ['dimanche de la même semaine', le(4, 10), 'thisWeek'],
    ['lundi suivant', le(5, 10), 'later'],
    ['dans trois semaines', le(19, 10), 'later'],
  ])('%s', (_cas, startsAt, attendu) => {
    expect(selectBannerDay(startsAt, LUNDI_28_09_9H)).toBe(attendu);
  });

  it('semaine du calendrier : un samedi, le mardi suivant n est pas « cette semaine »', () => {
    const samedi = new Date(2026, 9, 3, 10, 0);
    expect(selectBannerDay(le(6, 10), samedi)).toBe('later');
    expect(selectBannerDay(le(4, 10), samedi)).toBe('tomorrow');
  });

  it('sans date lisible, aucun rangement', () => {
    expect(selectBannerDay(null, LUNDI_28_09_9H)).toBeNull();
    expect(selectBannerDay('pas une date', LUNDI_28_09_9H)).toBeNull();
  });
});

describe('FINITIONS 3 — l heure affichée dit QUEL jour quand il est loin', () => {
  it('cette semaine : le jour court suffit (« mer. 18:00 »)', () => {
    expect(formatBannerShortTime(le(30, 9), LUNDI_28_09_9H)).toBe('mer. 18:00');
  });

  it('au-delà : la date s ajoute (« lun. 05/10 18:00 ») — sinon « lun. » ne dit pas lequel', () => {
    expect(formatBannerShortTime(le(5, 10), LUNDI_28_09_9H)).toBe('lun. 05/10 18:00');
  });

  it('sans « maintenant », l ancien format reste (non-régression)', () => {
    expect(formatBannerShortTime('2026-08-15T14:00:00')).toBe('sam. 14:00');
  });
});
