// I18N-4 : le code teste lit ses textes par i18next (interpolation, pluriels) ;
// ce temoin initialise le VRAI i18next en francais, sans rien changer a ce qu'il affirme.
import '@/theme/strings';

import {
  buildMyActivitiesPublications,
  buildMyActivitiesReceivedResponses,
  buildMyActivitiesSentResponses,
  buildRecruitmentAdTitle,
  pluralize,
} from './myActivitiesFeed';

// Filet du lot D35 (captures 06 et 07). La lecture des donnees est sortie de
// l ecran EXPRES : c est elle qui porte les regles du pack — accord des
// pluriels, groupes vides jamais titres, « 0 candidature » jamais en vitrine —
// et un test qui monte un ecran ne les verrouille pas, il verrouille un rendu.

const offre = (/** @type {any} */ surcharge = {}) => ({
  applications: [],
  applicationsCount: 0,
  category: { name: 'Sénior +18' },
  documentId: 'offre-1',
  isActive: true,
  position: 'Ailier fort',
  section: { name: 'Masculine' },
  sport: 'Basketball',
  team: { documentId: 'eq-1', name: 'Seniors A' },
  ...surcharge,
});

const match = (/** @type {any} */ surcharge = {}) => ({
  applications: [],
  applicationsCount: 0,
  city: 'Marseille',
  documentId: 'match-1',
  hostingPreference: 'BOTH',
  sport: 'Basketball',
  status: 'open',
  team: { documentId: 'eq-1', name: 'Seniors A' },
  ...surcharge,
});

describe('pluralize', () => {
  it('garde le singulier a 0 et a 1', () => {
    expect(pluralize(0, 'candidature')).toBe('0 candidature');
    expect(pluralize(1, 'candidature')).toBe('1 candidature');
  });

  it('accorde a partir de 2', () => {
    expect(pluralize(2, 'candidature')).toBe('2 candidatures');
  });

  it('accepte un pluriel irregulier', () => {
    expect(pluralize(2, 'match proposé', 'matchs proposés')).toBe('2 matchs proposés');
  });
});

describe('buildRecruitmentAdTitle', () => {
  it('assemble le poste et l equipe, comme le pack', () => {
    expect(buildRecruitmentAdTitle(offre())).toBe('Ailier fort — Seniors A');
  });

  it('nomme le role quand l offre vise un entraineur', () => {
    expect(buildRecruitmentAdTitle(offre({
      audienceType: 'coach',
      coachRole: 'Coach adjoint',
    }))).toBe('Coach adjoint — Seniors A');
  });

  // RECRUTER-TUNNEL (audit V1, H3) — capture `H3_role-technique-affiche_1` :
  // « entraineur_adjoint — U13 » dans Mes activites › Publications. Le serveur
  // enregistre la VALEUR de l'enumeration ; l'ecran doit en montrer le libelle.
  it('traduit le role enregistre par le serveur, jamais sa valeur technique', () => {
    expect(buildRecruitmentAdTitle(offre({
      audienceType: 'coach',
      coachRole: 'entraineur_adjoint',
      position: null,
      team: { name: 'U13' },
    }))).toBe('Entraîneur adjoint — U13');
  });

  it('un role « autre » se lit par sa precision', () => {
    expect(buildRecruitmentAdTitle(offre({
      audienceType: 'coach',
      coachRole: 'other',
      coachRoleOther: 'Préparateur mental',
      team: { name: 'U13' },
    }))).toBe('Préparateur mental — U13');
  });

  // FINITIONS-AUDIT (3) : le « Poste non spécifié » d'une annonce sans poste devient
  // « <Sport> — <Catégorie> » ; le nom de l'equipe suit, comme pour toute offre.
  it('sans poste : « Sport — Categorie », puis l equipe', () => {
    expect(buildRecruitmentAdTitle(offre({
      category: { name: 'U13' },
      position: '',
      sport: null,
      team: { activities: [{ name: 'Arts martiaux' }], name: 'Dojo A' },
    }))).toBe('Arts martiaux — U13 — Dojo A');
  });

  it('ne laisse jamais un titre vide', () => {
    expect(buildRecruitmentAdTitle({})).toBe('Poste non spécifié');
  });
});

