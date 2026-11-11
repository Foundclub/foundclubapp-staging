import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, ScrollView, Text, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  formatEuros, minutesDe, texteDuree, texteHeure,
} from '@/domains/complexe/complexeTerrain';
import {
  dateEtHeureDeParis,
  etatAffiche,
  texteCreneau,
  texteJourCourt,
} from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import ScreenContainer from '@/components/templates/ScreenContainer';
import useRetraitBasDuDefilement from '@/components/templates/useRetraitBasDuDefilement';
import FeuilleInviterParLien from '@/views/reserverTerrain/components/FeuilleInviterParLien';
import PastilleEtat from '@/views/reserverTerrain/components/PastilleEtat';

import allerDansLOnglet from '@/navigation/allerDansLOnglet';
import { RouteNames } from '@/navigation/routeNames';

import { useMaReservation, useTerrainsPublics } from '@/services/complexe/complexeJoueurQueries';

import { useIsDesktop } from '@/responsive';

const COLONNE = 560;
const PICTO = 72;

/**
 * E-P05 — « LE RÉSULTAT » — RESA-L6A (14/10/2026), planches EP05 et P00 bloc 4, plan E-P05. Un même
 * gabarit (pictogramme sans emoji, titre, phrase, carte résumé, boutons), deux variantes :
 *   · « C'est réservé ! » (terrain automatique) ;
 *   · « Demande envoyée » (sur demande) : « Le Five de Montrivage te répond avant le 16/10 à
 *     16 h. Le créneau t'est gardé jusque-là. » (AT-08 : une demande tient le créneau).
 * Puis « Voir ma réservation » / « Voir ma demande » (E-P07) et « Retour à l'accueil » (pas de
 * retour au récapitulatif : E-P04 a cédé sa place à cet écran). Aucun chargement : l'écran arrive
 * avec la réponse du serveur (paramètre `reservation`).
 * Ordinateur (OR3, gabarit B) : la colonne centrée.
 * RESA-L6B-2 (20/10/2026, serveur RESA-L3 ; planche EP05 états 1, 3, 4) : « Inviter par lien »
 * (Primary, la feuille du lien sans « Désactiver ») et « Voir ma réservation » (Secondary) ; la
 * collecte lancée (« Collecte lancée : 1/10 », la phrase d'A-P08 annoncée d'avance, la jauge et la
 * date limite, « Il me manque des joueurs » ⇒ l'annonce sur la fiche, « Voir ma collecte ») ; la
 * réservation d'une équipe (« C'est réservé pour U15 Valbrune ! », « au nom de », les joueurs
 * prévenus, N-27). Paramètres en plus : `collecte` (`{ quorum, collectDeadline }`) et `equipe`
 * (`{ name, membres }`), que E-P04 connaît et que la réservation du serveur ne porte pas.
 * ⛔ « Tu as rejoint le canal » (1re réservation, RG-CANAL) : la réponse du serveur ne le dit pas
 * (le serveur y fait entrer sans le rendre) ; rien n'est affiché plutôt qu'une phrase devinée.
 * RESA-JOUEUR-2 (11/11/2026, maquette « 232- ok ») : la carte résumé reprend la photo du terrain
 * (la page publique du complexe la donne), la durée et ce que paie le groupe (« 150 € pour 10
 * joueurs ») ; la collecte devient la « Réservation en construction » : jauge « 6 sur 10 », ce qui
 * manque, et deux bandeaux (le créneau peut encore être pris ; l'annonce est en ligne, si elle est
 * vraiment partie : `collecte.annonce`). Retirés par la maquette : « Collecte lancée : 1/10 », la
 * date limite, « Il me manque des joueurs » (l'annonce part toute seule) et « Voir ma collecte ».
 * Caché par `COMPLEXES_JOUEUR`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ReserverResultat() {
  const retraitBas = useRetraitBasDuDefilement(12);
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  /** @type {{ collecte?: any, equipe?: any, reservation?: any, reservationId?: string }} */
  const params = /** @type {any} */ (route?.params) || {};
  // RESA-FIN-SITE (21/10/2026, tournée connectée du 22/10) — la réservation arrive en paramètre ;
  // sans elle (page du site rechargée), l'écran la relit par son identifiant au lieu de dire
  // « Cette réservation n'existe plus. ».
  const relue = useMaReservation(params.reservation ? null : (params.reservationId || null));
  const reservation = params.reservation || relue?.data || null;
  const enRelecture = !params.reservation
    && Boolean(params.reservationId)
    && Boolean(relue?.isLoading);
  const collecte = params.collecte || null;
  const equipe = params.equipe || null;
  const surOrdinateur = useIsDesktop();
  const { userData } = useAuth();
  const [inviter, setInviter] = useState(false);

  // RESA-FIN-APP (20/10) — « l'accueil », c'est la racine de l'onglet Accueil (`popToTop` ramenait
  // au HomeTab tel qu'on l'avait laissé : sur la recherche, tournée 2). Plan E-P05 §4 : « retour ⇒
  // accueil (pas de retour au récapitulatif) » : le retour arrière y mène aussi.
  const versLAccueil = () => allerDansLOnglet(navigation, RouteNames.SearchHome);
  useEffect(() => navigation.addListener?.('beforeRemove', (/** @type {any} */ evenement) => {
    const geste = evenement?.data?.action?.type;
    if (geste !== 'GO_BACK' && geste !== 'POP') return;
    evenement.preventDefault();
    allerDansLOnglet(navigation, RouteNames.SearchHome);
  }), [navigation]);
  // La fiche REMPLACE le résultat : après une annulation faite depuis la fiche, rien de périmé
  // (« C'est réservé ! · Confirmée ») ne reste derrière elle (tournée 1).
  const versLaFiche = (/** @type {Record<string, any>} */ autres = {}) => navigation.replace(
    RouteNames.ReserverMaReservation,
    { reservationId: reservation.documentId, ...autres },
  );
  const etat = etatAffiche(reservation);
  const demande = etat === 'enAttente';
  const enCollecte = etat === 'enCollecte';
  const echeance = dateEtHeureDeParis(reservation?.expiresAt);
  // RESA-JOUEUR : les présents annoncés au récapitulatif (« On est combien, toi compris ? ») ; sans
  // eux (page relue), le réserveur seul (D3).
  const presents = Math.max(1, Number(collecte?.presents) || 1);
  const quorum = Number(collecte?.quorum) || Number(reservation?.players) || 0;
  const manque = Math.max(0, quorum - presents);
  // RESA-JOUEUR-2 : la photo du terrain, lue sur la page publique du complexe (la réservation ne
  // la porte pas) ; sans photo, rien.
  const terrainsDuComplexe = useTerrainsPublics(reservation?.complexe?.slug || null)?.data;
  const terrainPublic = Array.isArray(terrainsDuComplexe)
    ? terrainsDuComplexe.find((/** @type {any} */ unTerrain) => (
      unTerrain?.documentId === reservation?.terrain?.documentId
    ))
    : null;
  const photo = Array.isArray(terrainPublic?.photos) && terrainPublic.photos[0]
    ? String(terrainPublic.photos[0])
    : null;
  const nomDuCompte = [userData?.firstname, userData?.lastname]
    .map((morceau) => String(morceau || '').trim())
    .filter(Boolean)
    .join(' ');

  let corps = null;
  if (enRelecture) {
    corps = null;
  } else if (!reservation) {
    corps = (
      <View style={{ alignItems: 'center', gap: 16 }}>
        <Text style={[Fonts.h4Bold, Fonts.neutral00, Fonts.textCenter]}>
          {t('reserverTerrain.echec.introuvable', 'Cette réservation n’existe plus.')}
        </Text>
      </View>
    );
  } else {
    const complexe = String(reservation?.complexe?.name || '');
    const prix = Number.isFinite(Number(reservation?.price?.amount))
      ? t('reserverTerrain.prix.surPlace', '{{prix}}, à régler sur place', {
        // BH16 P13-20 : un prix par joueur le dit (même texte que le récapitulatif, prixSurPlace).
        prix: reservation.price.unit === 'joueur'
          ? t('reserverTerrain.prix.parJoueur', '{{prix}} par joueur', {
            prix: formatEuros(Number(reservation.price.amount)),
            ...SANS_ECHAPPEMENT,
          })
          : formatEuros(Number(reservation.price.amount)),
        ...SANS_ECHAPPEMENT,
      })
      : '';
    // RESA-JOUEUR-2 : un prix par joueur se dit pour tout le groupe (« 60 € pour 10 joueurs »).
    const prixDuGroupe = reservation?.price?.unit === 'joueur'
      && Number.isFinite(Number(reservation?.price?.amount))
      && quorum > 0
      ? t(
        'reserverTerrain.resultat.prixDuGroupe',
        '{{total}} pour {{nombre}} joueurs, à régler sur place',
        {
          nombre: quorum,
          total: formatEuros(Number(reservation.price.amount) * quorum),
          ...SANS_ECHAPPEMENT,
        },
      )
      : prix;
    const debut = minutesDe(reservation?.from);
    const fin = minutesDe(reservation?.to);
    let duree = '';
    if (debut !== null && fin !== null) {
      // Un créneau qui finit à minuit (« 0 h ») finit le lendemain.
      duree = texteDuree(fin > debut ? fin - debut : fin + 24 * 60 - debut);
    }
    const terrain = String(reservation?.terrain?.name || '');
    let phrase = null;
    if (demande && echeance) {
      const [, mois, jour] = echeance.date.split('-');
      phrase = t(
        'reserverTerrain.resultat.demandeEcheance',
        '{{complexe}} te répond avant le {{date}} à {{heure}}. Le créneau t’est gardé jusque-là.',
        {
          complexe,
          date: `${jour}/${mois}`,
          heure: texteHeure(echeance.heure),
          ...SANS_ECHAPPEMENT,
        },
      );
    } else if (demande) {
      phrase = t(
        'reserverTerrain.resultat.demandeSansEcheance',
        '{{complexe}} te répond bientôt. Le créneau t’est gardé jusque-là.',
        { complexe, ...SANS_ECHAPPEMENT },
      );
    }
    let couleur = Colors.success500;
    let picto = (
      <Image
        source={Images.check}
        style={[{ height: 32, width: 32 }, ApplicationStyle.tintColor.success500]}
      />
    );
    let titre = t('reserverTerrain.resultat.reserve', 'C’est réservé !');
    if (demande) {
      couleur = Colors.warning500;
      picto = <GlyphIcon color={Colors.warning500} name="hourglass" size={32} />;
      titre = t('reserverTerrain.resultat.demandeEnvoyee', 'Demande envoyée');
    } else if (enCollecte) {
      couleur = Colors.warning500;
      picto = <GlyphIcon color={Colors.warning500} name="hourglass" size={32} />;
      titre = t('reserverTerrain.resultat.enConstruction', 'Réservation en construction');
    } else if (equipe?.name) {
      titre = t('reserverTerrain.resultat.reservePourEquipe', 'C’est réservé pour {{equipe}} !', {
        equipe: String(equipe.name),
        ...SANS_ECHAPPEMENT,
      });
    }
    const membres = Number(equipe?.membres);
    const pourLEquipe = Boolean(equipe?.name && nomDuCompte);
    const deuxiemeLigne = pourLEquipe
      ? [complexe, t('reserverTerrain.resultat.auNomDe', 'au nom de {{nom}}', {
        nom: nomDuCompte,
        ...SANS_ECHAPPEMENT,
      })]
      : [terrain, duree, complexe];
    const jourEtCreneau = t('reserverTerrain.resultat.jourEtCreneau', '{{jour}} · {{creneau}}', {
      creneau: texteCreneau(reservation.from, reservation.to),
      jour: texteJourCourt(t, reservation.date),
      ...SANS_ECHAPPEMENT,
    });
    const bandeau = (/** @type {string} */ texte, /** @type {string} */ teinte) => (
      <View
        style={{
          alignSelf: 'stretch',
          backgroundColor: withAlpha(teinte, 0.1),
          borderColor: withAlpha(teinte, 0.45),
          borderRadius: 16,
          borderWidth: 1,
          padding: 12,
        }}
      >
        <Text style={[Fonts.p2, Fonts.neutral00]}>{texte}</Text>
      </View>
    );
    corps = (
      <View style={{ alignItems: 'center', gap: 16 }}>
        <View
          style={[
            Alignments.alignCenter,
            Alignments.justifyCenter,
            {
              backgroundColor: withAlpha(couleur, 0.16),
              borderRadius: PICTO / 2,
              height: PICTO,
              width: PICTO,
            },
          ]}
        >
          {picto}
        </View>
        <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00, Fonts.textCenter]}>
          {titre}
        </Text>
        {phrase ? (
          <Text style={[Fonts.p1, Fonts.neutral100, Fonts.textCenter]}>{phrase}</Text>
        ) : null}
        {/* RESA-FIN-APP (22/10, Adel « 1- A ») — RG-CANAL : « Tu as rejoint le canal de … » quand
            CETTE réservation fait entrer le joueur dans le canal (`joinedChannel`,
            RESA-FIN-SERVEUR) ; lecture tolérante : rien si le serveur ne le dit pas. */}
        {reservation?.joinedChannel === true ? (
          <Text
            style={[Fonts.p2, Fonts.neutral100, Fonts.textCenter]}
            testID="resultat-canal-rejoint"
          >
            {t('reserverTerrain.resultat.canalRejoint', {
              complexe: String(reservation?.complexe?.name || ''),
              defaultValue: 'Tu as rejoint le canal de {{complexe}}.',
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
        ) : null}
        <View
          style={{
            alignSelf: 'stretch',
            backgroundColor: withAlpha(Colors.primary800, 0.6),
            borderColor: withAlpha(Colors.primary500, 0.24),
            borderRadius: 20,
            borderWidth: 1,
            gap: 6,
            padding: 16,
          }}
        >
          {photo ? (
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="cover"
              source={{ uri: photo }}
              style={{ borderRadius: 12, height: 120, width: '100%' }}
              testID="resultat-photo"
            />
          ) : null}
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {enCollecte || pourLEquipe
              ? t('reserverTerrain.resultat.resume', '{{jour}} · {{creneau}} · {{terrain}}', {
                creneau: texteCreneau(reservation.from, reservation.to),
                jour: texteJourCourt(t, reservation.date),
                terrain,
                ...SANS_ECHAPPEMENT,
              })
              : jourEtCreneau}
          </Text>
          {enCollecte ? (
            <View style={{ gap: 6 }}>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {[complexe, duree].filter(Boolean).join(' · ')}
              </Text>
              <View style={[Alignments.row, Alignments.alignCenter, { flexWrap: 'wrap', gap: 8 }]}>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                  {t('reserverTerrain.resultat.surRequis', '{{presents}} sur {{quorum}}', {
                    presents,
                    quorum,
                  })}
                </Text>
                {manque ? (
                  <Text style={[Fonts.p2Bold, Fonts.warning500]}>
                    {t('reserverTerrain.resultat.ilManque', {
                      count: manque,
                      defaultValue_one: 'Il manque {{count}} joueur',
                      defaultValue_other: 'Il manque {{count}} joueurs',
                    })}
                  </Text>
                ) : null}
              </View>
              <View
                style={{
                  backgroundColor: withAlpha(Colors.primary500, 0.18),
                  borderRadius: 4,
                  height: 8,
                  overflow: 'hidden',
                }}
                testID="resultat-jauge"
              >
                <View
                  style={{
                    backgroundColor: Colors.primary500,
                    height: 8,
                    width: `${quorum ? Math.round((presents / quorum) * 100) : 0}%`,
                  }}
                />
              </View>
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: withAlpha(Colors.warning500, 0.16),
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={[Fonts.p3Bold, Fonts.warning500]}>
                  {t('reserverTerrain.resultat.pastilleConstruction', 'En construction')}
                </Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {deuxiemeLigne.filter(Boolean).join(' · ')}
              </Text>
              {!pourLEquipe && prixDuGroupe ? (
                <Text style={[Fonts.p2, Fonts.neutral100]}>{prixDuGroupe}</Text>
              ) : null}
              <PastilleEtat etat={etat} />
            </>
          )}
        </View>
        {enCollecte ? bandeau(t(
          'reserverTerrain.resultat.creneauOuvert',
          'Tant que ce n’est pas confirmé, un autre groupe peut prendre ce créneau. '
            + 'Dis « On a assez de joueurs » dès que ton groupe est prêt.',
        ), Colors.warning500) : null}
        {enCollecte && collecte?.annonce === true && manque ? bandeau(t(
          'reserverTerrain.resultat.annonceEnLigne',
          {
            count: manque,
            defaultValue_one: 'Ton annonce « Il manque {{count}} joueur » est en ligne dans '
              + '« Recherche de joueurs ».',
            defaultValue_other: 'Ton annonce « Il manque {{count}} joueurs » est en ligne dans '
              + '« Recherche de joueurs ».',
            ...SANS_ECHAPPEMENT,
          },
        ), Colors.primary500) : null}
        {equipe?.name && Number.isFinite(membres) && membres > 0 ? (
          <View
            style={{
              alignSelf: 'stretch',
              backgroundColor: withAlpha(Colors.success500, 0.12),
              borderColor: withAlpha(Colors.success500, 0.5),
              borderRadius: 16,
              borderWidth: 1,
              padding: 12,
            }}
          >
            <Text style={[Fonts.p2, Fonts.neutral00]}>
              {t('reserverTerrain.resultat.equipePrevenue', {
                count: membres,
                defaultValue_one: 'Le joueur de {{equipe}} est prévenu.',
                defaultValue_other: 'Les {{count}} joueurs de {{equipe}} sont prévenus.',
                equipe: String(equipe.name),
                ...SANS_ECHAPPEMENT,
              })}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="scroll-edge"
      contentContainerStyle={[Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center',
          gap: 20,
          maxWidth: surOrdinateur ? COLONNE : undefined,
          paddingBottom: 24 + retraitBas,
          paddingTop: 48,
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {corps}
        <View style={{ gap: 10 }}>
          {reservation?.documentId && !demande ? (
            <Button
              icon="share"
              onPress={() => setInviter(true)}
              title={t('reserverTerrain.lien.titre', 'Inviter par lien')}
              variant="Primary"
            />
          ) : null}
          {reservation?.documentId ? (
            <Button
              onPress={() => versLaFiche()}
              title={
                demande
                  ? t('reserverTerrain.resultat.voirMaDemande', 'Voir ma demande')
                  : t('reserverTerrain.resultat.voirMaReservation', 'Voir ma réservation')
              }
              variant="Secondary"
            />
          ) : null}
          <Button
            onPress={versLAccueil}
            title={t('reserverTerrain.resultat.retourAccueil', 'Retour à l’accueil')}
            variant="Ghost"
          />
        </View>
      </ScrollView>
      {inviter && reservation?.documentId ? (
        <FeuilleInviterParLien
          close={() => setInviter(false)}
          partie={{
            complexe: reservation?.complexe?.name,
            date: reservation.date,
            from: reservation.from,
            sport: reservation?.terrain?.sport?.name,
          }}
          reservationId={reservation.documentId}
          sansDesactiver
        />
      ) : null}
    </ScreenContainer>
  );
}

export default ReserverResultat;
