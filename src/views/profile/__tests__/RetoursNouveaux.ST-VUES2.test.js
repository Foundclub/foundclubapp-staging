import { readFileSync } from 'fs';
import { join } from 'path';

import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  buildCoachFeedbackVisit,
  COACH_FEEDBACK_VISIT_KEY,
  countUnseenCoachFeedback,
  readCoachFeedbackSeenAt,
} from '@/domains/profile/coachFeedbackSeen';

import NewItemsPill from '../stats/NewItemsPill';

// ST-VUES2 (02/10) — ÉCRAN 16, « SUIVI » : « 1 NOUVEAU » SUR « RETOURS DU COACH ».
//
// Le design valide (planche 16, état 2) pose une pastille cyan « 1 nouveau » sur la rangée
// « Retours du coach » de mon profil. Le relevé disait : « aucune marque de lecture côté
// serveur ». Il y en a une, inutilisée : la carte des visites du compte
// (`guidanceState.routeVisits`, JSON privé, PATCH /app-guidance/me, rendue par
// /app/bootstrap). La rangée pose la visite `coachFeedback` quand on l'ouvre, et compte
// les retours publiés depuis. Aucune migration, aucune route neuve.

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
  { comment: 'Bien placé', submittedAt: '2026-10-01T20:39:00.000Z' },
  { comment: 'Plus de voix', submittedAt: '2026-09-20T18:00:00.000Z' },
  { comment: 'Sans date' },
];

describe('ST-VUES2 écran 16 — combien de retours du coach sont nouveaux', () => {
  test('jamais ouverts : tous les retours datés sont nouveaux', () => {
    expect(countUnseenCoachFeedback(RETOURS, null)).toBe(2);
  });

  test('ouverts le 25/09 : seul le retour publié depuis est nouveau', () => {
    expect(countUnseenCoachFeedback(RETOURS, '2026-09-25T10:00:00.000Z')).toBe(1);
  });

  test('ouverts après le dernier : aucun ; une liste absente : aucun', () => {
    expect(countUnseenCoachFeedback(RETOURS, '2026-10-02T08:00:00.000Z')).toBe(0);
    expect(countUnseenCoachFeedback(undefined, null)).toBe(0);
  });

  test('la marque se lit dans la réponse de /app/bootstrap', () => {
    const bootstrap = {
      guidanceState: { routeVisits: { coachFeedback: '2026-09-25T10:00:00.000Z' } },
    };

    expect(COACH_FEEDBACK_VISIT_KEY).toBe('coachFeedback');
    expect(readCoachFeedbackSeenAt(bootstrap)).toBe('2026-09-25T10:00:00.000Z');
    expect(readCoachFeedbackSeenAt(null)).toBeNull();
  });

  test('ouvrir la rangée pose la visite « coachFeedback » sur la carte du serveur', () => {
    expect(buildCoachFeedbackVisit(new Date('2026-10-02T09:00:00.000Z'))).toEqual({
      routeVisits: { coachFeedback: '2026-10-02T09:00:00.000Z' },
    });
    const service = readFileSync(
      join(__dirname, '..', '..', '..', 'services', 'auth', 'authService.js'),
      'utf8',
    );
    expect(service).toContain('export const updateMyGuidance = async (payload) => {');
    expect(service).toContain("client.patch('/app-guidance/me', payload)");
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

  test('« Retours du coach » compte, pose la marque, et passe l ancienne à la vue', () => {
    const page = readFileSync(join(__dirname, '..', 'SelfProfilePlayerCoach.js'), 'utf8');

    expect(page).toContain('countUnseenCoachFeedback(');
    expect(page).toContain('personalStats?.recentCoachFeedback');
    expect(page).toContain('readCoachFeedbackSeenAt(appBootstrapData)');
    expect(page).toContain('coachFeedbackSeenBefore: coachFeedbackSeenAt');
    expect(page).toContain('updateMyGuidance(buildCoachFeedbackVisit())');
    expect(page).toContain('badge={unseenCoachFeedbackCount}');
  });
});
