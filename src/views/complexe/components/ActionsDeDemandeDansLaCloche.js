import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import { RouteNames } from '@/navigation/routeNames';

import { useDeciderDemande } from '@/services/complexe/complexeQueries';

import { getServerErrorCode } from '@/utils/errors/displayError';

/**
 * RESA-FIN-APP-2 (22/10/2026) — plan E-G19 §3.3-4 : sur une ligne de DEMANDE de la cloche du gérant
 * (N-02, N-03) encore en attente (`demandeATrancher`), « Accepter » tranche comme « Demandes »
 * (E-G06) ; « Refuser » ouvre « Demandes » sur la feuille du motif de cette demande. Ensuite, la
 * ligne dit ce qui est arrivé (« Demande acceptée. », ou déjà tranchée ailleurs : le 409 d'état).
 * Monté seulement sur ces lignes : la liste des notifications ne lit rien de plus.
 * @param {object} props - Les propriétés.
 * @param {Record<string, any>} props.data - La charge utile (`complexeId`, `reservationId`).
 * @param {() => void} [props.relire] - Relire la liste des notifications.
 * @param {string} props.testID - Le repère de la ligne.
 * @returns {import('react').ReactElement} Les deux boutons, ou ce qui est arrivé.
 */
function ActionsDeDemandeDansLaCloche({ data, relire = undefined, testID }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const decider = useDeciderDemande();
  const [bilan, setBilan] = useState('');

  const accepter = async () => {
    let texte = t('notificationList.complexe.demandeAcceptee', 'Demande acceptée.');
    try {
      await decider.mutateAsync({
        complexeId: data.complexeId, decision: 'accepter', reservationId: data.reservationId,
      });
      relire?.();
    } catch (erreur) {
      texte = getServerErrorCode(erreur) === 'COMPLEXE_RESERVATION_STATE'
        ? t('notificationList.complexe.dejaTranchee', 'Cette demande est déjà tranchée.')
        : t('complexeReservations.demandes.erreurDecision', 'La demande n’a pas pu être tranchée.');
    }
    setBilan(texte);
  };
  const refuser = () => navigation.navigate(RouteNames.ComplexeEspace, {
    params: { complexeId: data.complexeId, refuser: data.reservationId },
    screen: RouteNames.ComplexeDemandes,
  });

  if (bilan) {
    return (
      <Text style={[Fonts.p3Bold, { color: Colors.neutral100, marginTop: 12 }]}>{bilan}</Text>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.85}
        disabled={Boolean(decider.isPending)}
        onPress={accepter}
        style={{
          backgroundColor: Colors.primary500,
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 8,
        }}
        testID={`cloche-accepter-${testID}`}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>
          {t('complexeReservations.demandes.accepter', 'Accepter')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.85}
        onPress={refuser}
        style={{
          backgroundColor: 'transparent',
          borderColor: Colors.neutral300,
          borderRadius: 999,
          borderWidth: 1,
          paddingHorizontal: 14,
          paddingVertical: 8,
        }}
        testID={`cloche-refuser-${testID}`}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.neutral100 }]}>
          {t('complexeReservations.demandes.refuser', 'Refuser')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default ActionsDeDemandeDansLaCloche;
