import fs from 'node:fs';
import path from 'node:path';

import { contacterDepuisLaConsole, estUnRefusMineur } from '@/domains/messaging/assistanceConsole';

// ASSISTANCE-MINEURS-CLUB (19/11/2026, D271, partie A) — décisions d'Adel « A1 A / A2 A » :
// l'équipe écrit à un mineur par le fil d'ASSISTANCE (signé « Assistance FoundClub »), jamais
// par un tête-à-tête sous le nom réel de l'admin, que le serveur refuse désormais
// (MINOR_DIRECT_CHAT_FORBIDDEN). « Contacter » dans la console tente le tête-à-tête et, sur ce
// refus, ouvre le fil d'assistance du compte (POST /assistance/conversations/pour/:id).
// ROUGE avant : le module n'existe pas, les deux fiches affichent le refus et s'arrêtent.

const SRC = path.join(__dirname, '..', '..', '..');
const lire = (fichier) => fs.readFileSync(path.join(SRC, fichier), 'utf8');
const refusMineur = {
  response: { data: { error: { details: { code: 'MINOR_DIRECT_CHAT_FORBIDDEN' } } } },
};

describe('ASSISTANCE-A · « Contacter » dans la console', () => {
  it('un majeur : le tête-à-tête, comme avant, sans toucher à l\'assistance', async () => {
    const ouvrirPour = jest.fn();
    const startWhisperChat = jest.fn().mockResolvedValue({ documentId: 'fil-1' });
    const ouvert = await contacterDepuisLaConsole('compte-1', { ouvrirPour, startWhisperChat });
    expect(ouvert).toEqual({ chatId: 'fil-1' });
    expect(startWhisperChat).toHaveBeenCalledWith(['compte-1']);
    expect(ouvrirPour).not.toHaveBeenCalled();
  });

  it('un mineur (refus du serveur) : le fil d\'ASSISTANCE de ce compte', async () => {
    const ouvrirPour = jest.fn().mockResolvedValue({ documentId: 'fil-assistance' });
    const startWhisperChat = jest.fn().mockRejectedValue(refusMineur);
    const ouvert = await contacterDepuisLaConsole('ado-15', { ouvrirPour, startWhisperChat });
    expect(ouvrirPour).toHaveBeenCalledWith('ado-15');
    expect(ouvert).toEqual({ chatId: 'fil-assistance', chatType: 'assistance' });
  });

  it('une autre erreur remonte telle quelle (rien ne s\'ouvre en douce)', async () => {
    const ouvrirPour = jest.fn();
    const panne = new Error('réseau');
    const startWhisperChat = jest.fn().mockRejectedValue(panne);
    await expect(contacterDepuisLaConsole('compte-1', { ouvrirPour, startWhisperChat }))
      .rejects.toBe(panne);
    expect(ouvrirPour).not.toHaveBeenCalled();
  });

  it('le code du refus se lit aux trois formes que rend le client', () => {
    expect(estUnRefusMineur(refusMineur)).toBe(true);
    expect(estUnRefusMineur({ details: { code: 'MINOR_DIRECT_CHAT_FORBIDDEN' } })).toBe(true);
    expect(estUnRefusMineur({ code: 'MINOR_DIRECT_CHAT_FORBIDDEN' })).toBe(true);
    expect(estUnRefusMineur({ code: 'FORBIDDEN' })).toBe(false);
    expect(estUnRefusMineur(null)).toBe(false);
  });

  it('le service appelle la route de l\'équipe, l\'identifiant dans le chemin', () => {
    expect(lire('services/chat/assistanceService.js'))
      .toMatch(/`\/assistance\/conversations\/pour\/\$\{encodeURIComponent\(userDocumentId\)\}`/);
  });

  it('les deux fiches de la console passent par ce module', () => {
    ['views/admin/AdminUserDetail.js', 'views/admin/SuperAdminEntryDetail.js'].forEach((fiche) => {
      const source = lire(fiche);
      expect(source).toMatch(/contacterDepuisLaConsole\(/);
      expect(source).toMatch(/ouvrirConversationAssistancePour/);
    });
  });
});
