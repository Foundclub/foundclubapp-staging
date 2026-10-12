import { share } from '../share.web';

// SITE-VILLE-FINITIONS (08/10/2026), tournée T19 (site) — « Inviter un club absent » de la Ville :
// le message « La Ville de Montrivage vous invite à inscrire votre club sur FoundClub : <lien> »
// partait avec le lien AUSSI dans `url` : la plupart des applications collent le texte puis
// l'adresse, le lien s'écrivait deux fois. Le partage du site (navigator.share, ou le
// presse-papiers à défaut) est commun à tous les écrans : la règle y est posée une fois.
//
//   1. CARACTÉRISATION (vert avant) : un message SANS le lien garde le lien à part ;
//   2. un message qui CONTIENT déjà le lien : il ne part plus une deuxième fois (ROUGE avant) ;
//   3. pareil quand le navigateur ne sait pas partager et que tout part au presse-papiers.

const LIEN = 'https://foundclub.app/invitation-ville/abc123';
const navigateurReel = Object.getOwnPropertyDescriptor(global, 'navigator');

const poserNavigateur = (/** @type {any} */ navigateur) => {
  Object.defineProperty(global, 'navigator', { configurable: true, value: navigateur });
};

afterEach(() => {
  if (navigateurReel) Object.defineProperty(global, 'navigator', navigateurReel);
  else delete (/** @type {any} */ (global)).navigator;
});

describe('SVF 5c — un lien partagé depuis le site ne s écrit qu une fois', () => {
  it('🔒 caractérisation : un message sans le lien garde le lien à part', async () => {
    const partager = jest.fn().mockResolvedValue(undefined);
    poserNavigateur({ share: partager });
    await share({ message: 'Découvre cet événement : Tournoi', title: 'Tournoi', url: LIEN });
    expect(partager).toHaveBeenCalledWith({
      text: 'Découvre cet événement : Tournoi', title: 'Tournoi', url: LIEN,
    });
  });

  it('🔴 un message qui contient déjà le lien : le lien ne part pas une deuxième fois', async () => {
    const partager = jest.fn().mockResolvedValue(undefined);
    poserNavigateur({ share: partager });
    const message = `La Ville de Montrivage vous invite sur FoundClub : ${LIEN}`;
    await share({ message, title: 'Invitation de la Ville', url: LIEN });
    expect(partager).toHaveBeenCalledWith({ text: message, title: 'Invitation de la Ville' });
  });

  it('🔴 sans partage du navigateur : le presse-papiers reçoit le lien une seule fois', async () => {
    const copier = jest.fn().mockResolvedValue(undefined);
    poserNavigateur({ clipboard: { writeText: copier } });
    const message = `La Ville de Montrivage vous invite : ${LIEN}`;
    await share({ message, title: 'Invitation', url: LIEN });
    const copie = copier.mock.calls[0][0];
    expect(copie.split(LIEN)).toHaveLength(2);
    expect(copie).toBe(`Invitation\n\n${message}`);
  });
});
