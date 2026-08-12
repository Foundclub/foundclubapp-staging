import {
  buildFriendlyMatchAdPayload,
  FRIENDLY_MATCH_WIZARD_STEPS,
  getFriendlyMatchWizardBlockingStep,
  getFriendlyMatchWizardStepCount,
  getFriendlyMatchWizardStepIndex,
  getFriendlyMatchWizardStepIssue,
} from './friendlyMatchWizardSteps';

/**
 * Un brouillon complet, dont chaque test retire ce qu il veut mettre en defaut.
 * @param {any} [overrides]
 * @returns {any}
 */
const makeDraft = (overrides = {}) => ({
  activity: { documentId: 'act-1', name: 'Football' },
  candidateDates: [{ date: '2099-05-12', end: '20:00', start: '18:00' }],
  // D90 — le brouillon porte des LISTES depuis que l annonce peut viser
  // plusieurs categories et plusieurs niveaux (FriendlyMatchWizardContext).
  categories: [{ documentId: 'cat-1', name: 'U15' }],
  description: 'On cherche un match sympa.',
  format: '7v7',
  formatOther: '',
  hostingPreference: 'HOST',
  installation: { documentId: 'inst-1', name: 'Stade Nord' },
  levels: [{ documentId: 'lvl-1', name: 'Departemental' }],
  location: { city: 'Marseille', lat: 43.3, lng: 5.4 },
  refereeing: 'Arbitre fourni',
  section: { documentId: 'sec-1', name: 'Masculine' },
  team: { documentId: 'team-1', name: 'U15 A' },
  travelRadiusKm: 30,
  ...overrides,
});

describe('friendlyMatchWizardSteps — la carte des 7 etapes (§4.1)', () => {
  test('les 7 etapes de la spec sont la, dans l ordre', () => {
    expect(FRIENDLY_MATCH_WIZARD_STEPS).toEqual([
      'team',
      'hosting',
      'dates',
      'location',
      'opponent',
      'description',
      'recap',
    ]);
    expect(getFriendlyMatchWizardStepCount()).toBe(7);
  });

  test('l index affiche commence a 1, pas a 0', () => {
    expect(getFriendlyMatchWizardStepIndex('team')).toBe(1);
    expect(getFriendlyMatchWizardStepIndex('recap')).toBe(7);
  });

  test('une etape inconnue ne casse pas le compteur du gabarit', () => {
    expect(getFriendlyMatchWizardStepIndex('inconnue')).toBe(1);
  });
});

describe('friendlyMatchWizardSteps — ce qui bloque « Suivant »', () => {
  test('sans equipe, l etape 1 bloque', () => {
    expect(getFriendlyMatchWizardStepIssue('team', makeDraft({ team: null }))).toEqual(
      expect.stringContaining('équipe'),
    );
    expect(getFriendlyMatchWizardStepIssue('team', makeDraft())).toBeNull();
  });

  test('le choix « qui recoit » est TOUJOURS explicite (Q1) : rien coche = bloque', () => {
    const issueFor = (/** @type {any} */ preference) => getFriendlyMatchWizardStepIssue(
      'hosting',
      makeDraft({ hostingPreference: preference }),
    );

    expect(issueFor('')).not.toBeNull();
    expect(issueFor('PEUT-ETRE')).not.toBeNull();
    ['HOST', 'AWAY', 'BOTH'].forEach((preference) => {
      expect(issueFor(preference)).toBeNull();
    });
  });

  test('sans aucune date lisible, l etape 3 bloque', () => {
    expect(getFriendlyMatchWizardStepIssue('dates', makeDraft({ candidateDates: [] })))
      .not.toBeNull();
    expect(getFriendlyMatchWizardStepIssue(
      'dates',
      makeDraft({ candidateDates: [{ date: 'demain' }] }),
    )).not.toBeNull();
  });

  test('une annonce dont TOUTES les dates sont passees naitrait expiree : bloquee', () => {
    const issue = getFriendlyMatchWizardStepIssue(
      'dates',
      makeDraft({ candidateDates: [{ date: '2020-01-01' }] }),
    );
    expect(issue).not.toBeNull();
  });

  test('la localisation est obligatoire, le rayon doit etre un nombre positif', () => {
    expect(getFriendlyMatchWizardStepIssue('location', makeDraft({ location: null })))
      .not.toBeNull();
    expect(getFriendlyMatchWizardStepIssue('location', makeDraft({ travelRadiusKm: 0 })))
      .not.toBeNull();
    expect(getFriendlyMatchWizardStepIssue('location', makeDraft())).toBeNull();
  });

  test('categorie, niveau et format restent facultatifs — sauf « Autre » sans texte', () => {
    expect(getFriendlyMatchWizardStepIssue(
      'opponent',
      makeDraft({ category: null, format: '', level: null }),
    )).toBeNull();

    expect(getFriendlyMatchWizardStepIssue(
      'opponent',
      makeDraft({ format: 'Autre', formatOther: '   ' }),
    )).not.toBeNull();

    expect(getFriendlyMatchWizardStepIssue(
      'opponent',
      makeDraft({ format: 'Autre', formatOther: 'Beach 3v3' }),
    )).toBeNull();
  });

  test('description et arbitrage sont facultatifs (§4.1 etape 6)', () => {
    expect(getFriendlyMatchWizardStepIssue(
      'description',
      makeDraft({ description: '', refereeing: '' }),
    )).toBeNull();
  });
});

