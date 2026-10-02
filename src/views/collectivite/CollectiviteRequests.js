import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { findManagedCollectivite, formatSlot } from '@/domains/collectivite/collectiviteDisplay';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ScreenContainer from '@/components/templates/ScreenContainer';
import DecisionCreneauModal from '@/views/collectivite/components/DecisionCreneauModal';

import {
  useCollectiviteRequests,
  useMyCollectivites,
} from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/** @typedef {{ kind: 'approve' | 'refuse', request: any }} Decision */

/**
 * 🏛️ « DEMANDES DE LA VILLE » — le gestionnaire tranche (COLLECTIVITES 1c, SPEC §2 E).
 *
 * Deux onglets : EN ATTENTE (a trancher) et TRAITEES (l historique recent). Chaque demande
 * dit QUI (club, equipe, la personne qui demande), QUOI (installation, jour, heures,
 * ponctuel ou chaque semaine), le MOTIF, et LE CONFLIT : qui occupe deja ce moment (club et
 * equipe, jamais une personne) et combien de place il reste.
 * Accepter ou refuser passe par les routes du lot 3a, AVEC un message (obligatoire pour un
 * refus : c est le motif que le club lira). Le serveur juge (le proprietaire tranche) et
 * previent : le demandeur, et l occupant s il y en avait un.
 *
 * Reutilise : les mutations du hub « Demandes » (facilityQueries) et sa fenetre de motif.
 * COLL-ACCUEIL (01/10) : la fenetre vit dans components/DecisionCreneauModal, partagee avec
 * l accueil de la Ville, qui tranche la demande qu il montre en tete.
 * Ecran neuf plutot que le hub : le hub est celui d UN CLUB (8 sources, filtres par equipe),
 * sans onglet « traitees », sans message a l acceptation, sans le detail du conflit.
 * @returns {import('react').ReactElement} L ecran.
 */
