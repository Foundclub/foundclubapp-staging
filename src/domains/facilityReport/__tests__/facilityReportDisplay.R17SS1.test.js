/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
// R17-SIGNALER-1 (19/10/2026, REC17-011) — les regles d affichage du signalement d installation.
// Q7 B (registre des mineurs ligne 33) : la photo a partir de 15 ans, age inconnu = pas de photo.
// Q2 A : le nom de l auteur n est ecrit que s il est rendu (un encadrant). Q4 A : la fermeture
// pre-remplie. Les ages se calculent sur l horloge REELLE : les dates en sont deduites.
import {
  canAttachReportPhoto,
  closureParamsFromReport,
  reportAuthorLabel,
  reportStatusTone,
  reportStepCount,
  securityHistory,
  shouldProposeResolved,
  splitReports,
} from '../facilityReportDisplay';

const ilYa = (/** @type {number} */ ans, /** @type {number} */ jours = 0) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - ans);
  date.setDate(date.getDate() + jours);
  return date.toISOString().slice(0, 10);
};

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

describe('R17SS1 — affichage du signalement d installation', () => {
  it('Q7 B : la photo a partir de 15 ans ; en dessous ou sans date, pas de photo', () => {
    expect(canAttachReportPhoto(ilYa(16))).toBe(true);
    expect(canAttachReportPhoto(ilYa(15, -1))).toBe(true);
    expect(canAttachReportPhoto(ilYa(15, 2))).toBe(false);
    expect(canAttachReportPhoto(ilYa(12))).toBe(false);
    expect(canAttachReportPhoto(null)).toBe(false);
    expect(canAttachReportPhoto('')).toBe(false);
  });

  it('Q2 A : un encadrant par son nom, les autres par leur role et leur club', () => {
    const nomme = reportAuthorLabel(t, { author: { name: 'Lucas Morel', role: 'entraineur' }, club: { name: 'AS Montrivage' } });
    expect(nomme).toBe('facilityReports.auteurNomme{"club":"AS Montrivage","name":"Lucas Morel","role":"facilityReports.roles.entraineur"}');
    const anonyme = reportAuthorLabel(t, { author: { name: null, role: 'joueur' }, club: { name: 'AS Montrivage' } });
    expect(anonyme).toBe('facilityReports.auteurAnonyme{"club":"AS Montrivage","role":"facilityReports.roles.joueur"}');
  });

  it('les statuts : leur ton et leurs etapes', () => {
    expect(['envoye', 'pris_en_charge', 'resolu', 'sans_suite'].map(reportStatusTone))
      .toEqual(['warning', 'primary', 'success', 'neutral']);
    expect(['envoye', 'pris_en_charge', 'resolu', 'sans_suite'].map(reportStepCount)).toEqual([1, 2, 3, 3]);
  });

  it('les ouverts, la securite d abord ; les traites, et l historique avec les fermetures', () => {
    const reports = [
      {
        category: 'eclairage', createdAt: '2026-10-18T10:00:00Z', documentId: 'a', status: 'envoye',
      },
      {
        category: 'securite', createdAt: '2026-10-16T10:00:00Z', documentId: 'b', status: 'pris_en_charge',
      },
      {
        category: 'proprete', closedAt: '2026-10-14T10:00:00Z', createdAt: '2026-10-06T10:00:00Z', documentId: 'c', status: 'resolu',
      },
    ];
    const { ouverts, traites } = splitReports(reports);
    expect(ouverts.map((r) => r.documentId)).toEqual(['b', 'a']);
    expect(traites.map((r) => r.documentId)).toEqual(['c']);
    const jalons = securityHistory(traites, [
      { documentId: 'f1', kind: 'closure', startDate: '2026-10-05' },
      { documentId: 'f2', kind: 'block', startDate: '2026-10-15' },
    ]);
    expect(jalons.map((j) => `${j.kind}:${j.item.documentId}`)).toEqual(['report:c', 'closure:f1']);
  });

  it('Q4 A : la fermeture finie (rouverte ou passee) propose « Résolu »', () => {
    const pris = { closure: { endDate: '2026-10-21', status: 'active' }, status: 'pris_en_charge' };
    expect(shouldProposeResolved(pris, '2026-10-20')).toBe(false);
    expect(shouldProposeResolved(pris, '2026-10-22')).toBe(true);
    expect(shouldProposeResolved({ ...pris, closure: { endDate: '2026-12-01', status: 'reopened' } }, '2026-10-20')).toBe(true);
    expect(shouldProposeResolved({ ...pris, status: 'resolu' }, '2026-10-22')).toBe(false);
    expect(shouldProposeResolved({ status: 'pris_en_charge' }, '2026-10-22')).toBe(false);
  });

  it('Q4 A : les parametres du formulaire de fermeture pre-rempli', () => {
    const params = closureParamsFromReport(
      { documentId: 'sig-1', facility: { documentId: 'gym', name: 'Gymnase des Tilleuls' } },
      { message: 'Panier casse : installation fermée le temps de la réparation.', reason: 'travaux', startDate: '2026-10-21' },
      'ville-1',
    );
    expect(params).toEqual({
      collectiviteId: 'ville-1',
      date: '2026-10-21',
      facilityId: 'gym',
      facilityName: 'Gymnase des Tilleuls',
      message: 'Panier casse : installation fermée le temps de la réparation.',
      mode: 'fermer',
      motif: 'travaux',
      reportId: 'sig-1',
    });
  });
});
