import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCallback, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  datesRefuseesDUneSerie,
  estDemandeHebdo,
  momentDeLaDemande,
} from '@/domains/collectivite/collectiviteDemandes';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useSentFacilityOverrideRequests } from '@/services/facility/facilityQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

// Deux éléments aux deux bouts d'une rangée.
const ENTRE_DEUX = /** @type {const} */ ({ gap: 8, justifyContent: 'space-between' });
// Au-delà de cette largeur (ordinateur), un tableau : équipe, installation, moment, réponse, mot.
const LARGEUR_TABLEAU = 1024;

/**
 * 🏛️ COLL-C3B (02/10) — « TES DEMANDES À LA VILLE » (planches P8v2-demande, tel état 5, ordi C).
 *
 * La réponse et le mot de la mairie, sans aller les chercher dans les notifications : chaque
 * demande que le club a envoyée à une Ville, l'équipe, l'installation, le moment (une série
 * « chaque jeudi … jusqu'au 30 juin » sur une ligne), l'état (En attente, Acceptée, Refusée),
 * « c'était complet à l'envoi », le mot de la mairie en citation. Un refus propose « Demander une
 * autre heure ». Jamais une personne : le serveur ne rend ni qui a demandé, ni l'agent (D71).
 * Le dirigeant voit les demandes du club ; un entraîneur, les siennes. Au « tu ».
 * @returns {import('react').ReactElement} L'écran.
 */
