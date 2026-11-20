import { getHeaderTitle } from '@/components/molecules/eventCard/EventCardNew';

import { familleDeLEvenement, motifDuType, nomAfficheDuType } from '../nomDuTypeAffiche';

// INSCRIPTION-CODE-5 (20/11, point a du chef) — le nom affiché d'un type d'événement, une règle
// pour l'étape « Type », le récapitulatif, le détail et les cartes. Le type reste celui du serveur.

jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));
// La carte tire des modules natifs qu'aucune de ces fonctions pures n'utilise.
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: {} }));
jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => ({}) }));
jest.mock('@/domains/event/useEvent', () => ({ __esModule: true, default: () => ({}) }));
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => () => null);

const { t } = jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next;

/** Les sept types réels du serveur (admin/src/data/event-types.json), plus « Match amical ». */
const TYPES = ["Détection / Séance d'essai", 'Entraînement', 'Stage', 'Tournoi', 'Match', 'Autre', 'Réservation', 'Match amical'];

describe('nomAfficheDuType — le tableau de DECISIONS-E4-LOT4 §5', () => {
  it('nature : Séance, Sortie, Rassemblement… ; « Autre », « Réservation », « Match amical » inchangés', () => {
    expect(TYPES.map((nom) => nomAfficheDuType(nom, 'nature', t))).toEqual([
      'Séance découverte', 'Séance', 'Stage / Camp', 'Rassemblement', 'Sortie', 'Autre', 'Réservation', 'Match amical',
    ]);
  });

  it('combat, individuel, culture : les mots de la famille', () => {
    expect(nomAfficheDuType('Match', 'combat', t)).toBe('Combat / Compétition');
    expect(nomAfficheDuType('Match', 'individuel', t)).toBe('Compétition');
    expect(nomAfficheDuType('Match', 'culture', t)).toBe('Spectacle / Représentation');
    expect(nomAfficheDuType('Entraînement', 'culture', t)).toBe('Cours / Atelier');
  });

  it('sans famille (sport collectif, raquette, inconnu) : le nom du serveur, tel quel', () => {
    expect(TYPES.map((nom) => nomAfficheDuType(nom, null, t))).toEqual(TYPES);
    expect(nomAfficheDuType(undefined, null, t)).toBe('');
    expect(nomAfficheDuType(undefined, 'nature', t)).toBe('');
  });

  it('motifDuType : « Match amical » n’a pas de mot de famille', () => {
    expect(motifDuType('Match amical')).toBeNull();
    expect(motifDuType('MATCH')).toBe('match');
    expect(motifDuType('Entrainement')).toBe('entrainement');
  });
});

describe('familleDeLEvenement — l’activité de l’événement d’abord, celle du lecteur en repli', () => {
  const sortie = { team: { activities: [{ name: 'Spéléologie' }] }, type: { name: 'Match' } };
  const matchDeFoot = { team: { activities: [{ name: 'Football' }] }, type: { name: 'Match' } };

  it('un spéléologue lit « Match » sur un match de foot d’un autre club', () => {
    expect(familleDeLEvenement(matchDeFoot, 'Spéléologie')).toBeNull();
  });

  it('un footballeur lit « Sortie » sur la sortie d’un club de spéléologie', () => {
    expect(familleDeLEvenement(sortie, 'Football')).toBe('nature');
  });

  it('un tournoi sans équipe : son activité ; rien de connu : celle du lecteur', () => {
    expect(familleDeLEvenement({ tournamentActivity: { name: 'Judo' } }, 'Football')).toBe('combat');
    expect(familleDeLEvenement({ team: { activities: [] } }, 'Natation')).toBe('individuel');
    expect(familleDeLEvenement({}, '')).toBeNull();
  });
});

describe('getHeaderTitle (puce des cartes) — le mot de la famille, en majuscules', () => {
  it('sans famille : les libellés d’aujourd’hui (non-régression)', () => {
    expect(getHeaderTitle('Match', {})).toBe('MATCH');
    expect(getHeaderTitle('Tournoi', {})).toBe('TOURNOI');
    expect(getHeaderTitle('Stage', {}, null)).toBe('STAGE');
  });

  it('🔴 spéléologie : « SORTIE », « SÉANCE », « RASSEMBLEMENT »', () => {
    expect(getHeaderTitle('Match', {}, 'nature')).toBe('SORTIE');
    expect(getHeaderTitle('Entraînement', {}, 'nature')).toBe('SÉANCE');
    expect(getHeaderTitle('Tournoi', {}, 'nature')).toBe('RASSEMBLEMENT');
  });

  it('« Match amical » et « Réservation » gardent leur puce, même en spéléologie', () => {
    expect(getHeaderTitle('Match amical', {}, 'nature')).toBe('MATCH');
    expect(getHeaderTitle('Réservation', {}, 'nature')).toBe(getHeaderTitle('Réservation', {}));
  });
});
