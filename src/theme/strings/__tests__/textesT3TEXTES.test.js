import { ligneDeDemandeDuClub } from '@/domains/collectivite/collectiviteRattachement';
import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

/**
 * T3-TEXTES (03/11) — les petits tickets de textes du train suivant.
 * « Inviter un club » devient « Ajouter un club » partout (décision d'Adel), et la ligne du club
 * ne dit plus « Tu as accepté » d'une proposition qui attend encore.
 */

const lire = (langue) => JSON.stringify(langue.translation ?? langue);
const t = (_cle, repli, valeurs) => repli
  .replace('{{sujet}}', valeurs.sujet)
  .replace('{{ville}}', valeurs.ville);

describe('T3-TEXTES : « Ajouter un club »', () => {
  it.each([
    ['fr', fr, /Inviter un club/],
    ['en', en, /Invite a club(?! member| player)/],
  ])('%s ne dit plus d\'inviter un club', (_nom, langue, ancien) => {
    expect(lire(langue)).not.toMatch(ancien);
  });

  it('les deux langues disent d\'ajouter un club absent', () => {
    expect(lire(fr)).toContain('Ajouter un club absent de FoundClub');
    expect(lire(en)).toContain('Add a club that is not on FoundClub');
  });
});

describe('T3-TEXTES : la ligne du rattachement, côté club', () => {
  const proposition = {
    collectivite: { name: 'Ville de Montrivage' },
    kind: 'proposal',
    state: 'pending',
  };

  it('une proposition qui attend, club rattaché ailleurs : jamais « Tu as accepté »', () => {
    const ligne = ligneDeDemandeDuClub(t, proposition);
    expect(ligne).not.toMatch(/accepté/);
    expect(ligne).toMatch(/déjà rattaché à une autre Ville/);
  });

  it('un refus reste un refus', () => {
    expect(ligneDeDemandeDuClub(t, { ...proposition, state: 'refused' })).toMatch(/refusé/);
  });

  it.each([
    ['fr', fr],
    ['en', en],
  ])('%s : les 2 clés mortes sont parties, la neuve est là', (_nom, langue) => {
    const { club } = (langue.translation ?? langue).collectiviteRattachement;
    expect(club.accepted).toBeUndefined();
    expect(club.youAccepted).toBeUndefined();
    expect(typeof club.attachedElsewhere).toBe('string');
  });
});
