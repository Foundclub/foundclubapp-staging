import { describeOnboardingDecision, getOnboardingViews } from '@/domains/auth/authUseCases';
import { storage } from '@/store/appContext';

// FINITIONS18 · POINT 4 (tournee T16) — Hugo, apres une sortie par « retour » puis une
// reouverture (arbre React REMONTE dans le meme moteur JS), arrive sur « Etape 10 sur 13 · Ton
// parcours sportif ». La cause n'est pas etablie (compte rendu du lot) : la ligne
// `[AUTH] ONBOARDING_DECISION` la donnera a la prochaine reproduction. Ce temoin fige ce qu'elle
// dit — et ce qu'elle ne dit PAS (aucune donnee personnelle dans logcat).

jest.mock('../../../store/appContext', () => ({
  storage: { getBoolean: jest.fn(), getString: jest.fn(), set: jest.fn() },
}));

const HUGO = {
  address: '12 rue des Lilas',
  avatar: { url: '/uploads/hugo.jpg' },
  bestLevel: 'Regional',
  birthdate: '2012-03-01',
  category: 'U15',
  documentId: 'xf8nhqxdtl2sipkiq0wmzpxh',
  firstname: 'Hugo',
  height: 160,
  lastname: 'Lemaire',
  myTeams: [{ documentId: 'u15' }],
  parentalDeclarationAccepted: true,
  position: 'Gardien',
  preferredSport: 'Football',
  role: { name: 'Player', type: 'player' },
  section: { documentId: 'section-foot' },
  sportsHistory: null,
  trainedTeams: [],
};

beforeEach(() => {
  /** @type {any} */ (storage.getBoolean).mockReset();
});

test('FIN18-4/1 sans le drapeau de l appareil : la ligne dit la source, le drapeau, le role, les etapes et les champs vides', () => {
  /** @type {any} */ (storage.getBoolean).mockReturnValue(false);
  const onboardingViews = getOnboardingViews(HUGO);
  const ligne = describeOnboardingDecision({
    flag: false, onboardingViews, source: 'bootstrap', userData: HUGO,
  });
  expect(ligne).toBe('[AUTH] ONBOARDING_DECISION source=bootstrap documentId=oui drapeau=false role=player'
    + ' controle=false etapes=UserSportHistory,UserClubSearch vides=sportsHistory equipes=1/0 clubs=0');
});

test('FIN18-4/2 avec le drapeau : le point de controle seul, rien a faire', () => {
  /** @type {any} */ (storage.getBoolean).mockReturnValue(true);
  const ligne = describeOnboardingDecision({
    flag: true, onboardingViews: getOnboardingViews(HUGO), source: 'session', userData: HUGO,
  });
  expect(ligne).toContain('source=session documentId=oui drapeau=true role=player controle=false etapes=aucune');
});

test('FIN18-4/3 une identite sans documentId ni role se lit comme telle (drapeau illisible)', () => {
  const ligne = describeOnboardingDecision({
    flag: null, onboardingViews: undefined, source: 'get-me', userData: { firstname: 'Hugo' },
  });
  expect(ligne).toContain('source=get-me documentId=non drapeau=illisible role=new controle=false etapes=aucune');
  expect(ligne).toContain('vides=lastname,birthdate,section,address,avatar,preferredSport,position,bestLevel,category,sportsHistory,height+weight');
});

test('FIN18-4/4 aucune donnee personnelle dans logcat : ni nom, ni identifiant, ni adresse, ni date', () => {
  /** @type {any} */ (storage.getBoolean).mockReturnValue(false);
  const ligne = describeOnboardingDecision({
    flag: false, onboardingViews: getOnboardingViews(HUGO), source: 'get-me', userData: HUGO,
  });
  ['Hugo', 'Lemaire', HUGO.documentId, 'Lilas', '2012', 'Gardien', 'U15', 'hugo.jpg'].forEach((secret) => {
    expect(ligne).not.toContain(secret);
  });
});
