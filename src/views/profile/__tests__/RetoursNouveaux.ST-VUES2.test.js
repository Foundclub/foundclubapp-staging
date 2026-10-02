import { readFileSync } from 'fs';
import { join } from 'path';

import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { countNewCoachFeedback } from '@/domains/profile/coachFeedbackSeen';

import NewItemsPill from '../stats/NewItemsPill';

// ST-VUES2 (02/10) — ÉCRAN 16, « SUIVI » : « 1 NOUVEAU » SUR « RETOURS DU COACH ».
//
// UNE SEULE marque « lu » (« lu A », tranché par le chef d'orchestre le 02/10) : celle de
// ST-RETOURS, `coachFeedbackFollow` (une clé par feuille publiée, `feedbackKey` ; un retour
// corrigé et republié redevient nouveau). La pastille compte les retours dont la clé n'est
// pas dans les clés lues du LECTEUR. La vue des retours (ST-RETOURS) les marque lus en
// s'ouvrant. L'ancienne marque de ST-VUES2 (`guidanceState.routeVisits`) sort de ce chemin.

jest.mock(
  'react-i18next',
  () => jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next,
);

jest.mock('@/theme/themeContext', () => {
  const colors = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Colors: colors,
      Fonts: jest.requireActual('@/theme/fonts').default(colors),
    }),
  };
});

const RETOURS = [
  { comment: 'Bien placé', feedbackKey: 'event:m3:u15:v1' },
  { comment: 'Plus de voix', feedbackKey: 'event:m2:u15:v1' },
  { comment: 'Corrigé puis republié', feedbackKey: 'event:m1:u15:v2' },
  { comment: 'Sans clé' },
];

describe('ST-VUES2 écran 16 — les retours du coach nouveaux (marque de ST-RETOURS)', () => {
  test('les retours dont la clé n est pas dans MES clés lues', () => {
    const suivi = { hugo: { seen: ['event:m2:u15:v1', 'event:m1:u15:v1'] } };

    // m3 jamais lu ; m1 lu en v1 mais republié en v2 : nouveau à nouveau.
    expect(countNewCoachFeedback(RETOURS, suivi, 'hugo')).toBe(2);
  });

  test('tout lu : rien ; un retour sans clé ne compte jamais', () => {
    const suivi = { hugo: { seen: ['event:m3:u15:v1', 'event:m2:u15:v1', 'event:m1:u15:v2'] } };

    expect(countNewCoachFeedback(RETOURS, suivi, 'hugo')).toBe(0);
  });

  test('ce qu un PARENT a lu pour son enfant ne compte pas pour moi', () => {
    const suivi = { 'enfant-1': { seen: ['event:m3:u15:v1'] } };

    expect(countNewCoachFeedback(RETOURS, suivi, 'hugo')).toBe(3);
  });

  test('suivi pas encore chargé : la pastille n annonce rien (pas de faux « 3 nouveaux »)', () => {
    expect(countNewCoachFeedback(RETOURS, undefined, 'hugo')).toBe(0);
    expect(countNewCoachFeedback(RETOURS, {}, '')).toBe(0);
    expect(countNewCoachFeedback(undefined, {}, 'hugo')).toBe(0);
  });
});

describe('ST-VUES2 écran 16 — la pastille et son branchement', () => {
  test('la pastille dit « 1 nouveau », « 2 nouveaux »', () => {
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(<NewItemsPill count={1} />);
    });
    expect(arbre.root.findByType(Text).props.children).toBe('1 nouveau');
    act(() => arbre.update(<NewItemsPill count={2} />));
    expect(arbre.root.findByType(Text).props.children).toBe('2 nouveaux');
    act(() => arbre.update(<NewItemsPill count={0} />));
    expect(arbre.toJSON()).toBeNull();
    act(() => arbre.unmount());
  });

  test('« Retours du coach » lit la marque de ST-RETOURS, et UNE seule', () => {
    const page = readFileSync(join(__dirname, '..', 'SelfProfilePlayerCoach.js'), 'utf8');
    const service = readFileSync(
      join(__dirname, '..', '..', '..', 'services', 'auth', 'authService.js'),
      'utf8',
    );

    expect(page).toContain('useGetCoachFeedbackFollow(');
    expect(page).toContain('countNewCoachFeedback(');
    expect(page).toContain('badge={unseenCoachFeedbackCount}');
    // L'ancienne marque (guidanceState) sort de ce chemin.
    expect(page).not.toContain('updateMyGuidance');
    expect(page).not.toContain('coachFeedbackSeenBefore');
    expect(page).not.toContain('readCoachFeedbackSeenAt');
    expect(service).not.toContain('updateMyGuidance');
  });
});
