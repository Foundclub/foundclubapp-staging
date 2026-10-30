import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Linking, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { formatEuros } from '@/domains/complexe/complexeTerrain';
import {
  apercuDeLaFidelite,
  jourEtHeure,
  peutChercherDesJoueurs,
} from '@/domains/complexe/partieDuJoueur';
import {
  contenuDEchec,
  etatAffiche,
  lienAgendaGoogle,
  momentLisible,
  numeroLisible,
  parametresDEchec,
  texteCreneau,
  texteJourLong,
  varianteDEchec,
  varianteDeLaReservation,
} from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import BlocDEchec from '@/views/reserverTerrain/components/BlocDEchec';
import BlocParticipants from '@/views/reserverTerrain/components/BlocParticipants';
import CarteDAction from '@/views/reserverTerrain/components/CarteDAction';
import FeuilleAnnonce from '@/views/reserverTerrain/components/FeuilleAnnonce';
import FeuilleInviterParLien from '@/views/reserverTerrain/components/FeuilleInviterParLien';
import PastilleEtat from '@/views/reserverTerrain/components/PastilleEtat';
import { navigateToSearchHub } from '@/views/search/searchRouteHelpers';

import { RouteNames } from '@/navigation/routeNames';

import {
  useAnnulerMaReservation,
  useComplexePublic,
  useGroupeDeLaReservation,
  useMaRelationAuComplexe,
  useMaReservation,
  useOuvrirUnFil,
  useRepondreALaPartie,
} from '@/services/complexe/complexeJoueurQueries';

import texteInsecable from '@/utils/texteInsecable';

import { openExternalMap } from '@/platform/maps/externalMap';
import { useIsDesktop } from '@/responsive';

const COLONNE = 640;

/** Les états où la partie se joue encore (on y répond, on y invite). */
const PARTIE_EN_COURS = Object.freeze(['confirmee', 'enAttente', 'enCollecte']);

/**
 * E-P07 — « LA FICHE DE MA RÉSERVATION » — RESA-L6A (14/10/2026), planches EP07 et OR3, plan E-P07.
 * Pour le réserveur, dans l'ordre de la fiche :
 *   1. l'en-tête « MA RÉSERVATION » et la pastille d'état (P00 bloc 4) ; refusée, sans réponse,
 *      annulée ou fermeture : l'en-tête d'échec (E-P13) et plus d'actions sur la réservation ;
 *   2. « Quand, où » : le jour et les heures, le complexe et le terrain (⇒ E-P02), le prix
 *      indicatif (D4), « Itinéraire » (l'adresse publique du complexe) et « Ajouter à l'agenda » ;
 *   3. annuler : dans le délai FIGÉ (« Gratuit jusqu'au 15/10 à 18 h. ») avec une confirmation ;
 *      une demande en attente se retire toujours (AT-08) ; après le délai, « Le délai est passé :
 *      appelle le complexe » et son numéro (RC-P07) ; jouée : « Réserver à nouveau » ;
 *   4. l'historique (la réservation, le petit mot).
 * Annulée ⇒ E-P13 « annulée par toi » à la place de cet écran.
 * Paramètres : `reservationId` ; `change` et `fermeture` (la notification qui l'a ouverte).
 * Ordinateur (OR3) : la colonne centrée ; dans le volet de droite de « Mes réservations » (E-P10,
 * gabarit A, RESA-L6B-1) : `dansUnVolet` et la réservation que la liste lui donne, sans fond
 * d'écran à elle.
 * RESA-L6B-2 (20/10/2026, serveurs RESA-L3 / L4 ; planche EP07 états 1 à 4, plan E-P07 blocs 1
 * à 5) — la réservation vit comme une partie (le groupe, `GET …/groupe`) :
 *   · « Participants · 8/10 » (Tous · Présents · Absents · Sans réponse ; prénom + initiale) ;
 *   · le réserveur : « Écrire au complexe » (la conversation de SA réservation, AT-04), « Inviter
 *     par lien » (la feuille du lien, « Désactiver le lien »), « Il me manque des joueurs »
 *     (s'il manque du monde et que le créneau est à venir ; l'annonce publiée s'ouvre, sinon sa
 *     feuille de création — paramètre `ouvrir: 'annonce'` depuis E-P05), « Discussion du
 *     groupe » (RG-FIL : la règle des mineurs du serveur ; son refus dit sa phrase) ;
 *   · la fidélité du complexe (« Cette partie comptera pour ta fidélité : … ») ;
 *   · la collecte : « En collecte · 7/10 », la jauge, la date limite, « Arrêter la collecte » ;
 *     arrêtée par le serveur : l'en-tête d'E-P13 (créneau pris : le texte A-P08) ;
 *   · un PARTICIPANT (vue réduite du serveur) : « Réservée par Julien M. » (« Pour U15 Valbrune »
 *     d'une équipe), « Tu viens ? » Présent / Absent et l'engagement ; ni annuler, ni inviter, ni
 *     annonce, ni conversation avec le complexe.
 * Caché par `COMPLEXES_JOUEUR`.
 * @param {object} [props] - Les propriétés (aucune pour l'écran seul).
 * @param {boolean} [props.dansUnVolet] - Dans le volet de E-P10 sur ordinateur.
 * @param {string | null} [props.reservationId] - La réservation du volet.
 * @returns {import('react').ReactElement} L'écran.
 */
