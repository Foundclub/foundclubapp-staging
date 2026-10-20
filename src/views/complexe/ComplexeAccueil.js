import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { bandeauDeLAccueil, CASES_GERER, complexeChoisi } from '@/domains/complexe/complexeGerant';
import {
  chiffresDuPlanning,
  enJours,
  joursDeLaSemaine,
  lignesDeLaFrise,
  lignesDesPages,
  plageHoraire,
  prochainesReservations,
  STATUTS,
  totalDesPages,
} from '@/domains/complexe/complexeReservation';
import { creneauxDuJour } from '@/domains/complexe/complexeTerrain';
import { ecrireModeComplexe } from '@/domains/complexe/modeComplexe';
import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import ScreenContainer from '@/components/templates/ScreenContainer';
import JaugeOccupation from '@/views/collectivite/components/JaugeOccupation';
import BandeauComplexe from '@/views/complexe/components/BandeauComplexe';
import FriseDuJour from '@/views/complexe/components/FriseDuJour';
import LogoComplexe from '@/views/complexe/components/LogoComplexe';
import PastillesReservation from '@/views/complexe/components/PastillesReservation';
import FeuillePratiqueAussi from '@/views/home/FeuillePratiqueAussi';

import { RouteNames } from '@/navigation/routeNames';

import {
  useChiffresDuComplexe,
  useMesComplexes,
  usePlanning,
  useReservationsDuComplexe,
  useTerrains,
} from '@/services/complexe/complexeQueries';

import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';

import { SUPPORT_CONTACT_MAILTO } from '@/config/legalUrls';

const ROLES_QUI_ENCADRENT = Object.freeze(['coach', 'president']);

// OR1 (« le gérant au comptoir ») : la largeur à partir de laquelle l'accueil prend sa mise en
// page d'ordinateur, la même que l'accueil de la Ville (CollectiviteHome, LARGEUR_COLONNES).
const LARGEUR_ORDINATEUR = 1024;

/**
 * « AAAA-MM-JJ » et les minutes depuis minuit, à l'heure du téléphone.
 * @param {Date} instant - L'instant.
 * @returns {{ date: string, minutes: number }} Le jour civil et l'heure.
 */
const jourEtHeure = (instant) => ({
  date: [
    instant.getFullYear(),
    String(instant.getMonth() + 1).padStart(2, '0'),
    String(instant.getDate()).padStart(2, '0'),
  ].join('-'),
  minutes: instant.getHours() * 60 + instant.getMinutes(),
});

/**
 * E-G02 — L'ACCUEIL DU GESTIONNAIRE DE COMPLEXE — RESA-L5A1 (13/10/2026), planche EG02, dans la
 * coquille de l'espace Ville (CollectiviteHome) : en-tête (logo carré, nom, « Complexe de
 * réservation », cloche), la bascule vers le mode joueur (planche RB), UN bandeau d'état (le
 * premier vrai : retiré, suspendu, aucun terrain, un terrain sans créneaux), la frise
 * « Aujourd'hui », 4 chiffres, « Prochaines réservations », les cases « Gérer » (les trois mots
 * d'Adel d'abord, A-G03).
 * Ce qui dépend des RÉSERVATIONS (lot L2A, pas encore servi) est dans son état vide dessiné : la
 * frise toute « libre », les chiffres à 0, aucune réservation à venir ; l'alerte « Hier : … » ne
 * s'affiche pas (il n'y a rien à vérifier). RESA-L5B-2 (20/10/2026) : chaque case ouvre son
 * écran ; occupation et favoris (le nombre de la semaine, serveur RESA-L4) ouvrent les statistiques
 * (E-G17), « Créer une affiche » (E-G13) sous « Aucune réservation à venir ».
 * Paramètres de route : `complexeId` (sinon le premier complexe du compte), `justeCree`.
 * Caché par `COMPLEXES_GERANT` (la route n'existe pas tant qu'il est éteint).
 * @returns {import('react').ReactElement} L'écran.
 */
