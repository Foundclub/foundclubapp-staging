// SERIES (08/10/2026, decision d'Adel « séries lot », point 5) — CE QUE L'ÉCRAN DIT QUAND «
// MODIFIER LA SÉRIE » MET DES DATES EN ATTENTE. Avant : le serveur recopiait l'horaire et le lieu
// sur les autres dates sans juge, et l'écran revenait à la fiche sans un mot. Le serveur neuf
// juge chaque date déplacée et rend le bilan des AUTRES dates (`meta.recurrence` : awaitingCity,
// awaitingClub) ; la date modifiée se lit dans `data`. L'écran dit alors combien de dates
// attendent la Ville ou le dirigeant, et ce qui arrive si la Ville refuse (la séance est annulée
// : `refuseRequest`). Un serveur d'avant ne rend pas de bilan : rien n'est dit, comme avant.

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

const i18n = i18nextTemoin.default || i18nextTemoin;
i18n.init({
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});
const t = (/** @type {any[]} */ ...args) => i18n.t(...args);

const { seriesUpdateMessage, seriesUpdateWaiting } = require('@/domains/event/seriesUpdateOutcome');

const reponse = (/** @type {any} */ courante, /** @type {any} */ autres) => ({
  data: { documentId: 'ev-1', ...courante },
  ...(autres ? { meta: { recurrence: { moved: 2, updated: 2, ...autres } } } : { meta: {} }),
});

describe('SERIES — le bilan de « Modifier la série »', () => {
  // eslint-disable-next-line max-len
  test('la date modifiée ET ses sœurs attendent la Ville : 3 dates, et ce qui arrive si elle refuse', () => {
    // eslint-disable-next-line max-len
    const r = reponse({ pendingReason: 'facility_overbooking', status: 'pending_validation' }, { awaitingCity: 2, awaitingClub: 0 });
    expect(seriesUpdateWaiting(r)).toEqual({ city: 3, club: 0 });
    expect(seriesUpdateMessage(r, t)).toBe(
      // eslint-disable-next-line max-len
      '3 dates de la série attendent la décision de la Ville : elles restent en attente jusqu’à sa réponse. '
      + 'Si la Ville refuse, ces séances seront annulées.',
    );
  });

  // eslint-disable-next-line max-len
  test('une seule date attend la Ville ; une autre attend le dirigeant : deux phrases, au singulier', () => {
    // eslint-disable-next-line max-len
    const r = reponse({ pendingReason: 'none', status: 'confirmed' }, { awaitingCity: 1, awaitingClub: 1 });
    expect(seriesUpdateMessage(r, t)).toBe(
      // eslint-disable-next-line max-len
      '1 date de la série attend la décision de la Ville : elle reste en attente jusqu’à sa réponse. '
      + 'Si la Ville refuse, cette séance sera annulée.\n\n'
      // eslint-disable-next-line max-len
      + '1 date attend l’accord d’un dirigeant du club : le créneau du club est déjà complet ce jour-là.',
    );
  });

  test('rien en attente, ou un serveur d’avant (pas de bilan) : rien n’est dit', () => {
    // eslint-disable-next-line max-len
    expect(seriesUpdateMessage(reponse({ status: 'confirmed' }, { awaitingCity: 0, awaitingClub: 0 }), t)).toBeNull();
    // eslint-disable-next-line max-len
    expect(seriesUpdateMessage(reponse({ pendingReason: 'facility_overbooking', status: 'pending_validation' }, null), t))
      .toBeNull();
    expect(seriesUpdateMessage(undefined, t)).toBeNull();
  });
});
