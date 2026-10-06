/**
 * L'HORLOGE AVANCÉE — TEMOINS-DATES (06/10/2026).
 *
 * Le 05/10 à 19:30 UTC, une marche entière de `test:authz` est passée au rouge sans qu'une ligne
 * de code ait changé : le témoin COLL3A « T10 route » écrivait une séance au 05/10 18:00 UTC et
 * comparait à l'heure RÉELLE. Ce module rejoue les témoins comme si le calendrier avait avancé :
 * un témoin qui rougit ici dépend de la date du jour, et rougira tout seul ce jour-là.
 *
 * Ce qui est décalé : `new Date()` sans argument, `Date()` appelé comme fonction, `Date.now()`.
 * Ce qui ne l'est pas : `new Date(<valeur>)`, `Date.parse`, `Date.UTC`, le fuseau (`TZ`
 * inchangé), `performance.now()` et les minuteurs. Une horloge figée par le témoin
 * (`t.mock.timers`, `jest.useFakeTimers({ now })`) l'emporte : c'est ce qu'on veut prouver.
 *
 * Chargé de deux façons, sans rien changer d'autre :
 *   - `NODE_OPTIONS=--require=<ce fichier>` : le processus Node (chaque fichier de `node --test`) ;
 *   - côté `app`, en plus, dans `setupFiles` de Jest : le monde du témoin a son propre `Date`.
 * Le décalage se lit dans `HORLOGE_DECALAGE_JOURS` ; 0 ou absent = rien n'est touché.
 */

const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Remplace `global.Date` par la même horloge, en avance de `jours` jours (rien si 0).
 * @param {number} jours Le décalage, en jours.
 * @returns {void}
 */
const avancerLaDate = (jours) => {
  const DateReelle = global.Date;
  if (!jours || DateReelle.horlogeAvanceeDeJours !== undefined) return;
  const ecart = jours * JOUR_MS;

  /**
   * `new Date()` sans argument et `Date()` lisent l'heure avancée ; le reste est inchangé.
   * @param {...*} args Les arguments de `Date`.
   * @returns {Date|string} La date, ou sa forme texte si `Date` est appelé sans `new`.
   */
  function DateAvancee(...args) {
    if (!new.target) return new DateReelle(DateReelle.now() + ecart).toString();
    const date = args.length ? new DateReelle(...args) : new DateReelle(DateReelle.now() + ecart);
    if (new.target !== DateAvancee) Object.setPrototypeOf(date, new.target.prototype);
    return date;
  }
  Object.setPrototypeOf(DateAvancee, DateReelle);
  DateAvancee.prototype = DateReelle.prototype;
  Object.defineProperty(DateAvancee, 'name', { value: 'Date' });
  DateAvancee.now = () => DateReelle.now() + ecart;
  DateAvancee.horlogeAvanceeDeJours = jours;
  global.Date = DateAvancee;
};

avancerLaDate(Number(process.env.HORLOGE_DECALAGE_JOURS || 0));

module.exports = { avancerLaDate };
