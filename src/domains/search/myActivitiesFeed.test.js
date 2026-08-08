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

describe('Mes reponses — ce que J AI envoye', () => {
  it('ne titre AUCUN groupe quand je n ai rien envoye', () => {
    expect(buildMyActivitiesSentResponses()).toEqual([]);
  });

  it('affiche le statut de chaque candidature envoyee', () => {
    const lignes = buildMyActivitiesSentResponses({
      sentApplications: [offre({
        applicationStatus: 'accepted',
        team: { club: { name: 'Test FC' }, name: 'Seniors A' },
      })],
    });

    expect(lignes[0].title).toBe('Candidatures envoyées · 1');
    expect(lignes[1]).toMatchObject({
      meta: 'Test FC · Acceptée',
      title: 'Ailier fort — Seniors A',
    });
  });

  it('replie sur « En attente » quand le serveur ne dit rien', () => {
    const lignes = buildMyActivitiesSentResponses({
      sentFriendlyApplications: [match({ applicationStatus: undefined })],
    });
    expect(lignes[1].meta).toBe('En attente');
  });
});
