import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import {
  expireDans,
  jourCourt,
  lignesDesPages,
  messageDeRefusResa,
  plageHoraire,
  STATUTS,
  totalDesPages,
} from '@/domains/complexe/complexeReservation';
import { texteHeure } from '@/domains/complexe/complexeTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ScreenContainer from '@/components/templates/ScreenContainer';
import BandeauComplexe from '@/views/complexe/components/BandeauComplexe';
import FeuilleMotif from '@/views/complexe/components/FeuilleMotif';
import PastillesReservation from '@/views/complexe/components/PastillesReservation';

import { RouteNames } from '@/navigation/routeNames';

import {
  useComplexeChoisi,
  useDeciderDemande,
  useReservationsDuComplexe,
  useTerrains,
} from '@/services/complexe/complexeQueries';

const ATTENTE = 'attente';
const TRAITEES = 'traitees';

/**
 * E-G06 — LES DEMANDES — RESA-L5A2 (14/10/2026), planche EG06 : l'onglet « Demandes » de l'espace
 * du complexe, pour les terrains en validation manuelle (A-G15). Écran de départ :
 * `CollectiviteRequests` (onglets En attente · Traitées, une carte = une phrase). Une carte :
 * « Julien M. demande le Terrain 2 · lundi 19/10 · 10 h – 11 h », « Expire dans 5 h », Refuser ·
 * Accepter ; la toucher ouvre la fiche (E-G05). « Refuser » ouvre la feuille du motif (obligatoire
 * pour le serveur : le joueur le lit). Un créneau pris entre-temps (409) : la carte le dit et ne
 * propose plus que de refuser.
 * Pas encore servi par le serveur (dit dans le compte rendu du lot) : « 10 joueurs ont déjà
 * répondu présent » (collecte, lot L3) ; la date d'une décision et le motif d'un refus dans
 * « Traitées » (la liste du serveur ne les rend pas : ils sont dans la fiche).
 * Paramètre de route : `complexeId` (sinon le premier complexe du compte). Caché par
 * `COMPLEXES_GERANT`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ComplexeDemandes() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const params = /** @type {{ complexeId?: string } | undefined} */ (route?.params);
  const { complexe, complexeId } = useComplexeChoisi(params?.complexeId);
  const [onglet, setOnglet] = useState(ATTENTE);
  const attente = useReservationsDuComplexe(complexeId, { vue: 'demandes' });
  const traitees = useReservationsDuComplexe(
    complexeId,
    { vue: 'traitees' },
    { enabled: onglet === TRAITEES },
  );
  const terrainsLus = useTerrains(complexeId);
  const decider = useDeciderDemande();
  const [refus, setRefus] = useState(/** @type {any} */ (null));
  const [erreurFeuille, setErreurFeuille] = useState('');
  const [conflits, setConflits] = useState(/** @type {Record<string, string>} */ ({}));
  const [message, setMessage] = useState('');
  const [enCours, setEnCours] = useState('');

  const lecture = onglet === ATTENTE ? attente : traitees;
  const lignes = lignesDesPages(lecture.data);
  const totalAttente = totalDesPages(attente.data);
  const terrains = Array.isArray(terrainsLus.data) ? terrainsLus.data : [];
  const aDesTerrainsManuels = terrains.some((terrain) => terrain?.bookingMode === 'manuel');
  const maintenant = new Date();

  const carte = {
    backgroundColor: withAlpha(Colors.primary700, 0.45),
    borderColor: withAlpha(Colors.primary500, 0.5),
    borderRadius: 16,
    borderWidth: 1,
  };

  const ouvrirLaFiche = (/** @type {any} */ demande) => navigation.navigate(
    RouteNames.ComplexeReservation,
    { complexeId, reservationId: demande.documentId },
  );
  const repli = t(
    'complexeReservations.demandes.erreurDecision',
    'La demande n’a pas pu être tranchée.',
  );

  const accepter = async (/** @type {any} */ demande) => {
    setMessage('');
    setEnCours(demande.documentId);
    try {
      await decider.mutateAsync({
        complexeId, decision: 'accepter', reservationId: demande.documentId,
      });
      setMessage(t(
        'complexeReservations.demandes.acceptee',
        'Demande acceptée. {{nom}} est prévenu.',
        { nom: String(demande.label || ''), ...SANS_ECHAPPEMENT },
      ));
    } catch (erreur) {
      const texte = messageDeRefusResa(t, erreur, repli);
      setConflits((avant) => ({ ...avant, [demande.documentId]: texte }));
    } finally {
      setEnCours('');
    }
  };

  const ouvrirLeRefus = (/** @type {any} */ demande) => {
    setErreurFeuille('');
    setRefus(demande);
  };

  const refuser = async (/** @type {string} */ motif) => {
    if (!refus) return;
    setErreurFeuille('');
    try {
      await decider.mutateAsync({
        complexeId, decision: 'refuser', reason: motif, reservationId: refus.documentId,
      });
      setMessage(t(
        'complexeReservations.demandes.refusee',
        'Demande refusée. {{nom}} est prévenu.',
        { nom: String(refus.label || ''), ...SANS_ECHAPPEMENT },
      ));
      setRefus(null);
    } catch (erreur) {
      setErreurFeuille(messageDeRefusResa(t, erreur, repli));
    }
  };

  const quand = (/** @type {any} */ demande) => (
    `${jourCourt(demande.date)} · ${plageHoraire(demande.from, demande.to)}`
  );

  const libelleTraitee = (/** @type {any} */ demande) => {
    switch (demande.status) {
      case STATUTS.confirmee:
        return t('complexeReservations.demandes.etatAcceptee', 'Acceptée');
      case STATUTS.refusee:
        return t('complexeReservations.demandes.etatRefusee', 'Refusée');
      default:
        return '';
    }
  };

  // ── Une demande en attente (état 1) ────────────────────────────────────────────────────
  const carteEnAttente = (/** @type {any} */ demande) => {
    const conflit = conflits[demande.documentId] || '';
    const echeance = expireDans(t, demande.expiresAt, maintenant);
    return (
      <TouchableOpacity
        accessibilityRole="button"
        key={demande.documentId}
        onPress={() => ouvrirLaFiche(demande)}
        style={[carte, Spaces.padding[16], { gap: 12 }]}
        testID={`demande-${demande.documentId}`}
      >
        <Text style={[Fonts.p2, Fonts.neutral00]}>
          <Text style={Fonts.p2Bold}>{String(demande.label || '')}</Text>
          {` ${t('complexeReservations.demandes.demandeLe', 'demande le')} `}
          <Text style={Fonts.p2Bold}>{String(demande.terrain?.name || '')}</Text>
          {` · ${quand(demande)}`}
        </Text>
        {echeance ? (
          <Text style={[Fonts.p3Bold, { color: Colors.warning500 }]}>{echeance}</Text>
        ) : null}
        {conflit ? <BandeauComplexe texte={conflit} ton="erreur" /> : null}
        <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
          <View
            style={{ flexBasis: 120, flexGrow: 1 }}
            testID={`demande-refuser-${demande.documentId}`}
          >
            <Button
              accessibilityLabel={conflit
                ? t('complexeReservations.demandes.refuserAvecUnMot', 'Refuser avec un mot')
                : t('complexeReservations.demandes.refuser', 'Refuser')}
              onPress={() => ouvrirLeRefus(demande)}
              size="sm"
              title={conflit
                ? t('complexeReservations.demandes.refuserAvecUnMot', 'Refuser avec un mot')
                : t('complexeReservations.demandes.refuser', 'Refuser')}
              variant="Secondary"
            />
          </View>
          {conflit ? null : (
            <View
              style={{ flexBasis: 120, flexGrow: 1 }}
              testID={`demande-accepter-${demande.documentId}`}
            >
              <Button
                disabled={Boolean(enCours)}
                isLoading={enCours === demande.documentId}
                onPress={() => accepter(demande)}
                size="sm"
                title={t('complexeReservations.demandes.accepter', 'Accepter')}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Une demande traitée (état 2) ───────────────────────────────────────────────────────
  const carteTraitee = (/** @type {any} */ demande) => (
    <TouchableOpacity
      accessibilityRole="button"
      key={demande.documentId}
      onPress={() => ouvrirLaFiche(demande)}
      style={[carte, Spaces.padding[16], { gap: 8 }]}
      testID={`demande-${demande.documentId}`}
    >
      <Text style={[Fonts.p2, Fonts.neutral00]}>
        <Text style={Fonts.p2Bold}>{String(demande.label || '')}</Text>
        {` · ${String(demande.terrain?.name || '')} · ${jourCourt(demande.date)}`}
        {` · ${texteHeure(demande.from)}`}
      </Text>
      <PastillesReservation statut={demande.status} texteEtat={libelleTraitee(demande)} />
    </TouchableOpacity>
  );

  let corps;
  if (lecture.isLoading) {
    corps = (
      <View accessibilityState={{ busy: true }} style={{ gap: 12 }} testID="demandes-squelette">
        {[1, 2].map((ligne) => (
          <View
            key={ligne}
            style={[
              ApplicationStyle.borderRadius16,
              { backgroundColor: withAlpha(Colors.neutral00, 0.06), height: 132 },
            ]}
          />
        ))}
      </View>
    );
  } else if (lecture.error) {
    corps = (
      <View
        accessibilityRole="alert"
        style={[carte, Spaces.padding[16], {
          backgroundColor: withAlpha(Colors.error500, 0.08),
          borderColor: withAlpha(Colors.error500, 0.4),
          gap: 8,
        }]}
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('complexeReservations.demandes.erreur', 'Les demandes n’ont pas pu être lues.')}
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            onPress={() => lecture.refetch?.()}
            title={t('complexeGerant.accueil.reessayer', 'Réessayer')}
            variant="Secondary"
          />
        </View>
      </View>
    );
  } else if (
    !lignes.length && onglet === ATTENTE && !terrainsLus.isLoading && !aDesTerrainsManuels
  ) {
    corps = (
      <EmptyState
        actionLabel={t('complexeReservations.demandes.changer', 'Changer')}
        icon={Images.check}
        onAction={() => navigation.navigate(RouteNames.ComplexeInstallations, { complexeId })}
        title={t(
          'complexeReservations.demandes.toutAutomatique',
          'Tous tes terrains se réservent en automatique.',
        )}
      />
    );
  } else if (!lignes.length) {
    corps = (
      <EmptyState
        description={onglet === ATTENTE
          ? t(
            'complexeReservations.demandes.videDit',
            'Tes terrains en validation manuelle apparaîtront ici.',
          )
          : undefined}
        icon={Images.inboxArrowDown}
        title={onglet === ATTENTE
          ? t('complexeReservations.demandes.vide', 'Aucune demande en attente.')
          : t('complexeReservations.demandes.videTraitees', 'Aucune demande traitée.')}
      />
    );
  } else {
    corps = (
      <View style={{ gap: 12 }}>
        {lignes.map((demande) => (
          onglet === ATTENTE ? carteEnAttente(demande) : carteTraitee(demande)
        ))}
        {lecture.hasNextPage ? (
          <Button
            isLoading={Boolean(lecture.isFetchingNextPage)}
            onPress={() => lecture.fetchNextPage?.()}
            title={t('complexeReservations.voirPlus', 'Voir plus')}
            variant="Ghost"
          />
        ) : null}
      </View>
    );
  }

  const libelleAttente = totalAttente === null
    ? t('complexeReservations.demandes.ongletAttente', 'En attente')
    : t('complexeReservations.demandes.ongletAttenteN', 'En attente ({{nombre}})', {
      nombre: totalAttente,
      ...SANS_ECHAPPEMENT,
    });

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 16 }}
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => lecture.refetch?.()}
            refreshing={Boolean(lecture.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View style={{ gap: 4 }}>
          <Text style={[Fonts.p3Bold, Fonts.primary500, { letterSpacing: 0.6 }]}>
            {String(complexe?.name || '').toUpperCase()}
          </Text>
          <Text
            accessibilityRole="header"
            style={[Fonts.h2Black, Fonts.neutral00, { letterSpacing: 1 }]}
          >
            {t('complexeReservations.demandes.titre', 'Demandes').toUpperCase()}
          </Text>
        </View>
        <SegmentedControl
          onChange={(valeur) => {
            setMessage('');
            setOnglet(valeur);
          }}
          options={[
            { label: libelleAttente, value: ATTENTE },
            {
              label: t('complexeReservations.demandes.ongletTraitees', 'Traitées'),
              value: TRAITEES,
            },
          ]}
          value={onglet}
        />
        {message ? <BandeauComplexe texte={message} ton="ok" /> : null}
        {corps}
      </ScrollView>
      <FeuilleMotif
        enCours={Boolean(decider.isPending)}
        erreur={erreurFeuille}
        libelleChamp={t('complexeReservations.demandes.motif', 'Le motif, que {{nom}} lira', {
          nom: String(refus?.label || ''),
          ...SANS_ECHAPPEMENT,
        })}
        libelleConfirmer={t('complexeReservations.demandes.refuser', 'Refuser')}
        motifs
        obligatoire
        onConfirmer={refuser}
        onFermer={() => setRefus(null)}
        sousTitre={refus ? `${quand(refus)} · ${String(refus.terrain?.name || '')}` : ''}
        titre={t(
          'complexeReservations.demandes.refuserLaDemande',
          'Refuser la demande de {{nom}}',
          { nom: String(refus?.label || ''), ...SANS_ECHAPPEMENT },
        )}
        visible={Boolean(refus)}
      />
    </ScreenContainer>
  );
}

export default ComplexeDemandes;
