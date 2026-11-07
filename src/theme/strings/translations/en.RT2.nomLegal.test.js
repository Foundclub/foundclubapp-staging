import en from './en';

// RETOURS-TESTEUR-2 (06/11/2026), décisions d'Adel « 129- B » et « 131- A » : les textes légaux
// gardent le nom juridique « Found Club » ; partout ailleurs « FoundClub ». La déclaration de
// responsabilité de l'inscription à un événement (anglais) est le SEUL texte légal concerné ici.
describe('Nom juridique dans la déclaration de responsabilité (en)', () => {
  it('eventList.joinModal.description dit « Found Club », jamais « FoundClub »', () => {
    const texte = en.eventList.joinModal.description;
    expect(texte).toContain('Found Club');
    expect(texte).not.toMatch(/FoundClub/);
  });

  it('la clé voisine (titre de la fenêtre) n est pas touchée', () => {
    const { description, ...autres } = en.eventList.joinModal;
    expect(description).toBeTruthy();
    expect(JSON.stringify(autres)).not.toMatch(/Found Club/);
  });
});
