// C10BIS · P11-01 / P11-05 — les champs que la personne a VIDES : changes, et vides a l envoi.
// Seuls ceux que le serveur sait effacer. Un champ deja vide au chargement n est jamais nomme :
// c est ce qui protege un profil pas encore charge (tout y vaut '') d un effacement general.
import { listClearedProfileFields } from '@/services/profile/profileSaveConfirmation';

describe('listClearedProfileFields (C10BIS)', () => {
  it('nomme un champ rempli puis vide', () => {
    expect(listClearedProfileFields(
      { nationality: 'Française', position: 'Ailier' },
      { nationality: '', position: 'Ailier' },
    )).toEqual(['nationality']);
  });

  it('ne nomme pas un champ deja vide au chargement', () => {
    expect(listClearedProfileFields({ position: '' }, { position: null })).toEqual([]);
  });

  it('ne nomme jamais un champ que le serveur n efface pas (nom, e-mail, adresse)', () => {
    expect(listClearedProfileFields(
      { address: { label: 'Marseille', value: '1|2' }, email: 'a@b.fr', firstname: 'Luc' },
      { address: null, email: '', firstname: '' },
    )).toEqual([]);
  });

  it('nomme la photo retiree et le numero de maillot vide', () => {
    expect(listClearedProfileFields(
      { avatar: { url: '/uploads/a.jpg' }, jerseyNumber: '10' },
      { avatar: undefined, jerseyNumber: null },
    )).toEqual(['avatar', 'jerseyNumber']);
  });

  it('une nouvelle photo n est pas un effacement', () => {
    expect(listClearedProfileFields(
      { avatar: { url: '/uploads/a.jpg' } },
      { avatar: { uri: 'file:///b.jpg' } },
    )).toEqual([]);
  });
});