describe('friendlyMatchWizardSteps — le recapitulatif ne publie pas un trou', () => {
  test('un brouillon complet ne bloque sur rien', () => {
    expect(getFriendlyMatchWizardBlockingStep(makeDraft())).toBeNull();
    expect(getFriendlyMatchWizardStepIssue('recap', makeDraft())).toBeNull();
  });

  test('le recap renvoie la PREMIERE etape en defaut, pas la derniere', () => {
    const draft = makeDraft({ hostingPreference: '', location: null });
    expect(getFriendlyMatchWizardBlockingStep(draft)).toBe('hosting');
    expect(getFriendlyMatchWizardStepIssue('recap', draft)).not.toBeNull();
  });
});

describe('friendlyMatchWizardSteps — le corps envoye au serveur', () => {
  test('les relations partent en documentId, jamais en objet', () => {
    const payload = buildFriendlyMatchAdPayload(makeDraft());
    expect(payload.team).toBe('team-1');
    expect(payload.category).toBe('cat-1');
    expect(payload.level).toBe('lvl-1');
    expect(payload.section).toBe('sec-1');
    expect(payload.activity).toBe('act-1');
    expect(payload.installation).toBe('inst-1');
  });

  test('le serveur derive city, geohash et lastCandidateDate : on ne les envoie pas', () => {
    const payload = buildFriendlyMatchAdPayload(makeDraft());
    expect(payload).not.toHaveProperty('city');
    expect(payload).not.toHaveProperty('geohash');
    expect(payload).not.toHaveProperty('lastCandidateDate');
    expect(payload).not.toHaveProperty('author');
    expect(payload).not.toHaveProperty('status');
  });

  test('les dates partent nettoyees et triees', () => {
    const payload = buildFriendlyMatchAdPayload(makeDraft({
      candidateDates: [
        { date: '2099-06-01' },
        { date: 'pas une date' },
        { date: '2099-05-12', start: '18:00' },
      ],
    }));
    expect(payload.candidateDates).toEqual([
      { date: '2099-05-12', start: '18:00' },
      { date: '2099-06-01' },
    ]);
  });

  test('« Autre » est remplace par le texte libre, jamais envoye tel quel (§3.4)', () => {
    const payload = buildFriendlyMatchAdPayload(makeDraft({
      format: 'Autre',
      formatOther: '  Beach 3v3  ',
    }));
    expect(payload.format).toBe('Beach 3v3');
  });

  test('« je me deplace » n emporte AUCUN terrain : il n y en a pas a proposer', () => {
    const payload = buildFriendlyMatchAdPayload(makeDraft({ hostingPreference: 'AWAY' }));
    expect(payload.installation).toBeUndefined();
  });

  test('les champs vides sont absents du corps, pas envoyes a chaine vide', () => {
    const payload = buildFriendlyMatchAdPayload(makeDraft({
      categories: [],
      description: '   ',
      format: '',
      levels: [],
      refereeing: '',
    }));
    expect(payload).not.toHaveProperty('description');
    expect(payload).not.toHaveProperty('format');
    expect(payload).not.toHaveProperty('refereeing');
    expect(payload).not.toHaveProperty('category');
    expect(payload).not.toHaveProperty('level');
  });

  test('le rayon part en entier, meme saisi en texte', () => {
    const payload = buildFriendlyMatchAdPayload(makeDraft({ travelRadiusKm: '45' }));
    expect(payload.travelRadiusKm).toBe(45);
  });
});

describe('D90 — le corps porte les categories et les niveaux au PLURIEL', () => {
  test('les 3 categories cochees partent toutes les 3, en documentId', () => {
    const payload = buildFriendlyMatchAdPayload(makeDraft({
      categories: [
        { documentId: 'cat-u15' },
        { documentId: 'cat-u17' },
        { documentId: 'cat-u19' },
      ],
      levels: [{ documentId: 'lvl-d1' }, { documentId: 'lvl-d2' }],
    }));

    expect(payload.categories).toEqual(['cat-u15', 'cat-u17', 'cat-u19']);
    expect(payload.levels).toEqual(['lvl-d1', 'lvl-d2']);
  });

  // 🔒 Le doublon est VOLONTAIRE. Une app restee en arriere ne connait que
  // `category` : sans lui elle afficherait « Catégorie libre » sur une annonce
  // qui vise pourtant U15. Supprimer ces deux lignes casserait ces lecteurs-la
  // sans qu aucune porte s en apercoive.
  test('la premiere valeur repart AUSSI au singulier, pour les lecteurs d avant D90', () => {
    const payload = buildFriendlyMatchAdPayload(makeDraft({
      categories: [{ documentId: 'cat-u15' }, { documentId: 'cat-u17' }],
      levels: [{ documentId: 'lvl-d1' }],
    }));

    expect(payload.category).toBe('cat-u15');
    expect(payload.level).toBe('lvl-d1');
  });

  test('rien de coche : les QUATRE champs sont absents, l annonce est ouverte a tous', () => {
    const payload = buildFriendlyMatchAdPayload(makeDraft({ categories: [], levels: [] }));

    expect(payload).not.toHaveProperty('categories');
    expect(payload).not.toHaveProperty('category');
    expect(payload).not.toHaveProperty('levels');
    expect(payload).not.toHaveProperty('level');
  });

  test('la meme categorie cochee deux fois ne part qu une fois', () => {
    const payload = buildFriendlyMatchAdPayload(makeDraft({
      categories: [{ documentId: 'cat-u15' }, { documentId: 'cat-u15' }, null],
    }));

    expect(payload.categories).toEqual(['cat-u15']);
  });

  test('un brouillon abime (liste absente, valeurs vides) ne fabrique pas de champ vide', () => {
    const payload = buildFriendlyMatchAdPayload(makeDraft({
      categories: undefined,
      levels: [{ name: 'sans identifiant' }],
    }));

    expect(payload).not.toHaveProperty('categories');
    expect(payload).not.toHaveProperty('levels');
  });
});
