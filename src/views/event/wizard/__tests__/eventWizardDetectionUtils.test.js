import {
  getActiveStageScheduleDays,
  getEventWizardAccessStepIndex,
  getEventWizardDescriptionStepIndex,
  getEventWizardInvitesStepIndex,
  getEventWizardLocationStepIndex,
  getEventWizardLogisticsStepIndex,
  getEventWizardOpponentStepIndex,
  getEventWizardParticipantsStepIndex,
  getEventWizardRecapStepIndex,
  getEventWizardSportName,
  getEventWizardStageProgramStepIndex,
  getEventWizardStepCount,
  getEventWizardStepRoutes,
  getEventWizardTournamentSettingsStepIndex,
  getEventWizardTournamentStructureStepIndex,
  hasCompletePerDayLocations,
  hasValidStageDayLocation,
  isDetectionEventType,
  isStageEventType,
  isTournamentEventType,
  isTrainingEventType,
  normalizeTypeLabel,
  shouldExplainDetectionSlotsDisabled,
  shouldOfferDetectionSlots,
  shouldSkipEventWizardLocationStep,
  shouldSkipEventWizardParticipantsStep,
} from '../eventWizardDetectionUtils';

// Filet D08 (E6) : le tunnel de creation d'evenement fait 14 ecrans et 8 427
// lignes, et n'avait AUCUN test. Ce fichier est la moitie PURE du filet : il
// fige les NUMEROS que rend la machine (combien d'etapes, et a quelle place se
// trouve chaque ecran) pour chacun des parcours.
//
// Les index sont 1-BASES (le 1er ecran est a l'index 1) et la valeur 0 ne veut
// pas dire « premier » mais « cet ecran n'appartient pas a ce parcours ».
//
// ETAT DU 2026-08-06, APRES D08. Le lot a ramene l'evenement simple a 8 etapes,
// en sortant `EventWizardInvites` de la chaine (il se rejoint depuis le Recap)
// et en fusionnant « Visibilite » et « Mode de validation » dans un seul ecran
// `EventWizardAccess`. Les tournois et les stages gardent tous leurs ecrans.
//
// La moitie TRANSITIONS du filet (quel ecran mene a quel ecran) vit dans
// `eventWizardChain.test.js`. Depuis D08 les deux moities decoulent de la MEME
// liste ordonnee (`getEventWizardStepRoutes`) : elles ne peuvent plus diverger,
// alors qu'elles etaient tenues d'accord a la main jusque-la.

const typeStage = { name: 'Stage' };
const typeTournoi = { name: 'Tournoi' };
const typeEntrainement = { name: 'Entrainement' };
const typeDetection = { name: 'Detection' };
const typeMatch = { name: 'Match' };

const equipeFootball = { sport: { name: 'Football' } };

/** Un evenement de detection qui declenche vraiment l'etape « creneaux ». */
const etatDetectionAvecCreneaux = {
  isRecurrent: false,
  team: equipeFootball,
  type: typeDetection,
};

/** Un entrainement ferme : le seul cas ou l'etape Participants est sautee. */
const etatEntrainementFerme = {
  sessionStatus: 'closed',
  type: typeEntrainement,
};

describe('D08 — reconnaissance du type d evenement', () => {
  test('normalizeTypeLabel enleve accents, casse et espaces de bord', () => {
    expect(normalizeTypeLabel('  Détection  ')).toBe('detection');
    expect(normalizeTypeLabel('ENTRAÎNEMENT')).toBe('entrainement');
    expect(normalizeTypeLabel(null)).toBe('');
  });

  test('la reconnaissance se fait par SOUS-CHAINE, pas par egalite', () => {
    // Consequence mesuree : un type nomme « Tournoi de detection » serait
    // reconnu par les DEUX predicats a la fois.
    expect(isTournamentEventType('Tournoi de detection')).toBe(true);
    expect(isDetectionEventType('Tournoi de detection')).toBe(true);
  });

  test('chaque predicat reconnait son type et rejette les autres', () => {
    expect(isStageEventType('Stage')).toBe(true);
    expect(isTournamentEventType('Tournoi')).toBe(true);
    expect(isTrainingEventType('Entrainement')).toBe(true);
    expect(isDetectionEventType('Detection')).toBe(true);

    expect(isStageEventType('Match')).toBe(false);
    expect(isTournamentEventType('Match')).toBe(false);
    expect(isTrainingEventType('Match')).toBe(false);
    expect(isDetectionEventType('Match')).toBe(false);
  });
});

