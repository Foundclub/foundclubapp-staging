import {
  getActiveStageScheduleDays,
  getEventWizardDescriptionStepIndex,
  getEventWizardLocationStepIndex,
  getEventWizardLogisticsStepIndex,
  getEventWizardParticipantsStepIndex,
  getEventWizardRecapStepIndex,
  getEventWizardSportName,
  getEventWizardStageProgramStepIndex,
  getEventWizardStepCount,
  getEventWizardTournamentSettingsStepIndex,
  getEventWizardTournamentStructureStepIndex,
  getEventWizardValidationStepIndex,
  getEventWizardVisibilityStepIndex,
  hasCompletePerDayLocations,
  hasValidStageDayLocation,
  isDetectionEventType,
  isStageEventType,
  isTournamentEventType,
  isTrainingEventType,
  normalizeTypeLabel,
  shouldExplainDetectionSlotsDisabled,
  shouldShowDetectionSlotsStep,
  shouldSkipEventWizardLocationStep,
  shouldSkipEventWizardParticipantsStep,
} from '../eventWizardDetectionUtils';

// Filet D08 (E6) : le tunnel de creation d'evenement fait 14 ecrans et 8 427
// lignes, et n'avait AUCUN test. Ce fichier est la moitie PURE du filet : il
// fige les NUMEROS que rend la machine (combien d'etapes, et a quelle place se
// trouve chaque ecran) pour chacun des parcours.
//
// Ce fichier DECRIT le comportement du 2026-08-06, il ne le corrige pas. Les
// bizarreries mesurees sont figees telles quelles et signalees en commentaire,
// notamment : les index sont 1-BASES (le 1er ecran est a l'index 1), et la
// valeur 0 ne veut pas dire « premier » mais « cet ecran n'existe pas dans ce
// parcours ».
//
// La moitie TRANSITIONS du filet (quel ecran mene a quel ecran) vit dans
// `eventWizardChain.test.js` : ces deux moities decrivent la meme chaine par
// deux bouts differents, et c'est volontaire — aujourd'hui elles sont tenues
// synchronisees a la main, sans rien pour le verifier.

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
  test('un stage compte 9 etapes', () => {
    expect(getEventWizardStepCount({ type: typeStage })).toBe(9);
  });

  test('un tournoi compte 10 etapes', () => {
    expect(getEventWizardStepCount({ type: typeTournoi })).toBe(10);
  });

  test('un evenement standard compte 10 etapes', () => {
    expect(getEventWizardStepCount({ type: typeMatch })).toBe(10);
    expect(getEventWizardStepCount({ type: typeEntrainement })).toBe(10);
  });

  test('un standard avec creneaux de detection compte 11 etapes', () => {
    expect(getEventWizardStepCount(etatDetectionAvecCreneaux)).toBe(11);
  });

  test('un standard dont l etape Participants est sautee compte une etape de moins', () => {
    expect(getEventWizardStepCount(etatEntrainementFerme)).toBe(9);
  });

  test('le compte du stage et du tournoi ignore les creneaux de detection', () => {
    // Les deux premiers `if` sortent avant tout calcul : un stage ou un tournoi
    // rend un nombre FIXE, quel que soit le reste de l'etat.
    expect(getEventWizardStepCount({
      ...etatDetectionAvecCreneaux,
      type: typeStage,
    })).toBe(9);
    expect(getEventWizardStepCount({
      ...etatDetectionAvecCreneaux,
      type: typeTournoi,
    })).toBe(10);
  });

  test('sans type du tout, la machine repond 10 comme pour un standard', () => {
    expect(getEventWizardStepCount()).toBe(10);
    expect(getEventWizardStepCount({})).toBe(10);
  });
});

