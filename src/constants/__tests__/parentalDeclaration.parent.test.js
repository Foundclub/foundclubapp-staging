import {
  isBirthdateUnderParentAccountAge,
  isBirthdateUnderParentalAge,
  isMinorParentAccountRequiredError,
  isMinorParentalDeclarationError,
  MINOR_PARENT_ACCOUNT_REQUIRED_SCOPE,
  MINOR_PARENT_ACCOUNT_REQUIRED_UNDER_AGE,
  MINOR_PARENTAL_DECLARATION_MIN_AGE,
} from '@/constants/parentalDeclaration';

// PARENT (2026-09-02) — LE PALIER 13, COTE APP.
//
// Adel : « en dessous de 13 ans, pas le choix d avoir un compte parent pour
// creer un compte ». Le serveur refuse avec SA propre portee
// (`minor_parent_account_required`), distincte de celle de la declaration
// parentale (`minor_parental_declaration`, seuil 15, deja livre) : l ecran
// « Qui es-tu ? » doit ouvrir l ecran « compte parent requis » sur l une, et
// l ecran de declaration sur l autre. Confondre les deux enverrait un enfant
// de 10 ans cocher lui-meme « je suis le parent » — le defaut du 02/09.

const dateDeNaissancePourAge = (age) => {
  const aujourdHui = new Date();
  const date = new Date(Date.UTC(
    aujourdHui.getUTCFullYear() - age,
    aujourdHui.getUTCMonth(),
    aujourdHui.getUTCDate(),
  ));
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 10);
};

const PORTEE_PARENT = 'minor_parent_account_required';
const PORTEE_DECLARATION = 'minor_parental_declaration';

describe('PARENT — le palier 13 est un palier DE PLUS, le seuil 15 ne bouge pas', () => {
  it('les deux seuils sont distincts et dans le bon ordre', () => {
    expect(MINOR_PARENT_ACCOUNT_REQUIRED_UNDER_AGE).toBe(13);
    expect(MINOR_PARENTAL_DECLARATION_MIN_AGE).toBe(15);
    expect(MINOR_PARENT_ACCOUNT_REQUIRED_SCOPE).toBe(PORTEE_PARENT);
  });

  it('12 ans : compte parent requis ET declaration requise', () => {
    expect(isBirthdateUnderParentAccountAge(dateDeNaissancePourAge(12))).toBe(true);
    expect(isBirthdateUnderParentalAge(dateDeNaissancePourAge(12))).toBe(true);
  });

  it('13 ans revolus : plus de compte parent requis, la declaration reste exigee', () => {
    expect(isBirthdateUnderParentAccountAge(dateDeNaissancePourAge(13))).toBe(false);
    expect(isBirthdateUnderParentalAge(dateDeNaissancePourAge(13))).toBe(true);
  });

  it('16 ans : rien de special', () => {
    expect(isBirthdateUnderParentAccountAge(dateDeNaissancePourAge(16))).toBe(false);
    expect(isBirthdateUnderParentalAge(dateDeNaissancePourAge(16))).toBe(false);
  });

  it('une date ABSENTE ne declenche pas le palier : le formulaire la rend obligatoire', () => {
    expect(isBirthdateUnderParentAccountAge(null)).toBe(false);
    expect(isBirthdateUnderParentAccountAge(undefined)).toBe(false);
    expect(isBirthdateUnderParentAccountAge('pas une date')).toBe(false);
  });
});

describe('PARENT — lire la portee du refus, aux quatre endroits ou elle peut se trouver', () => {
  const refus = (scope) => ({
    details: { details: { requiredUnderAge: 13, scope } },
  });

  it('reconnait le refus « compte parent requis » et SEULEMENT lui', () => {
    expect(isMinorParentAccountRequiredError(refus(PORTEE_PARENT))).toBe(true);
    expect(isMinorParentalDeclarationError(refus(PORTEE_PARENT))).toBe(false);
  });

  it('ne confond pas les deux refus : la declaration reste la declaration', () => {
    expect(isMinorParentAccountRequiredError(refus(PORTEE_DECLARATION))).toBe(false);
    expect(isMinorParentalDeclarationError(refus(PORTEE_DECLARATION))).toBe(true);
  });

  it('lit aussi la forme brute d axios et la forme plate', () => {
    const brute = {
      response: { data: { error: { details: { details: { scope: PORTEE_PARENT } } } } },
    };
    expect(isMinorParentAccountRequiredError(brute)).toBe(true);
    expect(isMinorParentAccountRequiredError({ details: { scope: PORTEE_PARENT } })).toBe(true);
    expect(isMinorParentAccountRequiredError(new Error('Network request failed'))).toBe(false);
    expect(isMinorParentAccountRequiredError(null)).toBe(false);
  });
});