function ClubSlotRequests() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const params = /** @type {Record<string, any>} */ (route?.params || {});
  const { userData } = /** @type {any} */ (useAuth()) || {};
  const clubId = params.clubId || userData?.club?.documentId || null;
  const { width } = useWindowDimensions();
  const tableau = width >= LARGEUR_TABLEAU;

  // 🎨 FINITIONS13-COLL (04/10) — UN SEUL TITRE (tournée T13, C2_4a : « Tes demandes à la Ville »
  // écrit deux fois) : la page le porte, l'en-tête de navigation se tait, comme « Installations de
  // la Ville » (COLL-C2B). Le bouton retour reste.
  useLayoutEffect(() => {
    navigation.setOptions?.({ headerTitle: '' });
  }, [navigation]);

  const demandes = useSentFacilityOverrideRequests(clubId);
  const { refetch } = demandes;
  useFocusEffect(useCallback(() => { refetch?.(); }, [refetch]));
  // 🚪 FINITIONS12-COLL (03/10) — ouvert par la réponse de la Ville (`requestId`, notification) :
  // CETTE demande en tête, signalée, avec la réponse et le mot de la mairie (maquette P8v3-notifs,
  // état 2). Tournée T11 : un refus ouvrait l'entraînement annulé.
  const ouverte = params.requestId || null;
  /** @type {any[]} */
  const recues = Array.isArray(demandes.data) ? demandes.data : [];
  const rangOuvert = ouverte ? recues.findIndex((d) => d?.documentId === ouverte) : -1;
  const lignes = rangOuvert > 0
    ? [recues[rangOuvert], ...recues.slice(0, rangOuvert), ...recues.slice(rangOuvert + 1)]
    : recues;
  const testIdDe = (/** @type {any} */ demande) => (demande?.documentId === ouverte
    ? 'demande-envoyee-ouverte'
    : `demande-envoyee-${demande?.documentId}`);

  const etat = (/** @type {any} */ demande) => {
    if (demande?.status === 'approved') {
      // eslint-disable-next-line max-len
      return { couleur: Colors.success500, texte: t('collectivite.requests.status.approved', 'Acceptée') };
    }
    if (demande?.status === 'refused') {
      // eslint-disable-next-line max-len
      return { couleur: Colors.error500, texte: t('collectivite.requests.status.refused', 'Refusée') };
    }
    // ⏳ COLL-S-DEMANDE-PERIMEE (12/10) — pas tranchée avant la fin de la séance : en gris.
    if (demande?.status === 'expired') {
      // eslint-disable-next-line max-len
      return { couleur: Colors.neutral300, texte: t('collectivite.requests.status.expired', 'Expirée') };
    }
    // eslint-disable-next-line max-len
    return { couleur: Colors.warning500, texte: t('collectiviteDemandes.club.enAttente', 'En attente') };
  };

  const momentDe = (/** @type {any} */ demande) => {
    const moment = momentDeLaDemande(demande);
    if (!moment) return '';
    // 🎨 FINITIONS13-COLL (04/10) — une carte REFUSÉE d'une série ne dit pas la période de la série
    // (celle des dates maintenues, tournée T13 C2_1e) : sa date, ou « chaque jeudi … · 3 dates ».
    // VILLE-T18C (07/10) : la règle vit dans le domaine, partagée avec « Demandes de la Ville ».
    const refusees = datesRefuseesDUneSerie(demande);
    if (refusees > 1) {
      // eslint-disable-next-line max-len
      return t('collectiviteDemandes.club.ligneSerieDates', 'Chaque {{jour}}, {{debut}} – {{fin}} · {{nombre}} dates', {
        // eslint-disable-next-line max-len
        debut: moment.debut, fin: moment.fin, jour: moment.jourSemaine, nombre: refusees, ...SANS_ECHAPPEMENT,
      });
    }
    if (estDemandeHebdo(demande) && demande?.series && !refusees) {
      // eslint-disable-next-line max-len
      return t('collectiviteDemandes.club.ligneSerie', 'Chaque {{jour}}, {{debut}} – {{fin}}, jusqu’au {{jusquAu}}', {
        // eslint-disable-next-line max-len
        debut: moment.debut, fin: moment.fin, jour: moment.jourSemaine, jusquAu: moment.jusquAu, ...SANS_ECHAPPEMENT,
      });
    }
    const jour = format(new Date(demande.requestedStart), 'EEE d MMM', { locale: fr });
    return `${jour.charAt(0).toUpperCase()}${jour.slice(1)}, ${moment.debut} – ${moment.fin}`;
  };

  const etaitComplet = (/** @type {any} */ demande) => (
    Number(demande?.overlapCount) >= Math.max(1, Number(demande?.maxSlots || 1))
  );

  // eslint-disable-next-line max-len
  const demanderUneAutreHeure = (/** @type {any} */ demande) => navigation.navigate(RouteNames.ClubSlotRequest, {
    clubId,
    facilityId: demande?.facility?.documentId,
    teamId: demande?.team?.documentId,
  });

  const carte = {
    backgroundColor: withAlpha(Colors.neutral00, 0.04),
    borderColor: withAlpha(Colors.neutral00, 0.09),
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  };

  const renderCarte = (/** @type {any} */ demande) => {
    const { couleur, texte } = etat(demande);
    const suite = [];
    if (demande?.status === 'pending' && etaitComplet(demande)) {
      suite.push(t('collectiviteDemandes.club.completALEnvoi', 'c’était complet à l’envoi'));
    }
    if (demande?.status === 'refused') {
      suite.push(t('collectiviteDemandes.club.entrainementAnnule', 'l’entraînement est annulé'));
    }
    if (demande?.status === 'expired') {
      suite.push(t('collectiviteDemandes.club.nonTraiteeATemps', 'non traitée à temps'));
    }
    return (
      <View
        key={demande?.documentId}
        style={demande?.documentId === ouverte
          ? { ...carte, borderColor: Colors.primary500, borderWidth: 2 }
          : carte}
        testID={testIdDe(demande)}
      >
        <View
          style={[Alignments.row, Alignments.alignCenter, ENTRE_DEUX]}
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
            {[demande?.team?.name, demande?.facility?.name].filter(Boolean).join(' · ')}
          </Text>
          <Text style={[Fonts.p3Bold, { color: couleur }]}>{texte}</Text>
        </View>
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {[momentDe(demande), ...suite].filter(Boolean).join(' · ')}
        </Text>
        {demande?.decisionReason ? (
          <Text
            // eslint-disable-next-line max-len
            style={[Fonts.p2, Fonts.neutral100, { borderLeftColor: Colors.neutral500, borderLeftWidth: 3, paddingLeft: 10 }]}
          >
            {`« ${demande.decisionReason} »`}
          </Text>
        ) : null}
        {demande?.status === 'refused' ? (
          <Button
            onPress={() => demanderUneAutreHeure(demande)}
            title={t('collectiviteDemandes.club.autreHeure', 'Demander une autre heure')}
            variant="Secondary"
          />
        ) : null}
      </View>
    );
  };

  // eslint-disable-next-line max-len
  const cellule = (/** @type {string} */ texte, /** @type {number} */ flex, couleur = Colors.neutral100) => (
    <Text style={[Fonts.p3, { color: couleur, flex }]}>{texte}</Text>
  );
  const renderTableau = () => (
    <View style={[ApplicationStyle.borderRadius16, { gap: 0 }]} testID="demandes-tableau">
      <View style={[Alignments.row, Spaces.padding[12], { gap: 12 }]}>
        {cellule(t('collectiviteDemandes.club.colEquipe', 'Équipe'), 1, Colors.neutral300)}
        {cellule(
          t('collectiviteDemandes.club.colInstallation', 'Installation'),
          2,
          Colors.neutral300,
        )}
        {cellule(t('collectiviteDemandes.club.colMoment', 'Moment'), 3, Colors.neutral300)}
        {cellule(t('collectiviteDemandes.club.colReponse', 'Réponse'), 1, Colors.neutral300)}
        {cellule(t('collectiviteDemandes.club.colMot', 'Mot de la mairie'), 3, Colors.neutral300)}
      </View>
      {lignes.map((demande) => {
        const { couleur, texte } = etat(demande);
        return (
          <View
            key={demande?.documentId}
            style={[Alignments.row, Spaces.padding[12], {
              backgroundColor: demande?.documentId === ouverte
                ? withAlpha(Colors.primary500, 0.12)
                : 'transparent',
              borderTopColor: withAlpha(Colors.neutral00, 0.09),
              borderTopWidth: 1,
              gap: 12,
            }]}
            testID={testIdDe(demande)}
          >
            {cellule(demande?.team?.name || '—', 1)}
            {cellule(demande?.facility?.name || '—', 2)}
            {cellule(momentDe(demande), 3)}
            {cellule(texte, 1, couleur)}
            {cellule(demande?.decisionReason ? `« ${demande.decisionReason} »` : '—', 3)}
          </View>
        );
      })}
    </View>
  );

  let contenu;
  if (demandes.isLoading) {
    contenu = <Loader />;
  } else if (demandes.error) {
    contenu = (
      <View style={{ gap: 12 }}>
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {getErrorMessage(/** @type {any} */ (demandes.error))}
        </Text>
        <Button
          onPress={() => demandes.refetch?.()}
          title={t('collectivite.requests.retry', 'Réessayer')}
          variant="Secondary"
        />
      </View>
    );
  } else if (!lignes.length) {
    contenu = (
      <Text style={[Fonts.p2, Fonts.neutral200]} testID="demandes-envoyees-vide">
        {t(
          'collectiviteDemandes.club.aucuneDemande',
          'Aucune demande envoyée à une Ville pour l’instant.',
        )}
      </Text>
    );
  } else {
    contenu = tableau ? renderTableau() : lignes.map(renderCarte);
  }

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 24, paddingTop: 16 }}
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => demandes.refetch?.()}
            refreshing={Boolean(demandes.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
      >
        <Text style={[Fonts.h2Black, Fonts.neutral00]}>
          {t('collectiviteDemandes.club.tesDemandes', 'Tes demandes à la Ville')}
        </Text>
        {contenu}
        <Button
          onPress={() => navigation.navigate(RouteNames.ClubSlotRequest, { clubId })}
          title={t('collectiviteDemandes.club.titre', 'Demander un créneau')}
          variant="Secondary"
        />
      </ScrollView>
    </ScreenContainer>
  );
}

export default ClubSlotRequests;
