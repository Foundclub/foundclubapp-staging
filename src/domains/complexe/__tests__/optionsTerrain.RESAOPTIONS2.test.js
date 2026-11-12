/* eslint-disable max-len */
/**
 * RESA-OPTIONS-2 (12/11/2026) — « Modifier les options » de Ma réservation (maquette section 4 bis,
 * décision a de « 233- oui ») : ce que la feuille propose, ses compteurs de départ, et quand le
 * lien se montre. Le serveur reste le juge (PUT /reservations-terrain/:id/options).
 */
import {
  optionsModifiables,
  peutModifierLesOptions,
  quantitesDesFigees,
} from '@/domains/complexe/optionsTerrain';

const CHASUBLES = {
  id: 'a1', name: 'Location de chasubles', price: 9, required: false, unit: 'reservation',
};
const BALLON = {
  id: 'b2', name: 'Ballon de match', price: 4, required: false, unit: 'unite',
};
const ARBITRE = {
  id: 'c3', name: 'Arbitre', price: 20, required: true, unit: 'reservation',
};
const CHASUBLES_FIGEES = {
  id: 'a1', name: 'Location de chasubles', price: 5, quantity: 1, unit: 'reservation',
};

describe('RESA-OPTIONS-2 — les options que la feuille propose', () => {
  it('une option déjà prise garde son prix figé (5 € et non 9 €) ; les autres options du terrain viennent au prix du moment', () => {
    expect(optionsModifiables([CHASUBLES, BALLON], [CHASUBLES_FIGEES])).toEqual([
      {
        id: 'a1', name: 'Location de chasubles', price: 5, required: false, unit: 'reservation',
      },
      BALLON,
    ]);
  });

  it('une option prise puis retirée du terrain reste proposée (on peut la garder ou la baisser) ; l’obligation se lit au terrain', () => {
    expect(optionsModifiables([ARBITRE], [CHASUBLES_FIGEES]).map((option) => option.id)).toEqual(['a1', 'c3']);
    expect(optionsModifiables([{ ...CHASUBLES, required: true }], [CHASUBLES_FIGEES])[0].required).toBe(true);
  });

  it('sans option nulle part : rien à proposer', () => {
    expect(optionsModifiables([], [])).toEqual([]);
    expect(optionsModifiables(undefined, undefined)).toEqual([]);
  });

  it('les compteurs partent des quantités figées ; une option obligatoire pas encore prise part à 1, les autres à 0', () => {
    const modifiables = optionsModifiables([CHASUBLES, BALLON, ARBITRE], [CHASUBLES_FIGEES]);
    expect(quantitesDesFigees(modifiables, [CHASUBLES_FIGEES])).toEqual({ a1: 1, b2: 0, c3: 1 });
  });
});

describe('RESA-OPTIONS-2 — quand « Modifier les options » se montre', () => {
  const base = {
    commence: false, etat: 'confirmee', modifiables: [BALLON], participant: false, reservation: { canCancel: true },
  };
  it('confirmée et encore annulable gratuitement : oui', () => {
    expect(peutModifierLesOptions(base)).toBe(true);
  });
  it('une demande en attente et une réservation en construction : jusqu’au début, comme l’annulation', () => {
    expect(peutModifierLesOptions({ ...base, etat: 'enAttente', reservation: { canCancel: false } })).toBe(true);
    expect(peutModifierLesOptions({ ...base, etat: 'enCollecte', reservation: { canCancel: false } })).toBe(true);
  });
  it('non : après le délai d’annulation gratuite, commencée, pour un participant, sans option à proposer, ou une réservation annulée', () => {
    expect(peutModifierLesOptions({ ...base, reservation: { canCancel: false } })).toBe(false);
    expect(peutModifierLesOptions({ ...base, commence: true })).toBe(false);
    expect(peutModifierLesOptions({ ...base, participant: true })).toBe(false);
    expect(peutModifierLesOptions({ ...base, modifiables: [] })).toBe(false);
    expect(peutModifierLesOptions({ ...base, etat: 'annulee' })).toBe(false);
  });
});
