/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
// CORR-COLLECTIVITES point 105 (31/10/2026, decision d Adel A) — un controle « non conforme » ne s affiche
// plus « À jour » : une etiquette « Non conforme » orange. « En retard » reste plus fort (rouge).
import { checkPill } from '../facilityCheckDisplay';

/**
 * Un `t` qui rend la cle : on lit ce que l ecran demande.
 * @param {string} cle - La cle.
 * @returns {string} La cle.
 */
const t = (/** @type {string} */ cle) => cle;

describe('CORR-COLLECTIVITES 105 — la pastille d un controle non conforme', () => {
  const aujourdHui = '2026-10-20';

  it('non conforme et a jour : « Non conforme » orange', () => {
    expect(checkPill(t, { nextDue: '2027-03-12', result: 'non_conforme', state: 'a_jour' }, aujourdHui))
      .toEqual({ label: 'facilityReports.controles.etat.non_conforme', tone: 'warning' });
  });

  it('non conforme et bientot : « Non conforme » orange', () => {
    expect(checkPill(t, { nextDue: '2026-11-12', result: 'non_conforme', state: 'bientot' }, aujourdHui))
      .toEqual({ label: 'facilityReports.controles.etat.non_conforme', tone: 'warning' });
  });

  it('non conforme et en retard : « En retard » rouge reste', () => {
    expect(checkPill(t, { nextDue: '2026-09-02', result: 'non_conforme', state: 'en_retard' }, aujourdHui))
      .toEqual({ label: 'facilityReports.controles.etat.en_retard', tone: 'error' });
  });

  it('conforme : « À jour » vert, inchange', () => {
    expect(checkPill(t, { nextDue: '2027-03-12', result: 'conforme', state: 'a_jour' }, aujourdHui))
      .toEqual({ label: 'facilityReports.controles.etat.a_jour', tone: 'success' });
  });
});
