import {
  getNotificationIcon,
  getNotificationTone,
} from '@/utils/notifications/notificationPresentation';
import { NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

/**
 * COLL-C3B-BIS (03/10) — planche 35 (P6-notifs ; liste du plan, ligne 35) : UNE ICÔNE PAR FAMILLE.
 * Le même type serveur (`overbookingRequest`) porte quatre messages : la demande (à la mairie),
 * l'acceptation et le refus (au club), et l'installation partagée (au club déjà là). La planche
 * leur donne quatre icônes du système de design, sans emoji : calendrier, coche verte, croix
 * rouge, stade. ROUGE avant : un calendrier pour les quatre, et aucune couleur.
 */
const DEMANDE = NOTIFICATION_TYPES.OVERBOOKING_REQUEST;

describe('COLL-C3B-BIS — planche 35 : l icône d une notification de demande de créneau', () => {
  it('la demande, chez la mairie : le calendrier, sans couleur propre', () => {
    expect(getNotificationIcon(DEMANDE, { audience: 'collectivite' })).toBe('calendar');
    expect(getNotificationTone(DEMANDE, { audience: 'collectivite' })).toBeNull();
  });

  it('acceptée, chez le club : la coche, verte', () => {
    const donnees = { collectiviteName: 'Ville de Montrivage', decision: 'approved' };
    expect(getNotificationIcon(DEMANDE, donnees)).toBe('check');
    expect(getNotificationTone(DEMANDE, donnees)).toBe('succes');
  });

  it('refusée, chez le club : la croix, rouge', () => {
    const donnees = { collectiviteName: 'Ville de Montrivage', decision: 'refused' };
    expect(getNotificationIcon(DEMANDE, donnees)).toBe('close');
    expect(getNotificationTone(DEMANDE, donnees)).toBe('refus');
  });

  // COLL-S-DEMANDE-PERIMEE (12/10) — personne n'a tranché à temps : l'horloge, sans couleur (ni
  // une acceptation, ni un refus). ROUGE avant : le calendrier de la demande à la mairie.
  it('non traitée à temps, chez le club : l’horloge, sans couleur propre', () => {
    const donnees = { collectiviteName: 'Ville de Montrivage', decision: 'expired' };
    expect(getNotificationIcon(DEMANDE, donnees)).toBe('clock-two-thirty');
    expect(getNotificationTone(DEMANDE, donnees)).toBeNull();
  });

  it('le club déjà là, qui partagera : le stade', () => {
    expect(getNotificationIcon(DEMANDE, { audience: 'occupant' })).toBe('stadium');
  });

  it('sans données (anciennes notifications) et pour les autres types : rien ne change', () => {
    expect(getNotificationIcon(DEMANDE)).toBe('calendar');
    const message = NOTIFICATION_TYPES.NEW_WHISPER;
    expect(getNotificationIcon(message, { decision: 'refused' })).toBe('message-circle');
    expect(getNotificationTone(message, { decision: 'refused' })).toBeNull();
  });
});