describe('D08 — a quelle place se trouve chaque ecran (index 1-BASE)', () => {
  // Lecture : chaque colonne est un parcours, chaque ligne un ecran. 0 = l'ecran
  // n'appartient pas a ce parcours.
  const parcours = {
    detection: etatDetectionAvecCreneaux,
    stage: { type: typeStage },
    standard: { type: typeMatch },
    tournoi: { type: typeTournoi },
  };

  const attendu = {
    description: {
      detection: 10, stage: 8, standard: 9, tournoi: 9,
    },
    location: {
      detection: 5, stage: 4, standard: 5, tournoi: 4,
    },
    logistics: {
      detection: 4, stage: 4, standard: 4, tournoi: 3,
    },
    participants: {
      detection: 7, stage: 6, standard: 7, tournoi: 8,
    },
    recap: {
      detection: 11, stage: 9, standard: 10, tournoi: 10,
    },
    stageProgram: {
      detection: 0, stage: 3, standard: 0, tournoi: 0,
    },
    tournamentSettings: {
      detection: 0, stage: 0, standard: 0, tournoi: 5,
    },
    tournamentStructure: {
      detection: 0, stage: 0, standard: 0, tournoi: 6,
    },
    validation: {
      detection: 9, stage: 7, standard: 8, tournoi: 0,
    },
    visibility: {
      detection: 6, stage: 5, standard: 6, tournoi: 7,
    },
  };

  const fonctions = {
    description: getEventWizardDescriptionStepIndex,
    location: getEventWizardLocationStepIndex,
    logistics: getEventWizardLogisticsStepIndex,
    participants: getEventWizardParticipantsStepIndex,
    recap: getEventWizardRecapStepIndex,
    stageProgram: getEventWizardStageProgramStepIndex,
    tournamentSettings: getEventWizardTournamentSettingsStepIndex,
    tournamentStructure: getEventWizardTournamentStructureStepIndex,
    validation: getEventWizardValidationStepIndex,
    visibility: getEventWizardVisibilityStepIndex,
  };

  Object.entries(attendu).forEach(([ecran, parType]) => {
    Object.entries(parType).forEach(([type, index]) => {
      test(`${ecran} est a l index ${index} dans le parcours ${type}`, () => {
        expect(fonctions[ecran](parcours[type])).toBe(index);
      });
    });
  });

  test('l index de Logistics ne bouge PAS avec les creneaux de detection', () => {
    // Contre-exemple utile : seuls les 3 ecrans de fin (validation, description,
    // recap) decalent quand l'etape « creneaux » s'insere. Les ecrans d'avant,
    // eux, gardent leur place.
    expect(getEventWizardLogisticsStepIndex(etatDetectionAvecCreneaux)).toBe(4);
    expect(getEventWizardLocationStepIndex(etatDetectionAvecCreneaux)).toBe(5);
    expect(getEventWizardVisibilityStepIndex(etatDetectionAvecCreneaux)).toBe(6);
    expect(getEventWizardParticipantsStepIndex(etatDetectionAvecCreneaux)).toBe(7);
  });

  test('sauter Participants recule les 3 derniers ecrans d un cran', () => {
    expect(getEventWizardValidationStepIndex(etatEntrainementFerme)).toBe(7);
    expect(getEventWizardDescriptionStepIndex(etatEntrainementFerme)).toBe(8);
    expect(getEventWizardRecapStepIndex(etatEntrainementFerme)).toBe(9);
    // ... mais laisse l'index de Participants inchange, alors que l'ecran est
    // saute. Bizarrerie figee telle quelle.
    expect(getEventWizardParticipantsStepIndex(etatEntrainementFerme)).toBe(7);
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
  test('shouldShowDetectionSlotsStep exige : detection + sport a postes + non recurrent', () => {
    expect(shouldShowDetectionSlotsStep(etatDetectionAvecCreneaux)).toBe(true);
    expect(shouldShowDetectionSlotsStep({ ...etatDetectionAvecCreneaux, isRecurrent: true }))
      .toBe(false);
    expect(shouldShowDetectionSlotsStep({ ...etatDetectionAvecCreneaux, type: typeMatch }))
      .toBe(false);
    expect(shouldShowDetectionSlotsStep({
      ...etatDetectionAvecCreneaux,
      team: { sport: { name: 'Petanque' } },
    })).toBe(false);
    // Un stage sort AVANT le test « est-ce une detection » : un « Stage de
    // detection » n'aurait jamais l'etape creneaux.
    expect(shouldShowDetectionSlotsStep({
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
