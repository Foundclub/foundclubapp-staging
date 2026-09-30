import '@/theme/strings';

import i18next from 'i18next';

import { getRecruitmentAdPlayerTitle, getRecruitmentAdSportName } from '../recruitmentAdTitle';

// FINITIONS-AUDIT, point 3 (30/09) — une annonce JOUEUR sans poste (sport sans postes, H2 de
// l'audit V1, acceptee cote serveur depuis RECRUTER-TUNNEL) s'intitulait « Poste non
// spécifié » sur la carte, dans Mes activites et sur la fiche. Elle s'intitule desormais
// « <Sport> — <Catégorie> », « <Sport> » seul sans categorie. UNE fonction, lue par les
// trois ecrans ; le sport se lit comme sur la carte depuis ANNONCES-SPORT.

afterAll(async () => {
  await i18next.changeLanguage('fr');
});

describe('FINITIONS-AUDIT (3) — le titre d une annonce joueur', () => {
  it('avec un poste : le poste, rien d autre (inchange)', () => {
    expect(getRecruitmentAdPlayerTitle({
      category: { name: 'U13' }, position: 'Ailier', sport: 'Basket',
    })).toBe('Ailier');
  });

  it('sans poste : « <Sport> — <Catégorie> »', () => {
    expect(getRecruitmentAdPlayerTitle({ category: { name: 'U13' }, sport: 'Arts martiaux' }))
      .toBe('Arts martiaux — U13');
  });

  it('sans poste ni categorie : le sport seul', () => {
    expect(getRecruitmentAdPlayerTitle({ position: '  ', sport: 'Arts martiaux' }))
      .toBe('Arts martiaux');
  });

  it('le sport se lit comme sur la carte : l annonce, sinon l activite de l equipe', () => {
    const equipe = { activities: [{ name: 'Judo' }], sport: { name: 'Karaté' } };
    expect(getRecruitmentAdSportName({ sport: 'Lutte', team: equipe })).toBe('Lutte');
    expect(getRecruitmentAdSportName({ sport: null, team: equipe })).toBe('Judo');
    expect(getRecruitmentAdSportName({ team: { sport: { name: 'Karaté' } } })).toBe('Karaté');
    expect(getRecruitmentAdPlayerTitle({ category: 'U11', team: equipe })).toBe('Judo — U11');
  });

  it('sans poste ni sport : le repli d avant, traduit', async () => {
    await i18next.changeLanguage('fr');
    expect(getRecruitmentAdPlayerTitle({ category: { name: 'U13' } })).toBe('Poste non spécifié');
    await i18next.changeLanguage('en');
    expect(getRecruitmentAdPlayerTitle({})).toBe('Position not specified');
  });
});
