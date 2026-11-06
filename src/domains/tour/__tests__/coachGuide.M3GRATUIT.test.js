import { COACH_GUIDE } from '@/domains/tour/coachGuide';
import { isStepAvailable } from '@/domains/tour/tourGuideEngine';

// M3 GRATUIT (05/11, suite de la réflexion sur le quota du guide) : une série d'un compte
// gratuit ne pose que les dates offertes, le reste est refusé et une feuille s'ouvre en pleine
// mission. La bulle n'invite donc plus à répéter ; la feuille « Répéter » reste à l'écran, le
// serveur juge toujours.

const step = (id) => COACH_GUIDE.steps.find((candidate) => candidate.id === id);
const context = (flags) => ({ created: {}, flags, missionStatus: {} });
const joues = (flags) => COACH_GUIDE.steps
  .filter((candidate) => isStepAvailable(candidate, context(flags)))
  .map((candidate) => candidate.id);

describe('le drapeau, lu au départ', () => {
  it.each([
    ['FREE', true],
    ['TEAM', false],
    ['CLUB', false],
    ['CLUB_UNVERIFIED', false],
    [undefined, false],
  ])('niveau %s : gratuit = %s', (subscriptionAccessLevel, attendu) => {
    const flags = COACH_GUIDE.buildFlags({ subscriptionAccessLevel, userData: {} });
    expect(flags.isFreePlan).toBe(attendu);
  });
});

describe('compte gratuit', () => {
  const ids = joues({ isFreePlan: true });

  it('joue les variantes, jamais les étapes qui parlent de répéter', () => {
    expect(ids).toEqual(expect.arrayContaining(['m3-when-free', 'm3-create-free']));
    expect(ids).not.toContain('m3-when');
    expect(ids).not.toContain('m3-create');
  });

  it('la bulle dit que répéter demande une offre, et ne vise plus le bouton', () => {
    expect(step('m3-when-free').text).toMatch(/offre Équipe/);
    expect(step('m3-when-free').text).not.toMatch(/Touche « Chaque semaine »/);
    expect(step('m3-when-free').targets).not.toContain('eventWizard.repeat');
    expect(step('m3-when-free').subGuides).toBeUndefined();
    expect(step('m3-create-free').text).not.toMatch(/répète/);
  });

  it('la mission avance sur les mêmes gestes', () => {
    expect(step('m3-when-free').advanceOn).toEqual(step('m3-when').advanceOn);
    expect(step('m3-create-free').advanceOn).toEqual(step('m3-create').advanceOn);
    expect(step('m3-create-free').listScrolls).toBe(true);
    expect(step('m3-when-free').veil).toBe(false);
  });
});

describe('avec une offre, ou un guide déjà commencé', () => {
  it.each([
    ['offre', { isFreePlan: false }],
    ['guide commencé avant ce lot, sans le drapeau', {}],
  ])('%s : rien ne change', (_nom, flags) => {
    const ids = joues(flags);
    expect(ids).toEqual(expect.arrayContaining(['m3-when', 'm3-create']));
    expect(ids).not.toContain('m3-when-free');
    expect(ids).not.toContain('m3-create-free');
    expect(step('m3-when').targets).toContain('eventWizard.repeat');
  });
});
