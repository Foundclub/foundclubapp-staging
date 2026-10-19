/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
// R17-CONTROLES (20/10/2026, REC17-011 lot 2, decision d Adel Q6 B) — les regles d affichage du carnet des
// controles (planches validees P11-q6-exemple-tel, P10-securite-ordi A, P10-securite-tel 1). Le serveur
// est le seul juge de l etat ; l app le dit en mots : « À jour », « Dans 3 mois », « Avant le 12/03 »,
// « En retard ». Elle propose le prochain controle (un an apres, ou le meme ecart que la fois precedente).
import {
  checkLongDate,
  checkPill,
  checkShortDate,
  currentChecks,
  isoFromPicker,
  pickerFromIso,
  proposedNextDue,
  seriesRows,
} from '../facilityCheckDisplay';

/**
 * Un `t` qui rend la cle et ses valeurs : on lit ce que l ecran demande.
 * @param {string} cle - La cle.
 * @param {any} valeurs - Les valeurs.
 * @returns {string} La cle et ses valeurs.
 */
const t = (/** @type {string} */ cle, /** @type {any} */ valeurs) => (
  valeurs && typeof valeurs === 'object'
    ? `${cle}${JSON.stringify({ ...valeurs, interpolation: undefined })}`
    : cle
);

const LIGNES = [
  {
    current: false, doneOn: '2025-03-10', nextDue: '2026-03-12', series: 's-buts', state: 'en_retard',
  },
  {
    current: true, doneOn: '2026-03-12', nextDue: '2027-03-12', series: 's-buts', state: 'a_jour',
  },
  {
    current: true, doneOn: '2026-01-15', nextDue: '2027-01-15', series: 's-ext', state: 'bientot',
  },
  {
    current: true, doneOn: '2025-09-02', nextDue: '2026-09-02', series: 's-ecl', state: 'en_retard',
  },
];

describe('R17CTRL — affichage du carnet des contrôles', () => {
  it('le carnet : les lignes en cours, la plus urgente d abord', () => {
    expect(currentChecks(LIGNES).map((ligne) => ligne.series)).toEqual(['s-ecl', 's-ext', 's-buts']);
  });

  it('l historique d une série : la plus récente d abord', () => {
    expect(seriesRows(LIGNES, 's-buts').map((ligne) => ligne.doneOn)).toEqual(['2026-03-12', '2025-03-10']);
  });

  it('la pastille : à jour, en retard, bientôt « Dans 3 mois » ou « Avant le 12/03 » sous 30 jours', () => {
    const aujourdHui = '2026-10-20';
    expect(checkPill(t, { nextDue: '2027-03-12', state: 'a_jour' }, aujourdHui)).toEqual({ label: 'facilityReports.controles.etat.a_jour', tone: 'success' });
    expect(checkPill(t, { nextDue: '2026-09-02', state: 'en_retard' }, aujourdHui)).toEqual({ label: 'facilityReports.controles.etat.en_retard', tone: 'error' });
    expect(checkPill(t, { nextDue: '2027-01-15', state: 'bientot' }, aujourdHui)).toEqual({ label: 'facilityReports.controles.dansMois{"count":3}', tone: 'warning' });
    expect(checkPill(t, { nextDue: '2026-11-12', state: 'bientot' }, aujourdHui)).toEqual({ label: 'facilityReports.controles.avantLe{"date":"12/11"}', tone: 'warning' });
  });

  it('le prochain proposé : un an après ; refait, le même écart que la fois précédente', () => {
    expect(proposedNextDue('2026-03-12')).toBe('2027-03-12');
    expect(proposedNextDue('2028-02-29')).toBe('2029-02-28');
    expect(proposedNextDue('2026-10-19', { doneOn: '2024-10-01', nextDue: '2026-10-01' })).toBe('2028-10-18');
    expect(proposedNextDue('')).toBe('');
  });

  it('les dates : la saisie « 12/03/2026 » et la base « 2026-03-12 », dans les deux sens ; les mots', () => {
    expect(isoFromPicker('12/03/2026')).toBe('2026-03-12');
    expect(isoFromPicker('31/02/2026')).toBeNull();
    expect(isoFromPicker('')).toBeNull();
    expect(pickerFromIso('2026-03-12')).toBe('12/03/2026');
    expect(checkLongDate('2027-03-12')).toBe('12 mars 2027');
    expect(checkShortDate('2027-01-15')).toBe('15 janv. 2027');
  });
});
