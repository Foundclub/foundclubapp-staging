import i18next from 'i18next';

import fr from '@/theme/strings/translations/fr';

import {
  aTrancherParLaVille,
  etatDeLaDemande,
  ligneDesDemandesEnAttente,
  pageDAujourdhui,
  pageSuivante,
  plageDeLaVue,
  VUES,
} from '../installationPlanningViews';

// COLL-C2B (02/10) — les 5 vues du planning d une installation : ce que chacune lit, et ou
// menent les fleches. (Les vues proposees et la vue par defaut : temoin COLL-C2B.planningVues.)

const MERCREDI = new Date(2026, 2, 4, 12, 0, 0);

describe('installationPlanningViews — la periode lue par chaque vue', () => {
  it('Jour, Semaine, Liste : la semaine ; 3 jours : veille et lendemain ; Mois : le mois', () => {
    const semaine = { from: '2026-03-02', to: '2026-03-08' };
    expect(plageDeLaVue(VUES.jour, MERCREDI)).toEqual(semaine);
    expect(plageDeLaVue(VUES.semaine, MERCREDI)).toEqual(semaine);
    expect(plageDeLaVue(VUES.liste, MERCREDI)).toEqual(semaine);
    expect(plageDeLaVue(VUES.troisJours, MERCREDI))
      .toEqual({ from: '2026-03-03', to: '2026-03-05' });
    expect(plageDeLaVue(VUES.mois, MERCREDI)).toEqual({ from: '2026-03-01', to: '2026-03-31' });
  });
});

describe('installationPlanningViews — les fleches et « Aujourd hui »', () => {
  it('un jour, trois jours, une semaine, un mois', () => {
    expect(pageSuivante(VUES.jour, MERCREDI, 1).getDate()).toBe(5);
    expect(pageSuivante(VUES.troisJours, MERCREDI, -1).getDate()).toBe(1);
    expect(pageSuivante(VUES.semaine, MERCREDI, 1).getDate()).toBe(11);
    expect(pageSuivante(VUES.liste, MERCREDI, -1).getDate()).toBe(25);
    expect(pageSuivante(VUES.mois, MERCREDI, 1).getMonth()).toBe(3);
  });

  it('« Aujourd hui » ne sert que si la page ne le contient pas', () => {
    const jeudi = new Date(2026, 2, 5, 9, 0, 0);
    expect(pageDAujourdhui(VUES.jour, MERCREDI, jeudi)).toBe(false);
    expect(pageDAujourdhui(VUES.troisJours, MERCREDI, jeudi)).toBe(true);
    expect(pageDAujourdhui(VUES.semaine, MERCREDI, jeudi)).toBe(true);
    expect(pageDAujourdhui(VUES.mois, MERCREDI, new Date(2026, 3, 1))).toBe(false);
  });
});

// 🎨 FINITIONS13-COLL (04/10) — point 8 : la ligne des demandes en attente dit la période de la
// VUE (tournée T13 : « 4 demandes en attente cette semaine » en vue Mois, pour les 9, 13, 16 et
// 27 oct.).
// ROUGE avant le lot (la fonction n'existait pas : la phrase vivait dans l'écran).
describe('FINITIONS13-COLL point 8 — « en attente » dit la période de la vue', () => {
  beforeAll(async () => {
    await i18next.init({ lng: 'fr', resources: { fr: { translation: fr } } });
  });
  const t = i18next.t.bind(i18next);

  it('Jour, 3 jours, Semaine et Liste, Mois : chacune sa période', () => {
    expect(ligneDesDemandesEnAttente(t, VUES.jour, 1)).toBe('1 demande en attente sur ce jour.');
    expect(ligneDesDemandesEnAttente(t, VUES.troisJours, 2))
      .toBe('2 demandes en attente sur ces trois jours.');
    expect(ligneDesDemandesEnAttente(t, VUES.semaine, 2))
      .toBe('2 demandes en attente cette semaine.');
    expect(ligneDesDemandesEnAttente(t, VUES.liste, 1)).toBe('1 demande en attente cette semaine.');
    expect(ligneDesDemandesEnAttente(t, VUES.mois, 4)).toBe('4 demandes en attente ce mois-ci.');
  });
});

// 🏛️ COLL-R-APP-PLANNING (12/10), COL-014 — « Trancher » ouvrait « En attente (0) » alors que le
// bandeau annoncait « 1 demande en attente cette semaine » (Demouville, samedi 10/10, lu en prod
// par le chef : une demande a la Ville restee en attente, DATE PASSEE). La liste suit la regle T05
// du serveur (pending-requests.ts : une demande dont la fin est passee ne se tranche plus ; une
// borne illisible n est JAMAIS perimee) ; le bandeau comptait toute place `pending`.
// UNE regle, celle de la liste : origine « demande », en attente, fin pas passee.
// ROUGE avant le lot (les deux fonctions n existaient pas).
describe('COL-014 — ce que la Ville a a trancher, ecrit une fois', () => {
  const MAINTENANT = new Date('2026-10-11T16:00:00.000Z');
  const bloc = (/** @type {any} */ brut) => ({
    raw: { origin: 'request', pending: true, ...brut },
  });

  it('une demande en attente dont la fin n est pas passee : a trancher', () => {
    const demande = bloc({ endAt: '2026-10-12T13:00:00.000Z' });
    expect(etatDeLaDemande(demande, MAINTENANT)).toBe('aTrancher');
    expect(aTrancherParLaVille(demande, MAINTENANT)).toBe(true);
  });

  it('sa fin est passee : « date passee », plus a trancher (la regle T05 de la liste)', () => {
    const samedi = bloc({ endAt: '2026-10-10T13:00:00.000Z' });
    expect(etatDeLaDemande(samedi, MAINTENANT)).toBe('datePassee');
    expect(aTrancherParLaVille(samedi, MAINTENANT)).toBe(false);
  });

  it('une fin illisible ou absente n est jamais perimee (comme le serveur)', () => {
    expect(etatDeLaDemande(bloc({ endAt: 'pas une date' }), MAINTENANT)).toBe('aTrancher');
    expect(etatDeLaDemande(bloc({ endAt: null }), MAINTENANT)).toBe('aTrancher');
  });

  it('une seance qui attend son dirigeant, ou un creneau, n est pas une demande a la Ville', () => {
    const fin = '2026-10-12T13:00:00.000Z';
    expect(etatDeLaDemande(bloc({ endAt: fin, origin: 'club' }), MAINTENANT)).toBeNull();
    expect(etatDeLaDemande(bloc({ endAt: fin, origin: 'slot' }), MAINTENANT)).toBeNull();
    expect(aTrancherParLaVille(bloc({ endAt: fin, origin: 'club' }), MAINTENANT)).toBe(false);
  });

  it('une demande acceptee n attend plus rien', () => {
    const acceptee = bloc({ endAt: '2026-10-12T13:00:00.000Z', pending: false });
    expect(etatDeLaDemande(acceptee, MAINTENANT)).toBeNull();
    expect(etatDeLaDemande(null, MAINTENANT)).toBeNull();
  });
});