describe('Publications — ce que j ai publie', () => {
  it('ne titre AUCUN groupe quand il n y a rien', () => {
    expect(buildMyActivitiesPublications()).toEqual([]);
    expect(buildMyActivitiesPublications({ friendlyAds: [], recruitmentAds: [] })).toEqual([]);
  });

  // Le pack : « masques si zero donnee (pas de "0 candidature" en vitrine) ».
  // Un titre de section seul est le meme mensonge : on le verrouille ici.
  it('n annonce pas « Matchs amicaux » quand je n ai propose aucun match', () => {
    const lignes = buildMyActivitiesPublications({ recruitmentAds: [offre()] });
    expect(lignes.filter((ligne) => ligne.type === 'section').map((ligne) => ligne.title))
      .toEqual(['Recrutement · 1 offre']);
  });

  it('groupe par marche, recrutement d abord', () => {
    const lignes = buildMyActivitiesPublications({
      friendlyAds: [match()],
      recruitmentAds: [offre(), offre({ documentId: 'offre-2' })],
    });

    expect(lignes.map((ligne) => ligne.type)).toEqual([
      'section', 'publication', 'publication', 'section', 'publication',
    ]);
    expect(lignes.filter((ligne) => ligne.type === 'section').map((ligne) => ligne.title))
      .toEqual(['Recrutement · 2 offres', 'Matchs amicaux · 1 match proposé']);
  });

  it('compte les candidatures d une offre et la dit en ligne', () => {
    const [, carte] = buildMyActivitiesPublications({
      recruitmentAds: [offre({ applicationsCount: 2 })],
    });

    expect(carte.title).toBe('Ailier fort — Seniors A');
    expect(carte.meta).toBe('Basketball · Sénior +18 · Masculine');
    expect(carte.countLabel).toBe('2 candidatures');
    expect(carte.isOnline).toBe(true);
  });

  it('eteint le point vert d une offre desactivee', () => {
    const [, carte] = buildMyActivitiesPublications({
      recruitmentAds: [offre({ isActive: false })],
    });
    expect(carte.isOnline).toBe(false);
  });

  it('traduit la preference d accueil du match sans la renommer', () => {
    const [, carte] = buildMyActivitiesPublications({ friendlyAds: [match()] });
    expect(carte.meta).toBe('Basketball · Reçoit ou se déplace · Marseille');
    expect(carte.countLabel).toBe('0 proposition');
    expect(carte.isOnline).toBe(true);
  });

  it('eteint le point vert d un match qui ne cherche plus personne', () => {
    const [, carte] = buildMyActivitiesPublications({
      friendlyAds: [match({ status: 'matched' })],
    });
    expect(carte.isOnline).toBe(false);
  });
});