describe('D08 — getEventWizardStepCount : combien d etapes, par parcours', () => {
  test('un evenement standard compte 8 etapes', () => {
    expect(getEventWizardStepCount({ type: typeEntrainement })).toBe(8);
    expect(getEventWizardStepCount({ type: typeAutre })).toBe(8);
  });

  // 🎯 LA LIGNE QUE Y02 FAIT BOUGER, et la SEULE : 8 → 9, pour le match seul.
  // L'etape neuve est « Contre qui ? » (idee d'Adel du 2026-08-19). Aucun autre
  // parcours ne la traverse — c'est la non-regression du lot.
  // 🔁 AA10 : 9 → 10. L'etape « Invitations », que D08 avait sortie de la chaine,
  // y revient POUR LE MATCH SEUL (constat ② d'Adel du 2026-08-20).
  test('un match compte 10 etapes depuis AA10 : « Contre qui ? » et « Invitations »', () => {
    expect(getEventWizardStepCount({ type: typeMatch })).toBe(10);
  });

  test('un stage compte 8 etapes : il garde son programme, il gagne la fusion', () => {
    // Le stage n'a jamais eu ni l'etape Invites ni l'etape Logistique. Il perd
    // donc UNE etape, celle gagnee par la fusion visibilite + validation, et
    // conserve son ecran « Programme du stage ».
    expect(getEventWizardStepCount({ type: typeStage })).toBe(8);
  });

  test('un tournoi compte toujours 10 etapes', () => {
    // Le tournoi ne traversait ni Invites ni « Mode de validation » : ni la
    // sortie de l'un ni la fusion de l'autre ne lui retirent quoi que ce soit.
    expect(getEventWizardStepCount({ type: typeTournoi })).toBe(10);
  });

  test('une detection avec postes compte 8 etapes — D58 les a fondus', () => {
    // Avant la fusion du 2026-08-10 : 9. Les postes recherches etaient un ecran.
    expect(getEventWizardStepCount(etatDetectionAvecCreneaux)).toBe(8);
  });

  test('un standard dont l etape Participants est sautee compte 7 etapes', () => {
    expect(getEventWizardStepCount(etatEntrainementFerme)).toBe(7);
  });

  test('le compte du stage et du tournoi ignore les creneaux de detection', () => {
    expect(getEventWizardStepCount({
      ...etatDetectionAvecCreneaux,
      type: typeStage,
    })).toBe(8);
    expect(getEventWizardStepCount({
      ...etatDetectionAvecCreneaux,
      type: typeTournoi,
    })).toBe(10);
  });

  test('sans type du tout, la machine repond 8 comme pour un standard', () => {
    expect(getEventWizardStepCount()).toBe(8);
    expect(getEventWizardStepCount({})).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// FILET D58 (E6) — LE COMPTEUR « Etape n/8 », TYPE PAR TYPE
//
// D58 fond les postes recherches dans l'etape Participants pour ramener la
// detection a 8 etapes, comme le pack. Le tunnel est a geometrie variable : le
// nombre d'etapes depend du type, du sport, et de la recurrence. Ce tableau
// fige ce que la machine repond AUJOURD'HUI pour CHAQUE parcours, avant la
// fusion. Apres elle, une seule ligne doit bouger — celle de la detection
// simple sur un sport a postes, 9 → 8. Toute autre ligne qui change est une
// regression, et c'est precisement ce que ce filet est la pour attraper.
// ---------------------------------------------------------------------------

/** Un sport absent de `SPORTS_WITH_POSITIONS` : sa detection n'a pas de postes. */
const equipeSansPostes = { sport: { name: 'Petanque' } };

const typeAutre = { name: 'Autre' };

/** Une detection recurrente : les postes sont indisponibles, l'etape sautait deja. */
const etatDetectionRecurrente = { ...etatDetectionAvecCreneaux, isRecurrent: true };

/** Une detection sur un sport sans postes : rien a demander, l'etape sautait deja. */
const etatDetectionSansPostes = { ...etatDetectionAvecCreneaux, team: equipeSansPostes };

describe('D58 — le compteur d etapes, un cas par type d evenement', () => {
  test.each([
    ['match officiel', { type: typeMatch }, 10],
    ['entrainement ouvert', { type: typeEntrainement }, 8],
    ['entrainement prive', etatEntrainementFerme, 7],
    ['stage', { type: typeStage }, 8],
    ['tournoi', { type: typeTournoi }, 10],
    ['autre', { type: typeAutre }, 8],
    ['detection recurrente', etatDetectionRecurrente, 8],
    ['detection sans postes', etatDetectionSansPostes, 8],
  ])('%s compte %i etapes, et la fusion D58 n y touche pas', (_nom, etat, attendu) => {
    expect(getEventWizardStepCount(etat)).toBe(attendu);
  });

  // 🎯 LA SEULE LIGNE QUE D58 A FAIT BOUGER : 9 → 8. Le pack « Tunnel
  // Evenement » du 2026-08-05 promet 8 etapes ; cette detection-la en comptait
  // 9 parce que les postes recherches formaient un ecran a eux seuls. Les 8
  // autres parcours ci-dessus n'ont pas bouge d'une etape.
  test('la detection simple sur un sport a postes compte 8 etapes — APRES la fusion', () => {
    expect(getEventWizardStepCount(etatDetectionAvecCreneaux)).toBe(8);
  });

  test('hors match et tournoi, aucun parcours ne depasse 8 etapes', () => {
    const parcoursA8Maximum = [
      { type: typeEntrainement },
      etatEntrainementFerme,
      { type: typeStage },
      { type: typeAutre },
      etatDetectionAvecCreneaux,
      etatDetectionRecurrente,
      etatDetectionSansPostes,
    ];

    parcoursA8Maximum.forEach(
      (etat) => expect(getEventWizardStepCount(etat)).toBeLessThanOrEqual(8),
    );
    // Les deux seuls a depasser 8, et chacun pour une raison nommee : le
    // tournoi pour ses deux ecrans de reglages, le match pour son adversaire
    // (Y02) ET ses invitations (AA10).
    expect(getEventWizardStepCount({ type: typeTournoi })).toBe(10);
    expect(getEventWizardStepCount({ type: typeMatch })).toBe(10);
  });
});

describe('D08 — la chaine est ecrite une seule fois, tout en decoule', () => {
  test('l evenement simple traverse 8 ecrans, dans cet ordre', () => {
    expect(getEventWizardStepRoutes({ type: typeEntrainement })).toEqual([
      'EventWizardType',
      'EventWizardTeam',
      'EventWizardLogistics',
      'EventWizardLocation',
      'EventWizardParticipants',
      'EventWizardAccess',
      'EventWizardDescription',
      'EventWizardRecap',
    ]);
  });

  // Y02 : le match, c'est le meme parcours PLUS un ecran, glisse entre la date
  // et le lieu. Savoir qui l'on recoit aide a choisir ou l'on joue.
  test('un match traverse 10 ecrans : « Contre qui ? » puis « Invitations »', () => {
    expect(getEventWizardStepRoutes({ type: typeMatch })).toEqual([
      'EventWizardType',
      'EventWizardTeam',
      'EventWizardLogistics',
      'EventWizardOpponent',
      'EventWizardLocation',
      'EventWizardParticipants',
      // AA10 ② : juste apres les participants, la ou se pense « qui vient ».
      'EventWizardInvites',
      'EventWizardAccess',
      'EventWizardDescription',
      'EventWizardRecap',
    ]);
  });

  test('AUCUN autre type ne traverse « Contre qui ? »', () => {
    [typeStage, typeTournoi, typeEntrainement, typeDetection, typeAutre]
      .forEach((type) => {
        expect(getEventWizardStepRoutes({ type })).not.toContain('EventWizardOpponent');
      });
  });

  // 🔁 AA10 a rouvert cette porte, mais POUR LE MATCH SEULEMENT. Partout
  // ailleurs la regle de D08 tient : l'ecran reste enregistre et joignable
  // depuis le Recap, sans numero d'etape.
  test('EventWizardInvites n appartient qu au parcours MATCH', () => {
    [typeStage, typeTournoi, typeEntrainement, typeDetection, typeAutre]
      .forEach((type) => {
        expect(getEventWizardStepRoutes({ type })).not.toContain('EventWizardInvites');
      });

    expect(getEventWizardStepRoutes({ type: typeMatch })).toContain('EventWizardInvites');
  });

  test('le nombre d etapes est la longueur de la chaine, par construction', () => {
    [
      { type: typeMatch },
      { type: typeStage },
      { type: typeTournoi },
      etatDetectionAvecCreneaux,
      etatEntrainementFerme,
    ].forEach((etat) => {
      expect(getEventWizardStepCount(etat)).toBe(getEventWizardStepRoutes(etat).length);
    });
  });
});

describe('D08 — a quelle place se trouve chaque ecran (index 1-BASE)', () => {
  // Lecture : chaque colonne est un parcours, chaque ligne un ecran. 0 = l'ecran
  // n'appartient pas a ce parcours.
  const parcours = {
    detection: etatDetectionAvecCreneaux,
    // Y02 : « standard » n'est plus represente par un match — le match a
    // desormais une etape de plus, il a donc sa propre colonne.
    match: { type: typeMatch },
    stage: { type: typeStage },
    standard: { type: typeEntrainement },
    tournoi: { type: typeTournoi },
  };

  // Y02 : la colonne `match` est decalee de +1 a partir du LIEU, parce que
  // « Contre qui ? » s'intercale en 4e position.
  // AA10 : elle est decalee de +1 DE PLUS a partir de l'ACCES, parce que
  // « Invitations » s'intercale juste apres les participants. Les colonnes des
  // autres parcours n'ont toujours pas bouge d'un chiffre.
  const attendu = {
    access: {
      detection: 6, match: 8, stage: 6, standard: 6, tournoi: 8,
    },
    description: {
      detection: 7, match: 9, stage: 7, standard: 7, tournoi: 9,
    },
    invites: {
      detection: 0, match: 7, stage: 0, standard: 0, tournoi: 0,
    },
    location: {
      detection: 4, match: 5, stage: 4, standard: 4, tournoi: 4,
    },
    logistics: {
      // 0 pour le stage, et c'est un progres : avant D08 cette fonction rendait
      // 4 pour un stage, alors que le stage n'a jamais eu d'etape Logistique.
      detection: 3, match: 3, stage: 0, standard: 3, tournoi: 3,
    },
    opponent: {
      detection: 0, match: 4, stage: 0, standard: 0, tournoi: 0,
    },
    participants: {
      detection: 5, match: 6, stage: 5, standard: 5, tournoi: 7,
    },
    recap: {
      detection: 8, match: 10, stage: 8, standard: 8, tournoi: 10,
    },
    stageProgram: {
      detection: 0, match: 0, stage: 3, standard: 0, tournoi: 0,
    },
    tournamentSettings: {
      detection: 0, match: 0, stage: 0, standard: 0, tournoi: 5,
    },
    tournamentStructure: {
      detection: 0, match: 0, stage: 0, standard: 0, tournoi: 6,
    },
  };

  const fonctions = {
    access: getEventWizardAccessStepIndex,
    description: getEventWizardDescriptionStepIndex,
    invites: getEventWizardInvitesStepIndex,
    location: getEventWizardLocationStepIndex,
    logistics: getEventWizardLogisticsStepIndex,
    opponent: getEventWizardOpponentStepIndex,
    participants: getEventWizardParticipantsStepIndex,
    recap: getEventWizardRecapStepIndex,
    stageProgram: getEventWizardStageProgramStepIndex,
    tournamentSettings: getEventWizardTournamentSettingsStepIndex,
    tournamentStructure: getEventWizardTournamentStructureStepIndex,
  };

  Object.entries(attendu).forEach(([ecran, parType]) => {
    Object.entries(parType).forEach(([type, index]) => {
      test(`${ecran} est a l index ${index} dans le parcours ${type}`, () => {
        expect(fonctions[ecran](parcours[type])).toBe(index);
      });
    });
  });

  test('une detection est desormais alignee sur le parcours standard', () => {
    // D58 — l'etape « creneaux » n'existe plus : plus rien ne s'insere, donc
    // plus rien ne decale. Une detection et un match ont la MEME numerotation.
    expect(getEventWizardLogisticsStepIndex(etatDetectionAvecCreneaux)).toBe(3);
    expect(getEventWizardLocationStepIndex(etatDetectionAvecCreneaux)).toBe(4);
    expect(getEventWizardParticipantsStepIndex(etatDetectionAvecCreneaux)).toBe(5);
    expect(getEventWizardAccessStepIndex(etatDetectionAvecCreneaux)).toBe(6);
  });

  test('sauter Participants recule les 3 derniers ecrans d un cran', () => {
    expect(getEventWizardAccessStepIndex(etatEntrainementFerme)).toBe(5);
    expect(getEventWizardDescriptionStepIndex(etatEntrainementFerme)).toBe(6);
    expect(getEventWizardRecapStepIndex(etatEntrainementFerme)).toBe(7);
    // ... et l'ecran saute rend 0, « je ne suis pas dans ce parcours ». Avant
    // D08 il rendait encore 7, la place qu'il aurait eue s'il avait ete la.
    expect(getEventWizardParticipantsStepIndex(etatEntrainementFerme)).toBe(0);
  });

  test('le dernier index vaut toujours le nombre total d etapes', () => {
    Object.entries(parcours).forEach(([, etat]) => {
      expect(getEventWizardRecapStepIndex(etat)).toBe(getEventWizardStepCount(etat));
    });
    expect(getEventWizardRecapStepIndex(etatEntrainementFerme))
      .toBe(getEventWizardStepCount(etatEntrainementFerme));
  });
});

describe('D08 — les 4 aiguillages de la machine', () => {
  test('shouldOfferDetectionSlots exige : detection + sport a postes + non recurrent', () => {
    expect(shouldOfferDetectionSlots(etatDetectionAvecCreneaux)).toBe(true);
    expect(shouldOfferDetectionSlots({ ...etatDetectionAvecCreneaux, isRecurrent: true }))
      .toBe(false);
    expect(shouldOfferDetectionSlots({ ...etatDetectionAvecCreneaux, type: typeMatch }))
      .toBe(false);
    expect(shouldOfferDetectionSlots({
      ...etatDetectionAvecCreneaux,
      team: { sport: { name: 'Petanque' } },
    })).toBe(false);
    // Un stage sort AVANT le test « est-ce une detection » : un « Stage de
    // detection » n'aurait jamais l'etape creneaux.
    expect(shouldOfferDetectionSlots({
      ...etatDetectionAvecCreneaux,
      type: { name: 'Stage de detection' },
    })).toBe(false);
  });

  test('shouldExplainDetectionSlotsDisabled est le miroir recurrent du precedent', () => {
    expect(shouldExplainDetectionSlotsDisabled({ ...etatDetectionAvecCreneaux, isRecurrent: true }))
      .toBe(true);
    expect(shouldExplainDetectionSlotsDisabled(etatDetectionAvecCreneaux)).toBe(false);
  });

  test('shouldSkipEventWizardParticipantsStep exige : entrainement + evenement prive', () => {
    expect(shouldSkipEventWizardParticipantsStep(etatEntrainementFerme)).toBe(true);
    expect(shouldSkipEventWizardParticipantsStep({ type: typeEntrainement })).toBe(false);
    expect(shouldSkipEventWizardParticipantsStep({ sessionStatus: 'closed', type: typeMatch }))
      .toBe(false);
    // Le defaut implicite est 'open' : sans sessionStatus, on ne saute pas.
    expect(shouldSkipEventWizardParticipantsStep({
      sessionStatus: undefined,
      type: typeEntrainement,
    })).toBe(false);
  });

  test('shouldSkipEventWizardLocationStep exige un tournoi multi-jours tout servi', () => {
    const journeeAvecLieu = { facilityId: 'inst-1', isActive: true };
    const journeeSansLieu = { isActive: true };
    const tournoiMultiJours = {
      isMultiDayTournament: true,
      stageSchedule: [journeeAvecLieu, journeeAvecLieu],
      type: typeTournoi,
    };

    expect(shouldSkipEventWizardLocationStep(tournoiMultiJours)).toBe(true);
    expect(shouldSkipEventWizardLocationStep({
      ...tournoiMultiJours,
      stageSchedule: [journeeAvecLieu, journeeSansLieu],
    })).toBe(false);
    expect(shouldSkipEventWizardLocationStep({ ...tournoiMultiJours, isMultiDayTournament: false }))
      .toBe(false);
    expect(shouldSkipEventWizardLocationStep({ ...tournoiMultiJours, type: typeStage }))
      .toBe(false);
    // Un programme vide ne saute pas le lieu : `every` sur un tableau vide vaut
    // true, d'ou le garde-fou `activeDays.length > 0`.
    expect(shouldSkipEventWizardLocationStep({ ...tournoiMultiJours, stageSchedule: [] }))
      .toBe(false);
  });
});

describe('D08 — les briques que les aiguillages utilisent', () => {
  test('getActiveStageScheduleDays ne retient que les journees actives', () => {
    const journees = [
      { id: 1, isActive: true },
      { id: 2, isActive: false },
      { id: 3 },
    ];
    // `isActive` absent compte comme ACTIF (le filtre est `!== false`).
    expect(getActiveStageScheduleDays({ stageSchedule: journees }).map((j) => j.id))
      .toEqual([1, 3]);
    expect(getActiveStageScheduleDays({})).toEqual([]);
  });

  test('hasValidStageDayLocation accepte les 4 formes de lieu', () => {
    expect(hasValidStageDayLocation({ facilityId: 'inst-1' })).toBe(true);
    expect(hasValidStageDayLocation({ facility: { documentId: 'doc-1' } })).toBe(true);
    expect(hasValidStageDayLocation({ location: { address: '1 rue du stade' } })).toBe(true);
    expect(hasValidStageDayLocation({ location: { lat: 48.85, lng: 2.35 } })).toBe(true);
    expect(hasValidStageDayLocation({})).toBe(false);
    // Un objet non vide mais sans aucune des cles reconnues ne compte pas.
    expect(hasValidStageDayLocation({ location: { couleur: 'bleu' } })).toBe(false);
  });

  test('hasCompletePerDayLocations exige au moins une journee, toutes servies', () => {
    expect(hasCompletePerDayLocations({ stageSchedule: [{ facilityId: 'a' }] })).toBe(true);
    expect(hasCompletePerDayLocations({ stageSchedule: [] })).toBe(false);
    expect(hasCompletePerDayLocations({ stageSchedule: [{ facilityId: 'a' }, {}] })).toBe(false);
    // Une journee desactivee ne bloque pas : elle est filtree avant le controle.
    expect(hasCompletePerDayLocations({
      stageSchedule: [{ facilityId: 'a' }, { isActive: false }],
    })).toBe(true);
  });

  test('getEventWizardSportName suit un ordre de repli precis', () => {
    expect(getEventWizardSportName({ team: { sport: { name: 'Football' } } })).toBe('Football');
    expect(getEventWizardSportName({ team: { activities: [{ name: 'Handball' }] } }))
      .toBe('Handball');
    expect(getEventWizardSportName({ tournamentActivity: { name: 'Rugby' } })).toBe('Rugby');
    expect(getEventWizardSportName({})).toBe('');
    // Le sport de l'equipe l'emporte sur celui du tournoi.
    expect(getEventWizardSportName({
      team: { sport: { name: 'Football' } },
      tournamentActivity: { name: 'Rugby' },
    })).toBe('Football');
  });
});
