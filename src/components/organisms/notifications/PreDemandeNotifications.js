import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Linking, Modal, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { lireEtatPermissionNotifications } from '@/utils/notifications/etatPermissionNotifications';
import {
  ecouterPreDemande,
  lireMemoirePreDemande,
  momentCleDansLeCache,
  noterAffichagePreDemande,
  noterReportPreDemande,
  peutProposerPreDemande,
} from '@/utils/notifications/preDemandeNotifications';

/**
 * NOTIF-PREDEMANDE (29/10/2026, decision d'Adel « 2- A ») — NOTRE ecran, avant la
 * fenetre systeme des notifications. La regle (quand il s'ouvre, combien de fois) vit
 * dans `preDemandeNotifications.js` ; ici, l'ecran et ses deux gestes :
 *   · « Activer » ouvre la fenetre systeme (`activerNotifications`) ;
 *   · « Plus tard » ne demande rien et compte un report ;
 *   · fenetre systeme deja refusee : le bouton devient « Ouvrir les Réglages ».
 * Monte une seule fois, dans NotificationBootstrap (jamais sur le site).
 * @param {{ activerNotifications: () => Promise<string> }} props
 * @returns {import('react').ReactElement}
 */
function PreDemandeNotifications({ activerNotifications }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  /** @type {[null | 'a_demander' | 'refusee', Function]} */
  const [etat, setEtat] = useState(null);
  // Vrai de la decision d'ouvrir jusqu'a la fermeture : deux moments rapproches
  // (adhesion + message non lu) n'ouvrent qu'un ecran.
  const occupeRef = useRef(false);

  const proposer = useCallback(async () => {
    if (occupeRef.current || !peutProposerPreDemande(lireMemoirePreDemande(), Date.now())) return;
    occupeRef.current = true;
    try {
      const permission = await lireEtatPermissionNotifications();
      if (permission === 'accordee') {
        occupeRef.current = false;
        return;
      }
      noterAffichagePreDemande(Date.now());
      setEtat(permission);
    } catch {
      occupeRef.current = false;
    }
  }, []);

  useEffect(() => ecouterPreDemande(proposer), [proposer]);

  useEffect(() => queryClient.getQueryCache().subscribe((/** @type {any} */ evenement) => {
    if (evenement?.type !== 'updated' || evenement?.action?.type !== 'success') return;
    if (momentCleDansLeCache(evenement.query.queryKey, evenement.query.state.data)) {
      proposer();
    }
  }), [proposer, queryClient]);

  const fermer = useCallback(() => {
    setEtat(null);
    occupeRef.current = false;
  }, []);

  const plusTard = useCallback(() => {
    noterReportPreDemande();
    fermer();
  }, [fermer]);

  const activer = useCallback(async () => {
    const refusee = etat === 'refusee';
    fermer();
    if (refusee) {
      // ponytail: on ne sait pas ce que la personne fait dans les Reglages ; on compte
      // un report. Si elle active, le retour au premier plan prend le jeton (useNotifications).
      noterReportPreDemande();
      await Linking.openSettings().catch(() => {});
      return;
    }
    const statut = await activerNotifications();
    if (statut === 'denied') noterReportPreDemande();
  }, [activerNotifications, etat, fermer]);

  const refusee = etat === 'refusee';

  return (
    <Modal
      animationType="slide"
      onRequestClose={plusTard}
      presentationStyle="fullScreen"
      statusBarTranslucent
      visible={etat !== null}
    >
      <View
        style={[
          Alignments.fill,
          Alignments.justifyCenter,
          Spaces.padding[24],
          Spaces.gap[24],
          {
            backgroundColor: Colors.neutral900,
            paddingBottom: insets.bottom + 24,
            paddingTop: insets.top + 24,
          },
        ]}
      >
        <View
          style={[
            Alignments.alignCenter,
            Alignments.justifyCenter,
            ApplicationStyle.borderRadius24,
            { backgroundColor: Colors.primary900, height: 72, width: 72 },
          ]}
        >
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={Images.bell}
            style={{ height: 32, tintColor: Colors.primary300, width: 32 }}
          />
        </View>
        <Text accessibilityRole="header" style={[Fonts.h2, Fonts.neutral00]}>
          {t('notificationBootstrap.push.title', 'Sois prévenu au bon moment')}
        </Text>
        <Text style={[Fonts.p1, Fonts.neutral100]}>
          {refusee
            ? t(
              'notificationBootstrap.push.bodyRefused',
              'Les notifications sont coupées pour FoundClub. Pour savoir quand ton coach t’accepte, active-les dans les Réglages de ton téléphone.', // eslint-disable-line max-len
            )
            : t(
              'notificationBootstrap.push.body',
              'Active les notifications pour savoir quand ton coach t’accepte, quand tu es convoqué et quand on t’écrit.', // eslint-disable-line max-len
            )}
        </Text>
        <View style={Spaces.gap[12]}>
          <Button
            onPress={activer}
            title={refusee
              ? t('notificationBootstrap.push.openSettings', 'Ouvrir les Réglages')
              : t('notificationBootstrap.push.enable', 'Activer')}
            variant="Primary"
          />
          <Button
            onPress={plusTard}
            title={t('notificationBootstrap.later', 'Plus tard')}
            variant="Ghost"
          />
        </View>
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {t(
            'notificationBootstrap.push.supporting',
            'Tu pourras toujours modifier ce choix plus tard dans les réglages.',
          )}
        </Text>
      </View>
    </Modal>
  );
}

export default PreDemandeNotifications;
