// BH12 P12-02 : la section choisie porte un documentId en `value` ; le genre se lit dans son NOM.
import { sectionToLeagueGender } from '../sectionGender';

describe('sectionToLeagueGender', () => {
  it('lit le genre dans le libellé, pas dans le documentId', () => {
    expect(sectionToLeagueGender({ label: 'Féminin', value: 'abc123' })).toBe('Female');
    expect(sectionToLeagueGender({ label: 'Mixte', value: 'def456' })).toBe('Mixed');
    expect(sectionToLeagueGender({ label: 'Masculin', value: 'ghi789' })).toBe('Male');
  });
  it('replie sur Male sans section', () => {
    expect(sectionToLeagueGender(undefined)).toBe('Male');
  });
});