function ReserverMaReservation({ dansUnVolet = false, reservationId = null } = {}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  /**
   * @type {{ change?: string, fermeture?: string, ouvrir?: string,
   *   reservationId?: string | null }}
   */
  const params = dansUnVolet
    ? { reservationId }
    : /** @type {any} */ (route?.params) || {};
  const surOrdinateur = useIsDesktop();
  const lecture = useMaReservation(params.reservationId);
  const annuler = useAnnulerMaReservation();
  const reservation = lecture?.data || null;
  const complexePublic = useComplexePublic(reservation?.complexe?.slug)?.data;
  const groupe = useGroupeDeLaReservation(params.reservationId)?.data || null;
  const relation = useMaRelationAuComplexe(reservation?.complexe?.slug)?.data || null;
  const ouvrirUnFil = useOuvrirUnFil();
  const repondre = useRepondreALaPartie();
  const [confirmation, setConfirmation] = useState(false);
  const [refusTropTard, setRefusTropTard] = useState(/** @type {any} */ (null));
  const [bandeau, setBandeau] = useState(/** @type {string | null} */ (null));
  const [feuille, setFeuille] = useState(/** @type {'annonce' | 'lien' | null} */ (
    params.ouvrir === 'annonce' ? 'annonce' : null
  ));
  const [refusDuFil, setRefusDuFil] = useState(/** @type {string | null} */ (null));
  const [refusDeReponse, setRefusDeReponse] = useState(/** @type {string | null} */ (null));

  const carte = {
    backgroundColor: withAlpha(Colors.primary800, 0.6),
    borderColor: withAlpha(Colors.primary500, 0.24),
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  };
  // CORR-SOCLE (30/10, point 9) : le volet de « Mes réservations » ne défile plus à part, c'est
  // la page qui défile.
  const enveloppe = (/** @type {import('react').ReactNode} */ contenu) => (dansUnVolet ? (
    <View style={{ gap: 16, paddingBottom: 24 }}>
      {contenu}
    </View>
  ) : (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center',
          gap: 16,
          maxWidth: surOrdinateur ? COLONNE : undefined,
          paddingBottom: 24,
          paddingTop: 12,
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {contenu}
      </ScrollView>
    </ScreenContainer>
  ));

  if (lecture?.isLoading && !reservation) {
    return enveloppe(
      <View style={{ gap: 12 }} testID="reserver-ma-reservation-squelette">
        {[140, 120, 80].map((hauteur) => (
          <View
            accessibilityState={{ busy: true }}
            key={hauteur}
            style={{
              backgroundColor: withAlpha(Colors.neutral00, 0.06),
              borderRadius: 20,
              height: hauteur,
            }}
          />
        ))}
      </View>,
    );
  }
  if (lecture?.error && !reservation) {
    const introuvable = varianteDEchec(lecture.error) === 'introuvable';
    return enveloppe(
      <View accessibilityRole="alert" style={carte}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {introuvable
            ? t('reserverTerrain.echec.introuvable', 'Cette réservation n’existe plus.')
            : t('reserverTerrain.maReservation.erreur', 'Impossible de charger ta réservation.')}
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          {introuvable ? (
            <Button
              onPress={() => navigation.popToTop?.()}
              title={t('reserverTerrain.resultat.retourAccueil', 'Retour à l’accueil')}
              variant="Secondary"
            />
          ) : (
            <Button
              onPress={() => lecture.refetch?.()}
              title={t('reserverTerrain.recherche.reessayer', 'Réessayer')}
              variant="Secondary"
            />
          )}
        </View>
      </View>,
    );
  }
  if (!reservation) {
    return enveloppe(
      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
        {t('reserverTerrain.echec.introuvable', 'Cette réservation n’existe plus.')}
      </Text>,
    );
  }

  const nomDuComplexe = String(reservation?.complexe?.name || '');
  const slug = reservation?.complexe?.slug || null;
  const terrainId = reservation?.terrain?.documentId || null;
  const telephone = String(reservation?.complexe?.phoneNumber || '').trim();
  // RESA-L6B-2 : un participant lit la vue réduite du serveur (`role: 'participant'`).
  const participant = reservation?.role === 'participant' || groupe?.role === 'participant';
  const etat = etatAffiche(reservation);
  const collecte = groupe?.collecte || null;
  const varianteDEnTete = varianteDeLaReservation(reservation, {
    change: params.change,
    echecDeCollecte: collecte?.failure,
  });
  const demande = etat === 'enAttente';
  const enCollecte = etat === 'enCollecte';
  const debut = momentLisible(reservation.startsAt);
  const jusquA = momentLisible(reservation.cancellableUntil);
  const echeance = momentLisible(reservation.expiresAt);
  const creation = momentLisible(reservation.createdAt);
  // RESA-FIN-APP (20/10) — l'historique dit aussi « Confirmée la veille » et « Marquée non
  // honorée » (plan E-P07 §3.7 ; tournées 1 et 2 : seul « Réservée le … » y était).
  const confirmeeLaVeille = momentLisible(reservation.dayBeforeConfirmedAt);
  const marqueeNonHonoree = momentLisible(reservation.noShowAt);
  // RESA-FIN-APP-2 (plan N-17, « 1 sur 3 ») : le rang et le seuil du serveur (RESAFINSRV2) ;
  // lecture tolérante, rien sans seuil.
  const rang = Number(reservation.noShowCount);
  const seuil = Number(reservation.noShowThreshold);
  const rangDeNonHonoree = rang > 0 && seuil > 0 ? { rang, seuil } : null;
  const commence = new Date(String(reservation.startsAt)).getTime() <= Date.now();
  const adresse = complexePublic?.address?.label ? String(complexePublic.address.label) : '';
  const partieEnCours = !varianteDEnTete && PARTIE_EN_COURS.includes(etat) && !commence;
  const autresPresents = Math.max(0, (Number(groupe?.counts?.presents) || 1) - 1);
  const remplissage = collecte
    ? Math.min(100, Math.round(
      (Number(collecte.presents) / Math.max(1, Number(collecte.quorum))) * 100,
    ))
    : 0;
  const ageMinimum = Number(complexePublic?.rules?.minAge) || null;

  const versLeCalendrier = () => navigation.navigate(RouteNames.ReserverCreneau, {
    slug,
    terrainId,
  });
  const appeler = (/** @type {string} */ numero) => {
    if (numero) Linking.openURL(`tel:${numero}`).catch(() => {});
  };
  const confirmerLAnnulation = async () => {
    setBandeau(null);
    try {
      await annuler.mutateAsync(reservation.documentId);
      setConfirmation(false);
      navigation.replace(
        RouteNames.ReserverEchec,
        parametresDEchec({
          complexe: nomDuComplexe,
          creneau: { from: reservation.from, to: reservation.to },
          date: reservation.date,
          slug,
          telephone,
          terrain: reservation.terrain,
          // RESA-FIN-APP : retirer une DEMANDE n'annule aucune réservation (tournée 2).
          variante: (enCollecte && 'collecteArretee')
            || (demande && 'demandeRetiree')
            || 'annuleeParToi',
        }),
      );
    } catch (erreur) {
      setConfirmation(false);
      const variante = varianteDEchec(erreur);
      if (variante === 'delaiAnnulation') {
        setRefusTropTard(contenuDEchec(t, variante, { erreur, telephone }));
        return;
      }
      setBandeau(contenuDEchec(t, variante, { erreur }).titre);
    }
  };
  // RESA-L6B-2 : la discussion du groupe (RG-FIL) ou la conversation avec le complexe (AT-04) ;
  // le serveur ouvre le fil, la messagerie l'affiche ; un refus dit sa phrase.
  const ouvrirLeFil = async (/** @type {'complexe' | 'discussion'} */ fil) => {
    setRefusDuFil(null);
    try {
      const reponse = await ouvrirUnFil.mutateAsync({ fil, reservationId: reservation.documentId });
      if (reponse?.chat) navigation.navigate(RouteNames.Conversation, { chatId: reponse.chat });
    } catch (erreur) {
      const message = /** @type {{ message?: unknown } | null} */ (erreur)?.message;
      setRefusDuFil(String(message || '').trim()
        || contenuDEchec(t, varianteDEchec(erreur), { erreur }).titre);
    }
  };
  const repondreALaPartie = async (/** @type {'absent' | 'present'} */ reponse) => {
    setRefusDeReponse(null);
    try {
      await repondre.mutateAsync({ reponse, reservationId: reservation.documentId });
    } catch (erreur) {
      const variante = varianteDEchec(erreur);
      setRefusDeReponse(contenuDEchec(t, variante, { erreur, rejoindre: true }).titre);
    }
  };
  const chercherDesJoueurs = () => {
    if (groupe?.annonce?.documentId) {
      // Le réserveur ouvre SON annonce : « Partager », « Fermer l'annonce » (`reservationId`).
      navigation.navigate(RouteNames.ReserverAnnonce, {
        annonceId: groupe.annonce.documentId,
        reservationId: reservation.documentId,
      });
      return;
    }
    setFeuille('annonce');
  };

  // -------------------------------------------------------------------------------------------
  // Les blocs
  // -------------------------------------------------------------------------------------------

  const enTete = (
    <View style={{ gap: 8 }}>
      <Text
        accessibilityRole="header"
        style={[Fonts.h2Black, Fonts.neutral00, { letterSpacing: 1 }]}
      >
        {(participant
          ? t('reserverTerrain.maReservation.titreParticipant', 'Réservation')
          : t('reserverTerrain.maReservation.titre', 'Ma réservation')).toUpperCase()}
      </Text>
      <PastilleEtat
        compte={enCollecte && collecte ? `${collecte.presents}/${collecte.quorum}` : null}
        etat={etat}
      />
      {enCollecte && collecte ? (
        <View style={{ gap: 6 }}>
          <View
            style={{
              backgroundColor: withAlpha(Colors.primary500, 0.18),
              borderRadius: 4,
              height: 8,
              overflow: 'hidden',
            }}
            testID="ma-reservation-jauge"
          >
            <View
              style={{
                backgroundColor: Colors.primary500,
                height: 8,
                width: `${remplissage}%`,
              }}
            />
          </View>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'reserverTerrain.maReservation.dateLimite',
              'Date limite : {{echeance}} · le créneau reste libre jusque-là',
              { echeance: jourEtHeure(t, collecte.collectDeadline), ...SANS_ECHAPPEMENT },
            )}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const contenuDEnTete = varianteDEnTete ? contenuDEchec(t, varianteDEnTete, {
    collecte,
    complexe: nomDuComplexe,
    debut: reservation.startsAt,
    fermeture: params.fermeture,
    motif: reservation.reason,
    reserveur: reservation.bookerLabel,
    telephone,
    terrain: reservation.terrain?.name,
  }) : null;
  const enTeteDEchec = contenuDEnTete ? (
    <View style={carte}>
      <BlocDEchec
        // RESA-L6B-2 : « Écrire au complexe » est le geste du RÉSERVEUR (AT-04).
        contenu={{
          ...contenuDEnTete,
          actions: contenuDEnTete.actions.filter((action) => !participant || action !== 'ecrire'),
        }}
        onAction={(action) => {
          if (action === 'appeler') appeler(telephone);
          else if (action === 'ecrire') ouvrirLeFil('complexe');
          else if (action === 'ailleurs' || action === 'reserverUnTerrain') {
            navigateToSearchHub(navigation, 'reservations');
          } else versLeCalendrier();
        }}
      />
      {refusDuFil ? (
        <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{refusDuFil}</Text>
      ) : null}
    </View>
  ) : null;

  const prix = Number.isFinite(Number(reservation?.price?.amount))
    ? t('reserverTerrain.prix.surPlace', '{{prix}}, à régler sur place', {
      prix: formatEuros(Number(reservation.price.amount)),
      ...SANS_ECHAPPEMENT,
    })
    : '';
  const lienAgenda = lienAgendaGoogle({
    debut: reservation.startsAt,
    details: t(
      'reserverTerrain.maReservation.agendaDetails',
      'Réservé sur FoundClub. Paiement sur place.',
    ),
    fin: reservation.endsAt,
    lieu: adresse,
    titre: `${String(reservation?.terrain?.name || '')} · ${nomDuComplexe}`,
  });
  const reserveePar = String(reservation?.bookerLabel || '').trim();
  let ligneDuParticipant = '';
  if (participant && reserveePar && groupe?.equipe?.name) {
    ligneDuParticipant = t(
      'reserverTerrain.maReservation.pourEquipe',
      'Pour {{equipe}} · réservée par {{reserveur}}',
      { equipe: String(groupe.equipe.name), reserveur: reserveePar, ...SANS_ECHAPPEMENT },
    );
  } else if (participant && reserveePar) {
    ligneDuParticipant = t(
      'reserverTerrain.maReservation.reserveePar',
      'Réservée par {{reserveur}}',
      { reserveur: reserveePar, ...SANS_ECHAPPEMENT },
    );
  }

  const quandOu = (
    <View style={carte}>
      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
        {t('reserverTerrain.recapitulatif.quand', '{{jour}} · {{creneau}}', {
          creneau: texteCreneau(reservation.from, reservation.to),
          jour: texteJourLong(t, reservation.date),
          ...SANS_ECHAPPEMENT,
        })}
      </Text>
      <TouchableOpacity
        accessibilityRole="link"
        disabled={!slug}
        onPress={() => navigation.navigate(RouteNames.ReserverComplexe, { slug })}
        style={{ justifyContent: 'center', minHeight: 44 }}
      >
        <Text style={[Fonts.p2Bold, Fonts.primary200]}>
          {[nomDuComplexe, reservation?.terrain?.name].filter(Boolean).join(' · ')}
        </Text>
      </TouchableOpacity>
      {ligneDuParticipant ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>{ligneDuParticipant}</Text>
      ) : null}
      {prix ? <Text style={[Fonts.p2, Fonts.neutral100]}>{prix}</Text> : null}
      {!varianteDEnTete ? (
        <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
          {adresse ? (
            <Button
              icon="pin"
              onPress={() => openExternalMap({
                label: adresse,
                latitude: complexePublic?.address?.lat,
                longitude: complexePublic?.address?.lng,
              })}
              size="sm"
              title={t('reserverTerrain.complexe.itineraire', 'Itinéraire')}
              variant="Secondary"
            />
          ) : null}
          {lienAgenda && !commence ? (
            <Button
              icon="calendar"
              onPress={() => {
                Linking.openURL(lienAgenda).catch(() => {});
              }}
              size="sm"
              title={t('reserverTerrain.maReservation.agenda', 'Ajouter à l’agenda')}
              variant="Secondary"
            />
          ) : null}
          {!participant ? (
            <Button
              icon="envelope"
              isLoading={Boolean(ouvrirUnFil?.isPending)}
              onPress={() => ouvrirLeFil('complexe')}
              size="sm"
              title={texteInsecable(t(
                'reserverTerrain.maReservation.ecrireAuComplexe',
                'Écrire au complexe',
              ))}
              variant="Secondary"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );

  // RESA-L6B-2 — « Tu viens ? » (planche EP07 état 3) : un participant d'une partie à venir.
  const reponseActuelle = groupe?.myResponse || reservation?.myResponse || 'sans_reponse';
  const boutonDeReponse = (/** @type {'absent' | 'present'} */ cle, /** @type {string} */ mot) => {
    const choisi = reponseActuelle === cle;
    return (
      <TouchableOpacity
        accessibilityLabel={mot}
        accessibilityRole="button"
        accessibilityState={{ busy: Boolean(repondre?.isPending), selected: choisi }}
        disabled={Boolean(repondre?.isPending)}
        onPress={() => repondreALaPartie(cle)}
        style={{
          alignItems: 'center',
          backgroundColor: choisi ? Colors.primary500 : 'transparent',
          borderColor: Colors.primary500,
          borderRadius: 12,
          borderWidth: 1,
          flex: 1,
          justifyContent: 'center',
          minHeight: 48,
        }}
        testID={`ma-reservation-${cle}`}
      >
        <Text style={[Fonts.p2Bold, choisi ? Fonts.primary900 : Fonts.primary200]}>{mot}</Text>
      </TouchableOpacity>
    );
  };
  const tuViens = participant && partieEnCours ? (
    <View style={{ ...carte, borderColor: Colors.primary500, borderLeftWidth: 4 }}>
      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
        {t('reserverTerrain.maReservation.tuViens', 'Tu viens ?')}
      </Text>
      <View style={[Alignments.row, { gap: 8 }]}>
        {boutonDeReponse('present', t('reserverTerrain.participants.present', 'Présent'))}
        {boutonDeReponse('absent', t('reserverTerrain.participants.absent', 'Absent'))}
      </View>
      {refusDeReponse ? (
        <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>
          {refusDeReponse}
        </Text>
      ) : null}
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {t(
          'reserverTerrain.maReservation.honneurPresent',
          'Tu t’engages sur l’honneur à venir si tu réponds présent.',
        )}
      </Text>
    </View>
  ) : null;

  const actions = !varianteDEnTete && groupe ? (
    <View style={{ gap: 8 }}>
      {!participant && partieEnCours ? (
        <CarteDAction
          icone="share"
          libelle={t('reserverTerrain.lien.titre', 'Inviter par lien')}
          onPress={() => setFeuille('lien')}
        />
      ) : null}
      {peutChercherDesJoueurs(groupe, reservation) ? (
        <CarteDAction
          icone="users"
          libelle={t('reserverTerrain.annonce.titre', 'Il me manque des joueurs')}
          onPress={chercherDesJoueurs}
        />
      ) : null}
      <CarteDAction
        icone="envelope"
        libelle={t('reserverTerrain.maReservation.discussion', 'Discussion du groupe')}
        occupee={Boolean(ouvrirUnFil?.isPending)}
        onPress={() => ouvrirLeFil('discussion')}
      />
      {refusDuFil ? (
        <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{refusDuFil}</Text>
      ) : null}
    </View>
  ) : null;

  // RESA-L6B-2 — la fidélité du complexe (RG-FIDELITE, planche EP07 bloc 5).
  const fidelite = apercuDeLaFidelite(t, relation?.fidelite);
  let texteDeFidelite = '';
  if (fidelite?.disponible) texteDeFidelite = fidelite.texte;
  else if (fidelite && partieEnCours) {
    texteDeFidelite = t(
      'reserverTerrain.fidelite.compteraPour',
      'Cette partie comptera pour ta fidélité : {{reste}}',
      {
        reste: `${fidelite.texte.charAt(0).toLocaleLowerCase()}${fidelite.texte.slice(1)}`,
        ...SANS_ECHAPPEMENT,
      },
    );
  }
  const blocFidelite = texteDeFidelite ? (
    <View
      style={{
        ...carte,
        backgroundColor: withAlpha(Colors.primary500, 0.08),
        borderColor: withAlpha(Colors.primary500, 0.45),
      }}
      testID="ma-reservation-fidelite"
    >
      <Text style={[Fonts.p2, Fonts.neutral00]}>{texteDeFidelite}</Text>
    </View>
  ) : null;

  let annulation = null;
  if (participant) {
    annulation = null;
  } else if (!varianteDEnTete && enCollecte && !commence) {
    annulation = (
      <View style={carte}>
        <Button
          onPress={() => setConfirmation(true)}
          title={t('reserverTerrain.maReservation.arreterLaCollecte', 'Arrêter la collecte')}
          variant="Danger"
        />
        {autresPresents > 0 ? (
          <Text style={[Fonts.p3, Fonts.neutral100]}>
            {t('reserverTerrain.maReservation.inscritsPrevenus', {
              count: autresPresents,
              defaultValue_one: 'L’inscrit sera prévenu.',
              defaultValue_other: 'Les {{count}} inscrits seront prévenus.',
            })}
          </Text>
        ) : null}
      </View>
    );
  } else if (!varianteDEnTete && demande && !commence) {
    annulation = (
      <View style={carte}>
        {echeance ? (
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t(
              'reserverTerrain.resultat.demandeEcheance',
              '{{complexe}} te répond avant le {{date}} à {{heure}}. '
                + 'Le créneau t’est gardé jusque-là.',
              {
                complexe: nomDuComplexe,
                date: echeance.jour,
                heure: echeance.heure,
                ...SANS_ECHAPPEMENT,
              },
            )}
          </Text>
        ) : null}
        <Button
          onPress={() => setConfirmation(true)}
          title={t('reserverTerrain.maReservation.annulerLaDemande', 'Annuler la demande')}
          variant="Danger"
        />
      </View>
    );
  } else if (!varianteDEnTete && etat === 'confirmee' && reservation.canCancel && !refusTropTard) {
    annulation = (
      <View style={carte}>
        <Button
          onPress={() => setConfirmation(true)}
          title={t('reserverTerrain.maReservation.annuler', 'Annuler la réservation')}
          variant="Danger"
        />
        {jusquA ? (
          <Text style={[Fonts.p3, Fonts.neutral100]}>
            {t(
              'reserverTerrain.maReservation.gratuitJusqua',
              'Gratuit jusqu’au {{jour}} à {{heure}}.',
              {
                heure: jusquA.heure,
                jour: jusquA.jour,
                ...SANS_ECHAPPEMENT,
              },
            )}
          </Text>
        ) : null}
      </View>
    );
  } else if (!varianteDEnTete && etat === 'confirmee' && !commence) {
    const contenu = refusTropTard || contenuDEchec(t, 'delaiAnnulation', { telephone });
    annulation = (
      <View style={carte}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{contenu.titre}</Text>
        {contenu.telephone ? (
          <Button
            icon="phone"
            onPress={() => appeler(contenu.telephone)}
            title={t('reserverTerrain.telephone.appeler', 'Appeler le {{numero}}', {
              numero: numeroLisible(contenu.telephone),
              ...SANS_ECHAPPEMENT,
            })}
            variant="Primary"
          />
        ) : null}
      </View>
    );
  } else if (etat === 'jouee') {
    annulation = (
      <Button
        onPress={versLeCalendrier}
        title={t('reserverTerrain.maReservation.reserverANouveau', 'Réserver à nouveau')}
        variant="Primary"
      />
    );
  }

  const historique = creation || reservation.note || confirmeeLaVeille || marqueeNonHonoree ? (
    <View style={{ gap: 4 }}>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
        {t('reserverTerrain.maReservation.historique', 'Historique')}
      </Text>
      {creation ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('reserverTerrain.maReservation.reservee', 'Réservée le {{jour}} à {{heure}}', {
            heure: creation.heure,
            jour: creation.jour,
            ...SANS_ECHAPPEMENT,
          })}
        </Text>
      ) : null}
      {confirmeeLaVeille ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('reserverTerrain.maReservation.confirmeeLaVeille', {
            defaultValue: 'Confirmée la veille, le {{jour}} à {{heure}}',
            heure: confirmeeLaVeille.heure,
            jour: confirmeeLaVeille.jour,
            ...SANS_ECHAPPEMENT,
          })}
        </Text>
      ) : null}
      {marqueeNonHonoree ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {rangDeNonHonoree
            ? t('reserverTerrain.maReservation.marqueeNonHonoreeRang', {
              defaultValue:
                'Marquée non honorée par le complexe le {{jour}} ({{rang}} sur {{seuil}})',
              jour: marqueeNonHonoree.jour,
              ...rangDeNonHonoree,
              ...SANS_ECHAPPEMENT,
            })
            : t('reserverTerrain.maReservation.marqueeNonHonoree', {
              defaultValue: 'Marquée non honorée par le complexe le {{jour}}',
              jour: marqueeNonHonoree.jour,
              ...SANS_ECHAPPEMENT,
            })}
        </Text>
      ) : null}
      {reservation.note ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('reserverTerrain.maReservation.petitMot', 'Ton petit mot : « {{mot}} »', {
            mot: String(reservation.note),
            ...SANS_ECHAPPEMENT,
          })}
        </Text>
      ) : null}
    </View>
  ) : null;

  // RESA-FIN-APP (22/10) — l'heure en un seul mot (même défaut que la veille, « 17 / h »).
  const quand = debut
    ? t('reserverTerrain.maReservation.jourAHeure', '{{jour}} à {{heure}}', {
      heure: texteInsecable(debut.heure),
      jour: debut.jour,
      ...SANS_ECHAPPEMENT,
    })
    : '';
  let questionDAnnulation = t(
    'reserverTerrain.maReservation.annulerQuestion',
    'Annuler ta réservation du {{quand}} ?',
    { quand, ...SANS_ECHAPPEMENT },
  );
  if (enCollecte) {
    questionDAnnulation = t(
      'reserverTerrain.maReservation.arreterQuestion',
      'Arrêter la collecte du {{quand}} ?',
      { quand, ...SANS_ECHAPPEMENT },
    );
  } else if (demande) {
    questionDAnnulation = t(
      'reserverTerrain.maReservation.retirerQuestion',
      'Retirer ta demande du {{quand}} ?',
      { quand, ...SANS_ECHAPPEMENT },
    );
  }
  let ouiDAnnulation = t('reserverTerrain.maReservation.ouiAnnuler', 'Oui, annuler');
  if (enCollecte) ouiDAnnulation = t('reserverTerrain.maReservation.ouiArreter', 'Oui, arrêter');
  else if (demande) ouiDAnnulation = t('reserverTerrain.maReservation.ouiRetirer', 'Oui, retirer');

  return (
    <>
      {enveloppe(
        <>
          {enTete}
          {enTeteDEchec}
          {quandOu}
          {tuViens}
          {!varianteDEnTete ? <BlocParticipants groupe={groupe} /> : null}
          {actions}
          {blocFidelite}
          {bandeau ? (
            <View
              accessibilityRole="alert"
              style={{
                ...carte,
                backgroundColor: withAlpha(Colors.error500, 0.1),
                borderColor: withAlpha(Colors.error500, 0.45),
              }}
            >
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{bandeau}</Text>
            </View>
          ) : null}
          {annulation}
          {historique}
        </>,
      )}
      <BottomModal
        close={() => setConfirmation(false)}
        isVisible={confirmation}
        webPresentation="dialog"
      >
        <View style={{ gap: 12 }}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{questionDAnnulation}</Text>
          {!demande && !enCollecte && jusquA ? (
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t(
                'reserverTerrain.maReservation.annulerTexte',
                'Le complexe sera prévenu. C’est gratuit jusqu’au {{jour}} à {{heure}}.',
                { heure: jusquA.heure, jour: jusquA.jour, ...SANS_ECHAPPEMENT },
              )}
            </Text>
          ) : null}
          {!demande && autresPresents > 0 ? (
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('reserverTerrain.maReservation.presentsPrevenus', {
                count: autresPresents,
                defaultValue_one: 'Le participant présent sera prévenu.',
                defaultValue_other: 'Les {{count}} participants présents seront prévenus.',
              })}
            </Text>
          ) : null}
          <Button
            isLoading={Boolean(annuler?.isPending)}
            onPress={confirmerLAnnulation}
            title={ouiDAnnulation}
            variant="Danger"
          />
          <Button
            onPress={() => setConfirmation(false)}
            title={t('reserverTerrain.maReservation.garder', 'Garder')}
            variant="Ghost"
          />
        </View>
      </BottomModal>
      {feuille === 'lien' && !participant ? (
        <FeuilleInviterParLien
          close={() => setFeuille(null)}
          partie={{
            complexe: nomDuComplexe,
            date: reservation.date,
            from: reservation.from,
            sport: reservation?.terrain?.sport?.name,
          }}
          reservationId={reservation.documentId}
        />
      ) : null}
      {feuille === 'annonce' && groupe && peutChercherDesJoueurs(groupe, reservation)
        && !groupe.annonce ? (
          <FeuilleAnnonce
            ageMinimum={ageMinimum}
            close={() => setFeuille(null)}
            groupe={groupe}
            onPubliee={(annonce) => {
              setFeuille(null);
              if (annonce?.documentId) {
                navigation.navigate(RouteNames.ReserverAnnonce, {
                  annonceId: annonce.documentId,
                  // RESA-FIN-APP (22/10) — le nombre de favoris prévenus (`favoritesNotified`,
                  // RESA-FIN-SERVEUR), s'il est rendu.
                  favorisPrevenus: Number.isFinite(annonce?.favoritesNotified)
                    ? annonce.favoritesNotified
                    : undefined,
                  publiee: true,
                  reservationId: reservation.documentId,
                });
              }
            }}
            reservation={reservation}
          />
        ) : null}
    </>
  );
}

export default ReserverMaReservation;
