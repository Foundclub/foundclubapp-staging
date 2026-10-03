import { readFileSync } from 'fs';
import { join } from 'path';

import i18n from '@/theme/strings';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

// FINITIONS12-STATS · POINT 8 (tournee T11, S12) — LES ACCENTS DU BLOC « PRÉSENCE ÉVÉNEMENT ».
//
// Releves a l ecran chez Hugo, page de son match : « Tu es signale present a l heure. » et la
// pastille « Arrive ». La pastille etait ecrite EN DUR dans l ecran (trois fois, plus « Retard
// annonce »), a cote de clefs qui existaient deja, accentuees (`eventDetails.attendanceBadge`).
// Les phrases soeurs du meme bloc (« Tu es signale absent », « Retard signale : … ») suivent.
//
// Chaque clef est RENDUE par le vrai i18next ; les textes de secours du code sont balayes : un
// ecran dont la clef manque ne doit pas ressortir l ancienne graphie.

const RACINE_SRC = join(__dirname, '..', '..', '..');
const ECRANS = ['views/event/EventDetails.js', 'views/event/EventDetails.web.js'];

describe('FINITIONS12-STATS point 8 — le bloc « Présence événement » est accentué', () => {
  test.each([
    ['fr', 'eventDetails.youAreMarkedPresentOn', {}, 'Tu es signalé présent à l’heure.'],
    ['fr', 'eventDetails.youReMarkedAbsent', {}, 'Tu es signalé absent'],
    ['fr', 'eventDetails.lateArrivalReportedMinConfirm', { declaredLateMinutes: 5 },
      'Retard signalé : +5 min. Confirme ton arrivée une fois sur place.'],
    ['fr', 'eventDetails.attendanceBadge.arrived', {}, 'Arrivé'],
    ['fr', 'eventDetails.attendanceBadge.declaredLate', {}, 'Retard annoncé'],
    ['en', 'eventDetails.attendanceBadge.arrived', {}, 'Arrived'],
    ['en', 'eventDetails.attendanceBadge.declaredLate', {}, 'Lateness reported'],
  ])('🚨 [%s] %s', async (langue, clef, valeurs, attendu) => {
    await i18n.changeLanguage(langue);
    expect(i18n.t(clef, { ...valeurs, ...SANS_ECHAPPEMENT })).toBe(attendu);
  });

  test.each(ECRANS)('🚨 %s ne garde aucune ancienne graphie en dur', (fichier) => {
    const source = readFileSync(join(RACINE_SRC, fichier), 'utf8');

    expect(source).not.toMatch(/badgeLabel: 'Arrive'/);
    expect(source).not.toMatch(/'Retard annonce'/);
    expect(source).not.toMatch(/signale present a l/);
    expect(source).not.toMatch(/Tu es signale absent/);
    expect(source).not.toMatch(/Retard signale :/);
  });
});