describe('Reponses recues — ce qu on m a repondu', () => {
  it('ne titre AUCUN groupe quand personne n a repondu', () => {
    expect(buildMyActivitiesReceivedResponses({
      friendlyAds: [match()],
      recruitmentAds: [offre()],
    })).toEqual([]);
  });

  it('sort les candidatures de leurs offres et les nomme', () => {
    const lignes = buildMyActivitiesReceivedResponses({
      recruitmentAds: [offre({
        applications: [{
          applicant: { firstName: 'Josh', lastName: 'Miles' },
          documentId: 'cand-1',
          status: 'pending',
        }],
        applicationsCount: 1,
      })],
    });

    expect(lignes[0]).toMatchObject({ title: 'Candidatures reçues · 1', type: 'section' });
    expect(lignes[1]).toMatchObject({
      isNew: true,
      meta: 'Ailier fort — Seniors A',
      title: 'Josh Miles',
      type: 'response',
    });
  });

  // « Nouveau » = jamais repondu. C est la seule lecture possible : rien ne
  // stocke un « lu / non lu » par reponse, ni dans l app ni dans le serveur.
  it('n annonce plus « Nouveau » sur une candidature deja traitee', () => {
    const lignes = buildMyActivitiesReceivedResponses({
      recruitmentAds: [offre({
        applications: [{ applicant: { firstName: 'Lucas' }, documentId: 'c', status: 'accepted' }],
      })],
    });
    expect(lignes[1].isNew).toBe(false);
  });

  it('separe les propositions de match des candidatures', () => {
    const lignes = buildMyActivitiesReceivedResponses({
      friendlyAds: [match({
        applications: [{ documentId: 'p-1', status: 'pending', team: { name: 'Test FC' } }],
      })],
      recruitmentAds: [offre({
        applications: [{ applicant: { firstName: 'Josh' }, documentId: 'c-1', status: 'pending' }],
      })],
    });

    expect(lignes.filter((ligne) => ligne.type === 'section').map((ligne) => ligne.title))
      .toEqual(['Candidatures reçues · 1', 'Propositions reçues · 1']);
    expect(lignes[3]).toMatchObject({
      meta: 'sur Seniors A',
      title: 'Test FC propose un match',
    });
  });
});

// MES-CANDIDATURES (audit V1, A12 + A14 — 01/10). La page du JOUEUR s'appelle
// « Mes candidatures » : une seule liste, rangee en « En attente » et « Reponses
// recues », chaque ligne avec SA date et SON etat (maquette APRES de A12). Avant,
// un seul groupe « Candidatures envoyees · N », sans date : l'auditeur ne savait
// pas dire qu'une candidature datait d'avant son test (A14).
const MAINTENANT = new Date(2026, 8, 30, 12, 0);

const candidature = (/** @type {any} */ statut, /** @type {any} */ dates = {}) => offre({
  applicationStatus: statut,
  myApplication: { status: statut, ...dates },
  team: { club: { name: 'Montrivage FC' }, name: 'Seniors A' },
});

const repondue = (/** @type {string} */ envoi, /** @type {string} */ reponse) => ({
  createdAt: envoi, reviewedAt: reponse,
});

