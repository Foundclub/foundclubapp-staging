import { readFileSync } from 'fs';
import { join } from 'path';

import { showsCityNewsBlock } from '../clubDetailsActionMatrix';

// 👪 CORR-PARENT-APPELS (31/10, fin du point 46, décision d'Adel « A ») — les actualités de
// la Ville ne sont demandées que pour SES clubs. Avant : un compte au rôle Parent posait le
// bloc « De la Ville » sur TOUTES les fiches de club, et le serveur (can-read-club-news)
// répondait 403 partout où aucun de ses enfants ne joue (recette du 29/10, m5).
// Ses clubs, pour le serveur : ceux de ses enfants (fiche déclarée placée dans une équipe, ou
// compte relié). L'app les connaît par les équipes de ses enfants (`useParentTeams`, les mêmes
// lectures que « Mes enfants »), comparées aux équipes du club affiché.

const CLUB = 'as-montrivage';
const EQUIPES_DU_CLUB = [{ documentId: 'u11' }, { documentId: 'u13' }];

describe('CORR-PARENT-APPELS — le bloc « De la Ville » du parent : ses clubs seulement', () => {
  it('un parent dont aucun enfant ne joue ici : pas de bloc, donc pas d\'appel', () => {
    expect(showsCityNewsBlock({
      clubId: CLUB, equipesDesEnfants: ['autre-equipe'], equipesDuClub: EQUIPES_DU_CLUB,
    })).toBe(false);
    expect(showsCityNewsBlock({ clubId: CLUB, equipesDesEnfants: [] })).toBe(false);
  });

  it('un parent dont un enfant joue dans une équipe du club : le bloc', () => {
    expect(showsCityNewsBlock({
      clubId: CLUB, equipesDesEnfants: ['u13'], equipesDuClub: EQUIPES_DU_CLUB,
    })).toBe(true);
  });

  it('la fiche lit les équipes des enfants, et seulement pour un compte Parent', () => {
    const source = readFileSync(join(__dirname, '..', 'ClubDetails.js'), 'utf8');
    expect(source).toMatch(/useParentTeams\(\{\s*enabled: estCompteParent/);
    expect(source).toMatch(/equipesDesEnfants: [^,\n]*teamIds/);
    expect(source).toMatch(/equipesDuClub: club\?\.teams/);
    expect(source).not.toMatch(/isParentRole:/);
  });
});