function CollectiviteRequests() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const route = useRoute();
  const routeParams = /** @type {{ collectiviteId?: string } | undefined} */ (route?.params);
  const collectiviteId = routeParams?.collectiviteId || null;

  const [onglet, setOnglet] = useState(/** @type {'pending' | 'decided'} */ ('pending'));
  const [decision, setDecision] = useState(/** @type {Decision | null} */ (null));

  const mine = useMyCollectivites();
  const collectivite = findManagedCollectivite(mine.data, collectiviteId);
  const pending = useCollectiviteRequests(collectiviteId, 'pending');
  const decided = useCollectiviteRequests(collectiviteId, 'decided', {
    enabled: Boolean(collectiviteId) && onglet === 'decided',
  });

  const refetchPending = pending.refetch;
  useFocusEffect(useCallback(() => {
    refetchPending?.();
  }, [refetchPending]));

  const liste = onglet === 'pending' ? pending : decided;
  const demandes = Array.isArray(liste.data) ? liste.data : [];
  const nbEnAttente = Array.isArray(pending.data) ? pending.data.length : 0;

  const ouvrir = (/** @type {'approve' | 'refuse'} */ kind, /** @type {any} */ request) => {
    setDecision({ kind, request });
  };

  const nomDe = (/** @type {any} */ personne) => (
    [personne?.firstname, personne?.lastname].filter(Boolean).join(' ')
  );

  const carteStyle = {
    backgroundColor: `${Colors.primary700}73`,
    borderColor: `${Colors.primary500}80`,
    gap: 8,
  };
  const conflitStyle = {
    backgroundColor: `${Colors.warning500}1F`,
    borderColor: `${Colors.warning500}66`,
    borderWidth: 1,
    gap: 4,
  };

  const renderConflit = (/** @type {any} */ conflit) => {
    if (!conflit) return null;
    const occupants = Array.isArray(conflit.occupants) ? conflit.occupants : [];
    return (
      <View
        style={[ApplicationStyle.borderRadius12, Spaces.padding[12], conflitStyle]}
        testID="collectivite-request-conflict"
      >
        {occupants.length === 0 ? (
          <Text style={[Fonts.p3, Fonts.neutral100]}>
            {t(
              'collectivite.requests.conflict.free',
              'Personne n’occupe ce moment : la place est libre.',
            )}
          </Text>
        ) : occupants.map((/** @type {any} */ occupant) => (
          <Text
            key={`${occupant?.club}-${occupant?.team}-${occupant?.start}-${occupant?.end}`}
            style={[Fonts.p3, Fonts.neutral100]}
          >
            {t(
              'collectivite.requests.conflict.occupant',
              'Déjà là : {{club}} · {{team}} ({{slot}})',
              {
                club: occupant?.club || '—',
                slot: formatSlot(occupant?.start, occupant?.end),
                team: occupant?.team || '—',
                ...SANS_ECHAPPEMENT,
              },
            )}
          </Text>
        ))}
        <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
          {t(
            'collectivite.requests.conflict.remaining',
            'Place restante : {{remaining}} sur {{max}}',
            { max: conflit.maxSlots, remaining: conflit.remaining },
          )}
        </Text>
      </View>
    );
  };

  const renderDemande = (/** @type {any} */ demande) => {
    const club = demande?.club?.name || t('collectivite.requests.unknownClub', 'Club');
    const equipe = demande?.team?.name;
    const auteur = nomDe(demande?.requestedBy);
    const recurrence = demande?.event?.isRecurring
      ? t('collectivite.requests.weekly', 'Chaque semaine')
      : t('collectivite.requests.once', 'Ponctuel');
    const estEnAttente = demande?.status === 'pending';
    const acceptee = demande?.status === 'approved';
    const moment = formatSlot(demande?.requestedStart, demande?.requestedEnd);

    return (
      <View
        key={demande?.documentId}
        style={[ApplicationStyle.card, Spaces.padding[16], carteStyle]}
        testID={`collectivite-request-${demande?.documentId}`}
      >
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
          <Text style={[Fonts.p1Black, Fonts.neutral00, { flex: 1 }]}>
            {equipe ? `${club} · ${equipe}` : club}
          </Text>
          {estEnAttente ? null : (
            <Text style={[Fonts.p3Bold, acceptee ? Fonts.success500 : Fonts.error500]}>
              {acceptee
                ? t('collectivite.requests.status.approved', 'Acceptée')
                : t('collectivite.requests.status.refused', 'Refusée')}
            </Text>
          )}
        </View>
        {auteur ? (
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('collectivite.requests.requestedBy', 'Demandé par {{name}}', {
              name: auteur,
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
        ) : null}
        <Text style={[Fonts.p2Bold, Fonts.primary200]}>
          {`${demande?.facility?.name || ''} · ${moment}`}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>{recurrence}</Text>
        {demande?.reason ? (
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('collectivite.requests.reason', 'Motif : {{reason}}', {
              reason: demande.reason,
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
        ) : null}
        {estEnAttente ? renderConflit(demande?.conflict) : null}
        {!estEnAttente && demande?.decisionReason ? (
          <Text style={[Fonts.p3, Fonts.neutral100]}>
            {t('collectivite.requests.decisionReason', 'Votre message : {{message}}', {
              message: demande.decisionReason,
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
        ) : null}
        {estEnAttente ? (
          <View style={[Alignments.row, { gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <Button
                onPress={() => ouvrir('refuse', demande)}
                title={t('collectivite.requests.actions.refuse', 'Refuser')}
                variant="Secondary"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                onPress={() => ouvrir('approve', demande)}
                title={t('collectivite.requests.actions.approve', 'Accepter')}
                variant="Primary"
              />
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  let contenu;
  if (liste.isLoading) {
    contenu = <Loader />;
  } else if (liste.error) {
    contenu = (
      <View style={{ gap: 12 }}>
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {getErrorMessage(/** @type {any} */ (liste.error))}
        </Text>
        <Button
          onPress={() => liste.refetch?.()}
          title={t('collectivite.requests.retry', 'Réessayer')}
          variant="Secondary"
        />
      </View>
    );
  } else if (demandes.length === 0) {
    contenu = (
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        {onglet === 'pending'
          ? t('collectivite.requests.emptyPending', 'Aucune demande en attente.')
          : t('collectivite.requests.emptyDecided', 'Aucune demande traitée pour l’instant.')}
      </Text>
    );
  } else {
    contenu = demandes.map(renderDemande);
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <DecisionCreneauModal decision={decision} onClose={() => setDecision(null)} />

      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 24, paddingTop: 12 }}
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => liste.refetch?.()}
            refreshing={Boolean(liste.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {/* TEXTES-COLLECTIVITES (01/10) : « Demandes de la Ville » est l en-tete de l ecran, */}
        {/* et s ecrivait deux fois. La page porte le NOM de la collectivite, comme les */}
        {/* installations. */}
        <View style={{ gap: 4 }}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {collectivite?.name || t('collectivite.requests.title', 'Demandes de la Ville')}
          </Text>
        </View>
        <SegmentedControl
          onChange={(/** @type {string} */ valeur) => setOnglet(
            valeur === 'decided' ? 'decided' : 'pending',
          )}
          options={[
            {
              // `nombre`, pas `count` : `count` ferait chercher a i18next une forme plurielle.
              label: t('collectivite.requests.tabs.pending', 'En attente ({{nombre}})', {
                nombre: nbEnAttente,
              }),
              value: 'pending',
            },
            { label: t('collectivite.requests.tabs.decided', 'Traitées'), value: 'decided' },
          ]}
          value={onglet}
        />
        {contenu}
      </ScrollView>
    </ScreenContainer>
  );
}

export default CollectiviteRequests;
