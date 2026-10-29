import { COACH_GUIDE } from '@/domains/tour/coachGuide';

// GUIDE-FINITIONS-2 (rejeu du guide Entraîneur, 28/10 au soir) :
// - n° 26 : la mission 4 s'appelait « Rechercher » alors que l'acte est de publier
//   une annonce de match amical (captures 17, 36) ;
// - n° 20 : un coach sans club voyait 4 missions sans l'étape « trouve ton club » (75) ;
// - N8 : b2-pub disait « la compo part dans le canal » sur le match d'exemple (46) ;
// - N11 : B1 visait la séance de M3 même déjà passée (capture 39).

const step = (id) => COACH_GUIDE.steps.find((candidate) => candidate.id === id);
const mission = (id) => COACH_GUIDE.missions.find((candidate) => candidate.id === id);

describe('n° 26 — titre de la mission 4', () => {
  it('nomme l’annonce de match amical, plus « Rechercher »', () => {
    expect(mission('coach_m4').title).not.toBe('Rechercher');
    expect(mission('coach_m4').title).toMatch(/match amical/);
  });
});

describe('n° 20 — ouverture d’un coach sans club', () => {
  it('M1 annonce d’abord « trouve ton club » quand il n’a ni club ni équipe', () => {
    const detail = mission('coach_m1').openingDetail;
    expect(typeof detail).toBe('function');
    expect(detail({ hadClub: false, hadTeam: false })).toMatch(/club/);
  });

  it('témoin : avec un club, ou une demande en attente, rien de plus', () => {
    const detail = mission('coach_m1').openingDetail;
    expect(detail({ hadClub: true, hadTeam: false })).toBeFalsy();
    expect(detail({ hadClub: false, hadTeam: true })).toBeFalsy();
    expect(detail({ hadClub: false, hadTeam: false, joinPending: true })).toBeFalsy();
  });

  it('la demande en attente est notée au départ du guide', () => {
    expect(COACH_GUIDE.buildFlags({
      userData: { clubMembershipRequests: [{ club: { documentId: 'c' }, state: 'pending' }] },
    }).joinPending).toBe(true);
  });
});

describe('N8 — b2-pub sur le match d’exemple', () => {
  it('ne promet pas un envoi dans le canal : rien n’est envoyé', () => {
    expect(step('b2-pub').text).not.toMatch(/publie : la compo part dans le canal/);
    expect(step('b2-pub').text).toMatch(/rien n.est envoyé/);
  });
});

describe('N11 — B1 vise la prochaine séance, pas une séance passée', () => {
  const NOW = new Date('2026-10-28T23:05:00Z').getTime();
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('séance du jour déjà finie, série chaque semaine : la suivante', () => {
    const created = {
      'event.created': {
        dates: [
          { date: '2026-10-28T17:00:00Z', documentId: 'ev-1', endDate: '2026-10-28T18:30:00Z' },
          { date: '2026-11-04T17:00:00Z', documentId: 'ev-2', endDate: '2026-11-04T18:30:00Z' },
        ],
        documentId: 'ev-1',
      },
    };
    expect(step('b1-card').targetsFor({ created }))
      .toEqual(['planning.event.ev-2', 'planning.event.next']);
  });

  it('témoin : séance à venir, ou progression d’avant (sans dates) : la séance créée', () => {
    expect(step('b1-card').targetsFor({
      created: {
        'event.created': {
          dates: [{ date: '2026-10-29T17:00:00Z', documentId: 'ev-1', endDate: null }],
          documentId: 'ev-1',
        },
      },
    })).toEqual(['planning.event.ev-1', 'planning.event.next']);
    expect(step('b1-card').targetsFor({
      created: { 'event.created': { documentId: 'ev-1' } },
    })).toEqual(['planning.event.ev-1', 'planning.event.next']);
  });
});
