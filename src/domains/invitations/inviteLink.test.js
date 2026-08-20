/**
 * Temoins E6 du lot Y03 — lecture d'un lien d'invitation.
 *
 * Ces tests decrivent le SEUL point d'entree du systeme d'invitation :
 * une fonction pure qui dit « ceci est une invitation pour <sujet>/<id> »
 * ou « ceci n'en est pas une, et voici pourquoi ».
 *
 * Invariant non negociable (PROMPT_Y03) : aucune adhesion ne peut etre
 * declenchee par la lecture d'un lien. Cette fonction ne fait QUE lire.
 */
import {
  buildInviteWebUrl,
  INVITE_SUBJECTS,
  parseInviteLink,
  readInviteLink,
} from './inviteLink';

describe('inviteLink — lecture d un lien d invitation', () => {
  describe('le lien web canonique /i/<sujet>/<id>', () => {
    it('reconnait une invitation d equipe', () => {
      expect(parseInviteLink('https://foundclub.app/i/team/team-doc-123')).toEqual({
        id: 'team-doc-123',
        subject: 'team',
      });
    });

    it('reconnait une invitation d evenement — le MEME systeme', () => {
      expect(parseInviteLink('https://foundclub.app/i/event/event-doc-55')).toEqual({
        id: 'event-doc-55',
        subject: 'event',
      });
    });

    it('reconnait une squad League et un club', () => {
      expect(parseInviteLink('https://foundclub.app/i/squad/sq-9')?.subject).toBe('squad');
      expect(parseInviteLink('https://foundclub.app/i/club/cl-4')?.subject).toBe('club');
    });

    it('accepte le domaine de recette et le www', () => {
      expect(parseInviteLink('https://staging.foundclub.app/i/team/t-1')?.id).toBe('t-1');
      expect(parseInviteLink('https://www.foundclub.app/i/team/t-1')?.id).toBe('t-1');
    });

    it('ignore les parametres de mesure sans les confondre avec le sujet', () => {
      expect(parseInviteLink('https://foundclub.app/i/team/t-1?utm_source=sms&utm_medium=qr')).toEqual({
        id: 't-1',
        subject: 'team',
      });
    });

    it('decode un identifiant echappe', () => {
      expect(parseInviteLink('https://foundclub.app/i/team/t%20-1')?.id).toBe('t -1');
    });
  });

  describe('les liens deja envoyes aujourd hui (compatibilite)', () => {
    it('lit le lien de partage historique install.html', () => {
      expect(parseInviteLink('https://api.foundclubpro.com/install.html?type=team&id=t-7&invite=true&source=sms')).toEqual({
        id: 't-7',
        subject: 'team',
      });
    });

    it('lit le schema applicatif foundclub:// quand il porte le drapeau invite', () => {
      expect(parseInviteLink('foundclub://team/t-8?invite=true')).toEqual({
        id: 't-8',
        subject: 'team',
      });
    });

    it('ramene les alias League (league_team, league-squad) sur squad', () => {
      expect(parseInviteLink('foundclub://squad/sq-2?invite=1')?.subject).toBe('squad');
      expect(parseInviteLink('https://api.foundclubpro.com/install.html?type=league_team&id=sq-3&invite=true')?.subject).toBe('squad');
    });
  });

  describe('🔒 ce qui n est PAS une invitation ne doit JAMAIS le devenir', () => {
    it('un lien de navigation simple n est pas une invitation', () => {
      expect(parseInviteLink('foundclub://team/t-9')).toBeNull();
      expect(readInviteLink('foundclub://team/t-9').reason).toBe('not-an-invite');
    });

    it('une page publique du site n est pas une invitation', () => {
      expect(parseInviteLink('https://foundclub.app/teams/t-9')).toBeNull();
      expect(parseInviteLink('https://foundclub.app/annuaire/')).toBeNull();
    });

    it('un domaine etranger portant le meme chemin est refuse', () => {
      expect(parseInviteLink('https://foundclub.com.attaquant.example/i/team/t-1')).toBeNull();
      expect(readInviteLink('https://mechant.example/i/team/t-1').reason).toBe('foreign-host');
    });

    it('un sujet inconnu est refuse et dit pourquoi', () => {
      expect(readInviteLink('https://foundclub.app/i/licorne/x-1').reason).toBe('unknown-subject');
    });

    it('un identifiant absent est refuse et dit pourquoi', () => {
      expect(readInviteLink('https://foundclub.app/i/team/').reason).toBe('missing-id');
      expect(readInviteLink('https://foundclub.app/i/team/%20%20').reason).toBe('missing-id');
    });

    it('une entree vide ou illisible ne casse jamais', () => {
      const scriptUrl = `${'java'}${'script'}:alert(1)`;
      ['', null, undefined, 42, {}, 'pas une url', scriptUrl].forEach((value) => {
        expect(parseInviteLink(/** @type {any} */ (value))).toBeNull();
      });
    });
  });

  describe('🔒 aucune donnee personnelle dans l adresse', () => {
    it('ne construit qu un sujet et un identifiant', () => {
      expect(buildInviteWebUrl({ id: 't-1', origin: 'https://foundclub.app', subject: 'team' }))
        .toBe('https://foundclub.app/i/team/t-1');
    });

    it('refuse de construire un lien sans sujet connu ou sans identifiant', () => {
      expect(buildInviteWebUrl({ id: '', subject: 'team' })).toBeNull();
      expect(buildInviteWebUrl({ id: 't-1', subject: 'licorne' })).toBeNull();
    });

    it('fait l aller-retour construction -> lecture pour chaque sujet', () => {
      INVITE_SUBJECTS.forEach((subject) => {
        const url = buildInviteWebUrl({ id: 'abc-1', origin: 'https://foundclub.app', subject });
        expect(parseInviteLink(url)).toEqual({ id: 'abc-1', subject });
      });
    });
  });
});
