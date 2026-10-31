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
    expect(checkPill(t, { nextDue: '2027-03-12', state: 'a_jour', result: 'non_conforme' }, aujourdHui))
      .toEqual({ label: 'facilityReports.controles.etat.non_conforme', tone: 'warning' });
  });

  it('non conforme et bientot : « Non conforme » orange', () => {
    expect(checkPill(t, { nextDue: '2026-11-12', state: 'bientot', result: 'non_conforme' }, aujourdHui))
      .toEqual({ label: 'facilityReports.controles.etat.non_conforme', tone: 'warning' });
  });

  it('non conforme et en retard : « En retard » rouge reste', () => {
    expect(checkPill(t, { nextDue: '2026-09-02', state: 'en_retard', result: 'non_conforme' }, aujourdHui))
      .toEqual({ label: 'facilityReports.controles.etat.en_retard', tone: 'error' });
  });

  it('conforme : « À jour » vert, inchange', () => {
    expect(checkPill(t, { nextDue: '2027-03-12', state: 'a_jour', result: 'conforme' }, aujourdHui))
      .toEqual({ label: 'facilityReports.controles.etat.a_jour', tone: 'success' });
  });
});
