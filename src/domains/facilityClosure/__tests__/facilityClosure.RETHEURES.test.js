/* eslint-disable max-len */
import i18next from 'i18next';

import { occupationDesLieux, occupationLabel } from '@/domains/collectivite/evenementDeLaVille';
import { closedThatDayText } from '@/domains/relocation/relocationDisplay';
import fr from '@/theme/strings/translations/fr';

import {
  closureBandsForRange,
  closureBannerText,
  closureOfDay,
  closureRefusalText,
  closureTakesWholeDay,
} from '../facilityClosureDisplay';

// RET-FERMETURE-HEURES (03/11/2026, Adel, option C de la fiche 2) — « Quand on ferme un certain delta
// d'heure, ça doit être fermé que sur ce delta d'heure. » Avant et après, l'installation reste ouverte.

const MARDI = '2026-11-03';
const NEUF_TREIZE = {
  endDate: MARDI, endTime: '13:00', kind: 'closure', reason: 'travaux', startDate: MARDI, startTime: '09:00',
};
const JOURNEE = {
  endDate: MARDI, endTime: null, kind: 'closure', reason: 'travaux', startDate: MARDI, startTime: null,
};
const BLOC = {
  endDate: '2026-11-06', endTime: '12:00', kind: 'closure', reason: 'travaux', startDate: MARDI, startTime: '14:00',
};
const BLOCAGE = { ...NEUF_TREIZE, kind: 'block', label: 'Forum' };
const t = (/** @type {any[]} */ ...args) => i18next.t(...args);

describe('RET-FERMETURE-HEURES — une fermeture avec heures ne prend que ces heures', () => {
  beforeAll(async () => {
    await i18next.init({
      compatibilityJSON: 'v4',
      fallbackLng: 'fr',
      lng: 'fr',
      resources: { fr: { translation: fr } },
    });
  });

  it('prend-elle tout le jour ? journée entière oui ; plage non ; jours du milieu oui ; blocage non', () => {
    expect(closureTakesWholeDay(JOURNEE, MARDI)).toBe(true);
    expect(closureTakesWholeDay(JOURNEE, '2026-11-04')).toBe(false);
    expect(closureTakesWholeDay(NEUF_TREIZE, MARDI)).toBe(false);
    expect(closureTakesWholeDay(BLOC, MARDI)).toBe(false);
    expect(closureTakesWholeDay(BLOC, '2026-11-04')).toBe(true);
    expect(closureTakesWholeDay(BLOC, '2026-11-05')).toBe(true);
    expect(closureTakesWholeDay(BLOC, '2026-11-06')).toBe(false);
    expect(closureTakesWholeDay(BLOCAGE, MARDI)).toBe(false);
  });

  it('le jour : celle qui prend tout passe devant une plage', () => {
    expect(closureOfDay([NEUF_TREIZE, JOURNEE], MARDI)).toBe(JOURNEE);
    expect(closureOfDay([BLOCAGE, NEUF_TREIZE], MARDI)).toBe(BLOCAGE);
  });

  it('la plage posée au planning dit si elle prend tout le jour, et garde ses heures', () => {
    const heures = { closing: 22 * 60, opening: 8 * 60 };
    const [plage] = closureBandsForRange([NEUF_TREIZE], { from: MARDI, to: MARDI }, heures, () => 'Fermé');
    expect(plage.closureJourEntier).toBe(false);
    expect(new Date(plage.startAt).getHours()).toBe(9);
    expect(new Date(plage.endAt).getHours()).toBe(13);
    const [entiere] = closureBandsForRange([JOURNEE], { from: MARDI, to: MARDI }, heures, () => 'Fermé');
    expect(entiere.closureJourEntier).toBe(true);
    const bloc = closureBandsForRange([BLOC], { from: MARDI, to: '2026-11-06' }, heures, () => 'Fermé');
    expect(bloc.map((bande) => bande.closureJourEntier)).toEqual([false, true, true, false]);
  });

  it('le refus au club propose une autre heure ; journée entière : un autre jour, comme avant', () => {
    expect(closureRefusalText(t, NEUF_TREIZE, 'Gymnase Cosec')).toBe(
      'Le Gymnase Cosec est fermé le mardi 3 novembre de 09:00 à 13:00 (travaux). Choisis une autre heure ou une autre installation.',
    );
    expect(closureRefusalText(t, JOURNEE, 'Gymnase Cosec')).toBe(
      'Le Gymnase Cosec est fermé le mardi 3 novembre (travaux). Choisis un autre jour ou une autre installation.',
    );
  });

  it('le bandeau dit les heures, même sans le jour ; journée entière : comme avant', () => {
    const lieu = 'Gymnase';
    expect(closureBannerText(t, NEUF_TREIZE, { facilityType: lieu }).titre).not.toContain('ce jour-là');
    expect(closureBannerText(t, NEUF_TREIZE, { facilityType: lieu }).titre).toContain('mardi 3 novembre de 09:00 à 13:00');
    expect(closureBannerText(t, JOURNEE, { facilityType: lieu }).titre).toContain('ce jour-là');
  });

  it('le déplacement dit la plage, pas « ce jour-là »', () => {
    expect(closedThatDayText(t, NEUF_TREIZE, 'Gymnase Cosec')).toBe(
      'Le Gymnase Cosec est fermé le mardi 3 novembre de 09:00 à 13:00 (travaux).',
    );
    expect(closedThatDayText(t, JOURNEE, 'Gymnase Cosec')).toBe(
      'Le Gymnase Cosec est fermé ce jour-là (travaux).',
    );
  });

  describe('« Où ? » d un événement de la Ville', () => {
    const lieu = { documentId: 'gym' };
    const fermeture = { ...NEUF_TREIZE, facility: lieu };
    const occupation = (/** @type {string} */ heureDebut, /** @type {string} */ heureFin) => occupationDesLieux({
      fenetre: { date: MARDI, heureDebut, heureFin }, fermetures: [fermeture], installations: [lieu], lectures: [null],
    }).gym;

    it('hors de la plage : pas de fermeture ; 13 h pile comprise', () => {
      expect(occupation('14:00', '16:00').fermeture).toBeNull();
      expect(occupation('13:00', '14:00').fermeture).toBeNull();
      expect(occupation('07:00', '09:00').fermeture).toBeNull();
    });

    it('sur la plage : « Fermeture sur ces heures » ; journée entière : comme avant', () => {
      expect(occupationLabel(t, occupation('10:00', '11:00'))).toBe('Fermeture sur ces heures');
      expect(occupationLabel(t, occupationDesLieux({
        fenetre: { date: MARDI, heureDebut: '10:00', heureFin: '11:00' },
        fermetures: [{ ...JOURNEE, facility: lieu }],
        installations: [lieu],
        lectures: [null],
      }).gym)).toBe('Fermeture ce jour-là');
    });
  });
});
