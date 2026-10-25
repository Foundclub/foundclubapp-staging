/**
 * P12-02 : la section choisie vaut { label: nom, value: documentId } ; le genre se lit dans le nom.
 * L'import d'une equipe source pose deja un code (`value: 'male' | 'female' | 'mixed'`).
 * @param {{ label?: string, value?: string } | undefined | null} section
 * @returns {'Female' | 'Male' | 'Mixed'}
 */
export function sectionToLeagueGender(section) {
  const code = { female: 'Female', male: 'Male', mixed: 'Mixed' }[String(section?.value || '')];
  if (code) return /** @type {'Female' | 'Male' | 'Mixed'} */ (code);
  const name = String(section?.label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (name.includes('mixte') || name.includes('mixed')) return 'Mixed';
  if (name.includes('femin') || name.includes('female')) return 'Female';
  return 'Male';
}
