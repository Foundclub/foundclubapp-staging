/**
 * P12-02 : la section choisie vaut { label: nom, value: documentId } ; le genre se lit dans le nom.
 * @param {{ label?: string } | undefined | null} section
 * @returns {'Female' | 'Male' | 'Mixed'}
 */
export function sectionToLeagueGender(section) {
  const name = String(section?.label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (name.includes('mixte') || name.includes('mixed')) return 'Mixed';
  if (name.includes('femin') || name.includes('female')) return 'Female';
  return 'Male';
}