describe('Mes candidatures — ce que J AI envoye (A12, A14)', () => {
  it('ne titre AUCUN groupe quand je n ai rien envoye', () => {
    expect(buildMyActivitiesSentResponses()).toEqual([]);
  });

  it('range en « En attente » puis « Reponses recues », chaque groupe compte les siens', () => {
    const lignes = buildMyActivitiesSentResponses({
      now: MAINTENANT,
      sentApplications: [
        candidature('accepted', repondue('2026-09-20T10:00:00', '2026-09-28T09:00:00')),
        candidature('pending', { createdAt: '2026-09-12T10:00:00' }),
      ],
    });

    expect(lignes.filter((l) => l.type === 'section').map((l) => l.title)).toEqual([
      'En attente · 1',
      'Réponses reçues · 1',
    ]);
    expect(lignes.map((l) => l.type)).toEqual(['section', 'response', 'section', 'response']);
  });

  it('une candidature EN ATTENTE dit quand elle est partie, et qu on attend le club', () => {
    const [, ligne] = buildMyActivitiesSentResponses({
      now: MAINTENANT,
      sentApplications: [candidature('pending', { createdAt: '2026-09-12T10:00:00' })],
    });

    expect(ligne).toMatchObject({
      club: { name: 'Montrivage FC' },
      meta: 'Montrivage FC · envoyée le 12/09',
      statusLabel: 'En attente du club',
      statusTone: 'pending',
      title: 'Ailier fort — Seniors A',
    });
  });

  it('une REPONSE dit quand le club a repondu, et ce qu il a repondu', () => {
    const lignes = buildMyActivitiesSentResponses({
      now: MAINTENANT,
      sentApplications: [
        candidature('accepted', repondue('2026-09-20T10:00:00', '2026-09-28T09:00:00')),
        candidature('declined', repondue('2026-09-02T10:00:00', '2026-09-05T09:00:00')),
      ],
    });

    expect(lignes[1]).toMatchObject({
      meta: 'Montrivage FC · réponse le 28/09', statusLabel: 'Acceptée', statusTone: 'accepted',
    });
    expect(lignes[2]).toMatchObject({
      meta: 'Montrivage FC · réponse le 05/09', statusLabel: 'Refusée', statusTone: 'declined',
    });
  });

  it('la reponse la plus RECENTE vient en tete, quel que soit l ordre d envoi', () => {
    const lignes = buildMyActivitiesSentResponses({
      now: MAINTENANT,
      sentApplications: [
        candidature('declined', repondue('2026-09-25T10:00:00', '2026-09-26T09:00:00')),
        candidature('accepted', repondue('2026-09-01T10:00:00', '2026-09-29T09:00:00')),
      ],
    });

    expect(lignes.slice(1).map((l) => l.statusLabel)).toEqual(['Acceptée', 'Refusée']);
  });

  it('une date d une AUTRE annee porte son annee : « 12/09 » seul ne dit plus laquelle', () => {
    const [, ligne] = buildMyActivitiesSentResponses({
      now: MAINTENANT,
      sentApplications: [candidature('pending', { createdAt: '2025-09-12T10:00:00' })],
    });

    expect(ligne.meta).toBe('Montrivage FC · envoyée le 12/09/2025');
  });

  it('une candidature RETIREE par moi n est pas une reponse : son propre groupe', () => {
    const lignes = buildMyActivitiesSentResponses({
      now: MAINTENANT,
      sentApplications: [candidature('withdrawn', { updatedAt: '2026-09-14T10:00:00' })],
    });

    expect(lignes[0].title).toBe('Retirées · 1');
    expect(lignes[1]).toMatchObject({
      meta: 'Montrivage FC · retirée le 14/09', statusLabel: 'Retirée',
    });
  });

  it('une annonce FERMEE par le club est une reponse, dite comme telle', () => {
    const [, ligne] = buildMyActivitiesSentResponses({
      now: MAINTENANT,
      sentApplications: [candidature('cancelled', { reviewedAt: '2026-09-15T10:00:00' })],
    });

    expect(ligne).toMatchObject({ statusLabel: 'Annonce close', statusTone: 'closed' });
  });

  it('sans date connue, la ligne garde le club et ne dit pas « le » dans le vide', () => {
    const [, ligne] = buildMyActivitiesSentResponses({
      now: MAINTENANT,
      sentApplications: [candidature('pending')],
    });

    expect(ligne.meta).toBe('Montrivage FC');
  });

  it('replie sur « En attente » quand le serveur ne dit rien', () => {
    const lignes = buildMyActivitiesSentResponses({
      now: MAINTENANT,
      sentFriendlyApplications: [match({ applicationStatus: undefined })],
    });

    expect(lignes[0].title).toBe('En attente · 1');
    expect(lignes[1].statusLabel).toBe('En attente du club');
  });

  it('les propositions de match envoyees restent dans la liste — rien ne disparait', () => {
    const lignes = buildMyActivitiesSentResponses({
      now: MAINTENANT,
      sentApplications: [candidature('pending', { createdAt: '2026-09-12T10:00:00' })],
      sentFriendlyApplications: [match({
        applicationStatus: 'accepted',
        myApplication: { reviewedAt: '2026-09-27T09:00:00', status: 'accepted' },
      })],
    });

    expect(lignes.find((l) => l.market === 'amicaux')).toMatchObject({
      meta: 'réponse le 27/09', statusLabel: 'Acceptée', title: 'Seniors A',
    });
    expect(lignes.filter((l) => l.type === 'response')).toHaveLength(2);
  });
});