function ComplexeAccueil() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const params = /** @type {{ complexeId?: string, justeCree?: boolean } | undefined} */ (
    route?.params
  );
  const { accountRoleKey, setPlayerMode, userData } = useAuth();
  const mes = useMesComplexes();
  const complexe = complexeChoisi(mes.data, params?.complexeId);
  const complexeId = complexe?.documentId || null;
  const terrainsLus = useTerrains(complexeId);
  const [instant] = useState(() => new Date());
  const { date, minutes } = jourEtHeure(instant);
  const encadre = ROLES_QUI_ENCADRENT.includes(String(accountRoleKey || ''));
  const surOrdinateur = useWindowDimensions().width >= LARGEUR_ORDINATEUR;
  // RESA-L5A2 (14/10/2026) — la semaine (et hier, un lundi) au planning, les listes du serveur.
  const lundi = joursDeLaSemaine(date)[0];
  const hier = enJours(date, -1);
  const planning = usePlanning(
    complexeId,
    { from: hier < lundi ? hier : lundi, to: enJours(lundi, 6) },
    { enabled: Boolean(terrainsLus.data?.length) },
  );
  const duJour = useReservationsDuComplexe(complexeId, { vue: 'aujourdhui' });
  const aVenir = useReservationsDuComplexe(complexeId, { vue: 'a-venir' });
  const enAttente = useReservationsDuComplexe(complexeId, { vue: 'demandes' });
  // RESA-L5B-2 (20/10/2026) — les nouveaux favoris de la semaine (serveur RESA-L4, E-G17).
  const chiffresDuServeur = useChiffresDuComplexe(complexeId, 'semaine');

  const carte = {
    backgroundColor: withAlpha(Colors.primary700, 0.45),
    borderColor: withAlpha(Colors.primary500, 0.5),
    borderRadius: 16,
    borderWidth: 1,
  };

  const revenirEnModeJoueur = () => {
    ecrireModeComplexe(userData?.documentId, false);
    if (encadre) setPlayerMode?.(false);
    const pile = navigation.getParent?.() || navigation;
    pile.reset({ index: 0, routes: [{ name: RouteNames.HomeTab }] });
  };
  // RESA-INSCRIPTION (19/10/2026) — un compte né « pour un complexe » n'a aucun rôle sportif : un
  // accueil de joueur lui offrirait des gestes que son rôle provisoire n'a pas, sans âge connu.
  // « Voir l'app en joueur » ouvre d'abord « Tu pratiques aussi un sport ? » (PAR-L12, variante
  // complexe) ; « Oui » le fait Joueur, puis l'accueil, où son parcours d'inscription reprend (nom,
  // date de naissance) ; « Pas maintenant » le laisse sur son complexe.
  const sansRoleSportif = accountRoleKey === 'new';
  const [feuilleJoueur, setFeuilleJoueur] = useState(false);
  const voirLAppEnJoueur = () => {
    if (sansRoleSportif) setFeuilleJoueur(true);
    else revenirEnModeJoueur();
  };
  const ecrireAFoundClub = () => {
    Promise.resolve(Linking.openURL(SUPPORT_CONTACT_MAILTO)).catch(() => {});
  };
  const ouvrir = (/** @type {string} */ ecran, /** @type {Record<string, any>} */ extra = {}) => {
    navigation.navigate(ecran, { complexeId, ...extra });
  };

  const staff = accountRoleKey === 'coach'
    ? t('playerMode.staff.coach', 'entraîneur')
    : t('playerMode.staff.president', 'dirigeant');
  const libelleBascule = encadre
    ? t('playerMode.active.exit', 'Revenir en mode {{staff}}', { staff, ...SANS_ECHAPPEMENT })
    : t('playerMode.offer.enter', 'Voir l\'app en joueur');

  // ── En-tête et bascule ─────────────────────────────────────────────────────────────────
  const enTete = (
    <View style={[Alignments.row, Alignments.alignCenter, Spaces.marginTop[16], { gap: 12 }]}>
      <LogoComplexe logo={complexe?.logo || null} nom={String(complexe?.name || '')} taille={40} />
      <View style={{ flex: 1, gap: 0 }}>
        <Text
          accessibilityRole="header"
          numberOfLines={2}
          style={[
            surOrdinateur ? Fonts.h2Black : Fonts.p1Black,
            Fonts.neutral00,
            { flexGrow: 1, flexShrink: 1 },
          ]}
        >
          {String(complexe?.name || '').toUpperCase()}
        </Text>
        <Text style={[Fonts.p3Bold, Fonts.primary500, { letterSpacing: 0.6 }]}>
          {t('complexeGerant.badge.long', 'Complexe de réservation').toUpperCase()}
        </Text>
      </View>
      <NotificationBadge />
      <ProfileButton />
    </View>
  );

  const bascule = (
    <View
      style={{
        borderColor: withAlpha(Colors.primary500, 0.33),
        borderRadius: 24,
        borderWidth: 1,
        gap: 12,
        padding: 16,
      }}
      testID="complexe-accueil-bascule"
    >
      <Text style={[Fonts.p2, Fonts.neutral00]}>
        {t('complexeGerant.accueil.tuJouesAussi', 'Tu joues aussi ?')}
      </Text>
      <TouchableOpacity
        accessibilityLabel={libelleBascule}
        accessibilityRole="button"
        onPress={voirLAppEnJoueur}
        style={[
          Alignments.alignCenter,
          ApplicationStyle.borderRadius12,
          ApplicationStyle.backgroundColor.primary700,
          Spaces.paddingVertical[12],
        ]}
      >
        <Text style={[Alignments.selfStretch, Fonts.p2Bold, Fonts.textCenter, Fonts.neutral00]}>
          {libelleBascule}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const titreSection = (/** @type {string} */ libelle) => (
    <Text
      accessibilityRole="header"
      style={[Fonts.h4Bold, Fonts.neutral00, { flexGrow: 1, flexShrink: 1 }]}
    >
      {libelle}
    </Text>
  );

  // ── Accès retiré ───────────────────────────────────────────────────────────────────────
  if (!mes.isLoading && !mes.error && !complexe) {
    return (
      <ScreenContainer bgImage="bg2" contentContainerStyle={[Alignments.fill, Spaces.padding[24]]}>
        <View
          style={[carte, Spaces.padding[24], Alignments.alignCenter, { gap: 12 }]}
          testID="complexe-accueil-refus"
        >
          <Text style={[Fonts.h3Black, Fonts.neutral00, Fonts.textCenter]}>
            {t('complexeGerant.accueil.refus', 'Tu ne gères plus ce complexe.')}
          </Text>
          <Button
            onPress={revenirEnModeJoueur}
            title={t('complexeGerant.accueil.revenirJoueur', 'Revenir en mode joueur')}
            variant="Secondary"
          />
        </View>
      </ScreenContainer>
    );
  }

  const terrains = Array.isArray(terrainsLus.data) ? terrainsLus.data : [];
  const chargement = Boolean(mes.isLoading || terrainsLus.isLoading);
  const enPanne = Boolean(mes.error || terrainsLus.error);
  const etat = complexe && !chargement && !enPanne ? bandeauDeLAccueil(complexe, terrains) : null;
  const avecTerrains = !chargement && !enPanne && terrains.length > 0;
  const nom = String(complexe?.name || '');

  // ── Le bandeau d'état (un seul) ────────────────────────────────────────────────────────
  let bandeau = null;
  if (etat?.cle === 'retire') {
    bandeau = {
      action: t('complexeGerant.accueil.ecrireFoundClub', 'Écrire à FoundClub'),
      onAction: ecrireAFoundClub,
      texte: t('complexeGerant.refus.retire', 'Ce complexe a été retiré de FoundClub.'),
      ton: 'erreur',
    };
  } else if (etat?.cle === 'suspendu') {
    bandeau = {
      action: t('complexeGerant.accueil.ecrireFoundClub', 'Écrire à FoundClub'),
      onAction: ecrireAFoundClub,
      texte: t(
        'complexeGerant.accueil.suspendu',
        'Ton complexe est suspendu par FoundClub : il n’apparaît plus dans l’app.',
      ),
      ton: 'attention',
    };
  } else if (etat?.cle === 'aucunTerrain') {
    bandeau = {
      action: t('complexeGerant.accueil.ajouterTerrain', 'Ajouter un terrain'),
      onAction: () => ouvrir(RouteNames.ComplexeTerrain),
      texte: params?.justeCree
        ? t('complexeGerant.accueil.enLigne', '{{nom}} est en ligne. Ajoute ton premier terrain.', {
          nom,
          ...SANS_ECHAPPEMENT,
        })
        : t(
          'complexeGerant.accueil.premierTerrain',
          'Ajoute ton premier terrain pour recevoir des réservations.',
        ),
      ton: params?.justeCree ? 'ok' : 'info',
    };
  } else if (etat?.cle === 'sansCreneaux') {
    bandeau = {
      action: t('complexeGerant.accueil.ouvrirCreneaux', 'Ouvrir des créneaux'),
      onAction: () => ouvrir(RouteNames.ComplexeCreneaux, { terrainId: etat.terrain.documentId }),
      texte: t('complexeGerant.accueil.sansCreneaux', '{{terrain}} n’a pas encore de créneaux.', {
        terrain: String(etat.terrain.name || ''),
        ...SANS_ECHAPPEMENT,
      }),
      ton: 'info',
    };
  }

  // ── La frise « Aujourd'hui » ───────────────────────────────────────────────────────────
  // RESA-L5A2 : la frise du PLANNING du serveur (états, réservations) ; sans lui (chargement,
  // panne), les créneaux du modèle, tous « libre », comme avant.
  const couleurs = new Map(terrains.map((terrain) => [
    String(terrain.documentId), resolveFacilityPlanningColor(terrain),
  ]));
  const lignes = planning.data
    ? lignesDeLaFrise(t, planning.data, date)
      .map((ligne) => ({ ...ligne, couleur: couleurs.get(ligne.cle) || null }))
    : terrains
      .map((terrain) => ({
        cle: String(terrain.documentId),
        couleur: resolveFacilityPlanningColor(terrain),
        creneaux: creneauxDuJour(terrain.slotPlan, date)
          .map((creneau) => ({ ...creneau, etat: /** @type {'libre'} */ ('libre') })),
        nom: String(terrain.name || ''),
      }))
      .filter((ligne) => ligne.creneaux.length > 0);
  const toucherLaFrise = (/** @type {any} */ ligne, /** @type {any} */ creneau) => {
    if (creneau.reservationId) {
      ouvrir(RouteNames.ComplexeReservation, { reservationId: creneau.reservationId });
    } else {
      ouvrir(RouteNames.ComplexePlanning, { date, terrainId: ligne.cle });
    }
  };
  const jour = instant.toLocaleDateString(localeDesFormats(), {
    day: 'numeric', month: 'long', weekday: 'long',
  });
  const frise = lignes.length ? (
    <View style={{ gap: 8 }}>
      <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
        {t('complexeGerant.accueil.aujourdhui', 'Aujourd’hui · {{jour}}', {
          jour,
          ...SANS_ECHAPPEMENT,
        }).toUpperCase()}
      </Text>
      <FriseDuJour
        largeurNoms={surOrdinateur ? 120 : undefined}
        lignes={lignes}
        maintenant={minutes}
        onToucher={toucherLaFrise}
      />
    </View>
  ) : null;

  // ── Les 4 chiffres ─────────────────────────────────────────────────────────────────────
  const chiffresDeLaSemaine = chiffresDuPlanning(planning.data, date);
  /**
   * @type {Array<{ cle: string, jauge?: number, libelle: string, onPress?: () => void,
      valeur: string }>} */
  const tuiles = [
    {
      cle: 'reservations',
      libelle: t('complexeGerant.accueil.reservationsDuJour', 'réservations aujourd’hui'),
      onPress: () => ouvrir(RouteNames.ComplexeReservations, { vue: 'aujourdhui' }),
      valeur: String(chiffresDeLaSemaine.reservations),
    },
    {
      cle: 'occupation',
      jauge: chiffresDeLaSemaine.occupation,
      libelle: t('complexeGerant.accueil.occupation', 'd’occupation cette semaine'),
      onPress: () => ouvrir(RouteNames.ComplexeStatistiques),
      valeur: `${chiffresDeLaSemaine.occupation} %`,
    },
    {
      cle: 'demandes',
      libelle: t('complexeGerant.accueil.demandes', 'demandes en attente'),
      onPress: () => ouvrir(RouteNames.ComplexeDemandes),
      valeur: String(totalDesPages(enAttente.data) || 0),
    },
    {
      cle: 'favoris',
      libelle: t('complexeGerant.accueil.favoris', 'nouveaux favoris cette semaine'),
      onPress: () => ouvrir(RouteNames.ComplexeStatistiques),
      valeur: String(chiffresDuServeur.data?.favoris?.nouveaux || 0),
    },
  ];
  const chiffres = (
    <View
      style={[Alignments.row, { flexWrap: surOrdinateur ? 'nowrap' : 'wrap', gap: 12 }]}
      testID="complexe-accueil-chiffres"
    >
      {tuiles.map((tuile) => {
        const Tuile = tuile.onPress ? TouchableOpacity : View;
        return (
          <Tuile
            accessibilityLabel={`${tuile.valeur} ${tuile.libelle}`}
            accessibilityRole={tuile.onPress ? 'button' : undefined}
            accessible
            key={tuile.cle}
            onPress={tuile.onPress}
            style={[
              carte,
              Spaces.padding[16],
              {
                flexBasis: surOrdinateur ? 0 : 140, flexGrow: 1, gap: 6, minHeight: 104,
              },
            ]}
            testID={`complexe-accueil-chiffre-${tuile.cle}`}
          >
            <Text style={[Fonts.h2Black, Fonts.neutral00]}>{tuile.valeur}</Text>
            {tuile.jauge === undefined ? null : <JaugeOccupation taux={tuile.jauge} />}
            <Text style={[Fonts.p3, Fonts.neutral200]}>{tuile.libelle}</Text>
          </Tuile>
        );
      })}
    </View>
  );

  const lesProchaines = prochainesReservations(
    [...lignesDesPages(duJour.data), ...lignesDesPages(aVenir.data)],
    instant,
  );
  const prochaines = (
    <View style={{ gap: 12 }}>
      <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
        {titreSection(t('complexeGerant.accueil.prochaines', 'Prochaines réservations'))}
        <TouchableOpacity
          accessibilityRole="link"
          onPress={() => ouvrir(RouteNames.ComplexeReservations, { vue: 'a-venir' })}
          style={[Alignments.justifyCenter, { minHeight: 44 }]}
        >
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>
            {t('complexeReservations.accueil.toutVoir', 'Tout voir')}
          </Text>
        </TouchableOpacity>
      </View>
      {lesProchaines.length ? lesProchaines.map((ligne) => (
        <TouchableOpacity
          accessibilityRole="button"
          key={ligne.documentId}
          onPress={() => ouvrir(
            RouteNames.ComplexeReservation,
            { reservationId: ligne.documentId },
          )}
          style={[carte, Alignments.row, Spaces.padding[12], { gap: 12 }]}
          testID={`complexe-accueil-prochaine-${ligne.documentId}`}
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00, { width: 96 }]}>
            {plageHoraire(ligne.from, ligne.to)}
          </Text>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {`${String(ligne.label || '')} · ${String(ligne.terrain?.name || '')}`}
            </Text>
            <PastillesReservation
              sansEtat={ligne.source === 'exterieur' && ligne.status === STATUTS.confirmee}
              source={ligne.source}
              statut={ligne.status}
            />
          </View>
        </TouchableOpacity>
      )) : (
        <View style={[carte, Spaces.padding[16], { gap: 4 }]}>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'complexeGerant.accueil.aucuneAVenir',
              'Aucune réservation à venir. Fais connaître ta page.',
            )}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => ouvrir(RouteNames.ComplexeAffiches)}
            style={[Alignments.justifyCenter, { alignSelf: 'flex-start', minHeight: 44 }]}
            testID="complexe-accueil-creer-affiche"
          >
            <Text style={[Fonts.p2Bold, Fonts.primary500]}>
              {t('complexeGerant.accueil.creerAffiche', 'Créer une affiche')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
  // L'alerte « Hier » (RC-G01) : « Vérifier » ouvre les réservations passées, où chaque carte
  // marquable porte « Non honorée » (RESA-L5B-1, serveur RESA-L2B).
  const alerteHier = chiffresDeLaSemaine.hier ? (
    <BandeauComplexe
      action={t('complexeReservations.accueil.verifier', 'Vérifier')}
      onAction={() => ouvrir(RouteNames.ComplexeReservations, { vue: 'passees' })}
      testID="complexe-accueil-hier"
      texte={t(
        'complexeReservations.accueil.hier',
        'Hier : {{count}} réservations. Quelqu’un n’est pas venu ?',
        {
          count: chiffresDeLaSemaine.hier,
          defaultValue_one: 'Hier : {{count}} réservation. Quelqu’un n’est pas venu ?',
          defaultValue_other: 'Hier : {{count}} réservations. Quelqu’un n’est pas venu ?',
          ...SANS_ECHAPPEMENT,
        },
      )}
    />
  ) : null;

  // ── « Gérer » ──────────────────────────────────────────────────────────────────────────
  const titreDeLaCase = (/** @type {string} */ cle) => {
    switch (cle) {
      case 'affiches':
        return t('complexeGerant.gerer.affiches', 'Affiches');
      case 'canal':
        return t('complexeGerant.gerer.canal', 'Canal');
      case 'clients':
        return t('complexeGerant.gerer.clients', 'Clients');
      case 'complexe':
        return t('complexeGerant.gerer.complexe', 'Gérer mon complexe');
      case 'demandes':
        return t('complexeGerant.gerer.demandes', 'Demandes');
      case 'fidelite':
        return t('complexeGerant.gerer.fidelite', 'Fidélité');
      case 'installations':
        return t('complexeGerant.gerer.installations', 'Gérer mes installations');
      case 'planning':
        return t('complexeGerant.gerer.planning', 'Planning');
      case 'reservations':
        return t('complexeGerant.gerer.reservations', 'Réservations');
      case 'statistiques':
        return t('complexeGerant.gerer.statistiques', 'Statistiques');
      default:
        return t('complexeGerant.gerer.reglages', 'Réglages');
    }
  };
  const gerer = (
    <View style={{ gap: 12 }}>
      {titreSection(t('complexeGerant.gerer.titre', 'Gérer'))}
      <View style={[Alignments.row, Alignments.wrap, { gap: 12 }]}>
        {CASES_GERER.map((cas) => {
          const ouverte = Boolean(cas.route);
          return (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: !ouverte }}
              disabled={!ouverte}
              key={cas.cle}
              onPress={ouverte ? () => ouvrir(/** @type {string} */ (cas.route)) : undefined}
              style={[
                carte,
                Spaces.padding[16],
                {
                  // OR1 : sur ordinateur, les cases en grille de 3.
                  flexBasis: surOrdinateur ? '31%' : 140,
                  flexGrow: 1,
                  gap: 8,
                  minHeight: 88,
                },
                ouverte ? null : { opacity: 0.55 },
              ]}
              testID={`complexe-accueil-case-${cas.cle}`}
            >
              <Image
                source={/** @type {any} */ (Images)[cas.icone]}
                style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.primary200]}
              />
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{titreDeLaCase(cas.cle)}</Text>
              {ouverte ? null : (
                <Text style={[Fonts.p3, Fonts.primary200]}>
                  {t('complexeGerant.gerer.bientot', 'Bientôt')}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  let journee = null;
  if (chargement) {
    journee = (
      <View style={{ gap: 12 }} testID="complexe-accueil-squelette">
        {[1, 2].map((ligne) => (
          <View
            key={`frise-${ligne}`}
            style={[
              ApplicationStyle.borderRadius16,
              { backgroundColor: withAlpha(Colors.neutral00, 0.06), height: 44 },
            ]}
          />
        ))}
        <View style={[Alignments.row, Alignments.wrap, { gap: 12 }]}>
          {[1, 2, 3, 4].map((tuile) => (
            <View
              key={`tuile-${tuile}`}
              style={[
                ApplicationStyle.borderRadius16,
                {
                  backgroundColor: withAlpha(Colors.neutral00, 0.06),
                  flexBasis: 140,
                  flexGrow: 1,
                  height: 104,
                },
              ]}
            />
          ))}
        </View>
      </View>
    );
  } else if (enPanne) {
    journee = (
      <View
        accessibilityRole="alert"
        style={[
          carte,
          Spaces.padding[16],
          {
            backgroundColor: withAlpha(Colors.error500, 0.08),
            borderColor: withAlpha(Colors.error500, 0.4),
            gap: 8,
          },
        ]}
      >
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t('complexeGerant.accueil.erreur', 'Impossible de charger ta journée.')}
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            onPress={() => {
              mes.refetch?.();
              terrainsLus.refetch?.();
            }}
            title={t('complexeGerant.accueil.reessayer', 'Réessayer')}
            variant="Secondary"
          />
        </View>
      </View>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      {enTete}
      <ScrollView
        contentContainerStyle={{ gap: 24, paddingBottom: 24, paddingTop: 16 }}
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => {
              mes.refetch?.();
              terrainsLus.refetch?.();
            }}
            refreshing={Boolean(mes.isRefetching || terrainsLus.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {bascule}
        {bandeau ? (
          <BandeauComplexe
            action={bandeau.action}
            onAction={bandeau.onAction}
            testID="complexe-accueil-bandeau"
            texte={bandeau.texte}
            ton={/** @type {any} */ (bandeau.ton)}
          />
        ) : null}
        {journee}
        {avecTerrains ? frise : null}
        {avecTerrains ? chiffres : null}
        {avecTerrains ? prochaines : null}
        {avecTerrains ? alerteHier : null}
        {gerer}
      </ScrollView>
      <FeuillePratiqueAussi
        isVisible={feuilleJoueur}
        onClose={() => setFeuilleJoueur(false)}
        onDone={() => {
          setFeuilleJoueur(false);
          revenirEnModeJoueur();
        }}
        pourLeComplexe
      />
    </ScreenContainer>
  );
}

export default ComplexeAccueil;
