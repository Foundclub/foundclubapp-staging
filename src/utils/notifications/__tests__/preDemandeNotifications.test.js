// NOTIF-PREDEMANDE (29/10/2026, decision d'Adel « 2- A ») — la regle de retour de
// notre ecran de pre-demande, et la lecture de l'etat de la permission systeme.
import notifee from '@notifee/react-native';
import { PermissionsAndroid, Platform } from 'react-native';

import { setItem } from '@/platform/storage';
import { lireEtatPermissionNotifications } from '../etatPermissionNotifications';
import {
  DELAI_ENTRE_DEUX_AFFICHAGES_MS,
  ecouterPreDemande,
  lireMemoirePreDemande,
  momentCleDansLeCache,
  noterAffichagePreDemande,
  noterRefusDefinitifAndroid,
  noterReportPreDemande,
  peutProposerPreDemande,
  proposerPreDemandeNotifications,
  REPORTS_MAX,
} from '../preDemandeNotifications';

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: { getNotificationSettings: jest.fn() },
}));

const JOUR = 24 * 60 * 60 * 1000;

beforeEach(() => {
  setItem('notif_predemande_v1', '');
  Platform.OS = 'ios';
});

describe('la regle de retour', () => {
  it('un appareil neuf peut voir l ecran', () => {
    expect(peutProposerPreDemande(lireMemoirePreDemande(), Date.now())).toBe(true);
  });

  it('jamais deux fois en moins de 7 jours', () => {
    const t0 = 1_000_000_000_000;
    noterAffichagePreDemande(t0);
    noterReportPreDemande();
    const memoire = lireMemoirePreDemande();
    expect(DELAI_ENTRE_DEUX_AFFICHAGES_MS).toBe(7 * JOUR);
    expect(peutProposerPreDemande(memoire, t0 + (6 * JOUR))).toBe(false);
    expect(peutProposerPreDemande(memoire, t0 + (7 * JOUR))).toBe(true);
  });

  it('on arrete apres 3 reports', () => {
    expect(REPORTS_MAX).toBe(3);
    noterReportPreDemande();
    noterReportPreDemande();
    expect(peutProposerPreDemande(lireMemoirePreDemande(), Date.now())).toBe(true);
    noterReportPreDemande();
    expect(lireMemoirePreDemande().reports).toBe(3);
    expect(peutProposerPreDemande(lireMemoirePreDemande(), Date.now() + (365 * JOUR))).toBe(false);
  });

  it('une memoire illisible vaut un appareil neuf', () => {
    setItem('notif_predemande_v1', '{pas du json');
    expect(lireMemoirePreDemande()).toEqual({ dernierAffichage: 0, refusDefinitif: false, reports: 0 });
  });
});

describe('les moments cles', () => {
  it('proposer previent les ecouteurs, sauf sur le site', () => {
    const ecouteur = jest.fn();
    const arreter = ecouterPreDemande(ecouteur);
    proposerPreDemandeNotifications('adhesion');
    expect(ecouteur).toHaveBeenCalledWith('adhesion');

    Platform.OS = 'web';
    proposerPreDemandeNotifications('adhesion');
    expect(ecouteur).toHaveBeenCalledTimes(1);
    arreter();
  });

  it('un message non lu dans la liste des conversations = premier message recu', () => {
    expect(momentCleDansLeCache(['chats'], { pages: [{ data: [], meta: { unreadTotal: 2 } }] })).toBe('message');
    expect(momentCleDansLeCache(['chats'], { pages: [{ data: [{ unreadCount: 1 }], meta: {} }] })).toBe('message');
    expect(momentCleDansLeCache(['chats'], { pages: [{ data: [], meta: { unreadTotal: 0 } }] })).toBeNull();
  });

  it('une convocation non lue dans la cloche = convocation', () => {
    const page = (type, read) => ({ pages: [{ data: [{ read, type }] }] });
    expect(momentCleDansLeCache(['notifications'], page('eventConvocationPublished', false))).toBe('convocation');
    expect(momentCleDansLeCache(['notifications'], page('eventConvocationPublished', true))).toBeNull();
    expect(momentCleDansLeCache(['notifications'], page('newWhisper', false))).toBe('message');
    expect(momentCleDansLeCache(['notifications'], page('eventReminder', false))).toBeNull();
    expect(momentCleDansLeCache(['notifications', 'unread-count'], 3)).toBeNull();
  });
});

describe('l etat de la permission systeme', () => {
  it('iPhone : non demandee, refusee, accordee', async () => {
    notifee.getNotificationSettings.mockResolvedValueOnce({ authorizationStatus: -1 });
    await expect(lireEtatPermissionNotifications()).resolves.toBe('a_demander');
    notifee.getNotificationSettings.mockResolvedValueOnce({ authorizationStatus: 0 });
    await expect(lireEtatPermissionNotifications()).resolves.toBe('refusee');
    notifee.getNotificationSettings.mockResolvedValueOnce({ authorizationStatus: 1 });
    await expect(lireEtatPermissionNotifications()).resolves.toBe('accordee');
  });

  it('Android : refusee seulement apres un « ne plus demander »', async () => {
    Platform.OS = 'android';
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    await expect(lireEtatPermissionNotifications()).resolves.toBe('a_demander');
    noterRefusDefinitifAndroid();
    await expect(lireEtatPermissionNotifications()).resolves.toBe('refusee');
    PermissionsAndroid.check.mockResolvedValue(true);
    await expect(lireEtatPermissionNotifications()).resolves.toBe('accordee');
  });
});
