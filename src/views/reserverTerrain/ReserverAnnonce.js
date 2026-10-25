import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { libelleSport } from '@/domains/complexe/complexeTerrain';
import {
  contenuDEchec,
  prixDuCreneau,
  texteCreneau,
  texteJourLong,
  varianteDEchec,
} from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';
import FeuilleInviterParLien from '@/views/reserverTerrain/components/FeuilleInviterParLien';

import { RouteNames } from '@/navigation/routeNames';

import {
  useAnnonce,
  useFermerUneAnnonce,
  useRejoindreUneAnnonce,
} from '@/services/complexe/complexeJoueurQueries';

import { isBirthdateUnderAge } from '@/constants/parentalDeclaration';
import { useIsDesktop } from '@/responsive';

const COLONNE = 560;

/**
 * E-P09 B — « LA PAGE DE L'ANNONCE « IL ME MANQUE DES JOUEURS » » — RESA-L6B-2 (20/10/2026),
 * planche EP09 états 2 à 10, plan E-P09 (A-P09, RC-P09, RC-T02, AT-05 A, RG-HONNEUR). Dans l'ordre
 * de la fiche :
 *   1. « IL MANQUE 2 JOUEURS » et la pastille Ouverte / Complète / Fermée (« PARTIE COMPLÈTE »,
 *      « IL MANQUAIT 2 JOUEURS ») ;
 *   2. la carte de la partie : jour, heures, complexe et terrain (⇒ E-P02), sport, niveau, prix
 *      indicatif (D4) ;
 *   3. « Déjà là · 8 » : prénom + initiale ;
 *   4. « Je viens » et l'engagement : le serveur contrôle l'âge, le ban, la place ; ses refus
 *      sont dits (banni : sans la raison) ; sous l'âge minimum du complexe, « À partir de 16 ans
 *      dans ce complexe. » et pas de bouton (RC-T02) ; rejoint : « Tu es dans la partie ! » et
 *      « Voir la partie » (E-P07).
 * Le réserveur (il vient de SA réservation, `reservationId`) : « Annonce publiée. » juste après la
 * publication (`publiee`), « Partager » (le lien de la réservation, RG-LIEN), « Fermer l'annonce ».
 * ⛔ « 38 joueurs prévenus » : le serveur ne rend pas ce nombre (et l'envoi aux favoris est encore
 * à brancher, feu RESA-L4) — rien n'est affiché plutôt qu'un chiffre deviné.
 * Paramètres : `annonceId` ; `reservationId` et `publiee` (depuis E-P07). Ouverte aussi par N-28.
 * Caché par `COMPLEXES_JOUEUR`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ReserverAnnonce() {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  /**
   * @type {{ annonceId?: string, favorisPrevenus?: number, publiee?: boolean,
   *   reservationId?: string }}
   */
  const params = /** @type {any} */ (route?.params) || {};
  const surOrdinateur = useIsDesktop();
  const { userData } = useAuth();
  const lecture = useAnnonce(params.annonceId || null);
  const rejoindre = useRejoindreUneAnnonce();
  const fermer = useFermerUneAnnonce();
  const [rejointe, setRejointe] = useState(/** @type {any} */ (null));
  const [refus, setRefus] = useState(/** @type {string | null} */ (null));
  const [partage, setPartage] = useState(false);
  const annonce = lecture?.data || null;

  const carte = {
    backgroundColor: withAlpha(Colors.primary800, 0.6),
    borderColor: withAlpha(Colors.primary500, 0.24),
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  };
  const enveloppe = (/** @type {import('react').ReactNode} */ contenu) => (
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
          paddingTop: 24,
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {contenu}
      </ScrollView>
    </ScreenContainer>
  );

  if (lecture?.isLoading && !annonce) {
    return enveloppe(
      <View style={{ gap: 12 }} testID="annonce-squelette">
        {[60, 160, 100].map((hauteur) => (
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
  if (!annonce) {
    const introuvable = !lecture?.error || varianteDEchec(lecture.error) === 'introuvable';
    return enveloppe(
      <View accessibilityRole="alert" style={carte}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {introuvable
            ? t('reserverTerrain.annonce.introuvable', 'Cette annonce n’existe plus.')
            : t('reserverTerrain.annonce.erreur', 'Impossible de charger cette annonce.')}
        </Text>
        {!introuvable ? (
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              onPress={() => lecture?.refetch?.()}
              title={t('reserverTerrain.recherche.reessayer', 'Réessayer')}
              variant="Secondary"
            />
          </View>
        ) : null}
      </View>,
    );
  }

  const reserveur = Boolean(params.reservationId);
  const partie = annonce.reservation || {};
  const manque = Math.max(0, (Number(annonce.places) || 0) - (Number(annonce.joined) || 0));
  let titre = t('reserverTerrain.annonce.ilManque', {
    count: manque || Number(annonce.places) || 0,
    defaultValue_one: 'Il manque {{count}} joueur',
    defaultValue_other: 'Il manque {{count}} joueurs',
  });
  /** @type {{ couleur: string, mot: string }} */
  let pastille = {
    couleur: Colors.success500,
    mot: t('reserverTerrain.annonce.ouverte', 'Ouverte'),
  };
  let phraseDEtat = null;
  if (annonce.status === 'complete') {
    titre = t('reserverTerrain.annonce.partieComplete', 'Partie complète');
    pastille = {
      couleur: Colors.primary500,
      mot: t('reserverTerrain.annonce.complete', 'Complète'),
    };
    phraseDEtat = contenuDEchec(t, 'complete').titre;
  } else if (annonce.status === 'fermee') {
    titre = t('reserverTerrain.annonce.ilManquait', {
      count: Number(annonce.places) || 0,
      defaultValue_one: 'Il manquait {{count}} joueur',
      defaultValue_other: 'Il manquait {{count}} joueurs',
    });
    pastille = { couleur: Colors.primary200, mot: t('reserverTerrain.annonce.fermee', 'Fermée') };
    phraseDEtat = t('reserverTerrain.annonce.fermeeTexte', 'Cette annonce est fermée.');
  }
  const ouverte = annonce.status === 'ouverte';
  const ageMinimum = Number(annonce.minAge) || null;
  const naissance = /** @type {any} */ (userData)?.birthdate;
  // RC-T02, RG-AGE : sans date de naissance, le serveur refuse aussi (« Ajoute ta date de
  // naissance ») ; l'écran ne cache le bouton que si l'âge connu est trop jeune.
  const tropJeune = Boolean(ageMinimum && naissance && isBirthdateUnderAge(naissance, ageMinimum));
  const prix = prixDuCreneau(t, partie.price, null);
  const niveaux = /** @type {Record<string, string>} */ ({
    confirme: t('reserverTerrain.annonce.confirme', 'Confirmé'),
    debutant: t('reserverTerrain.annonce.debutant', 'Débutant'),
    loisir: t('reserverTerrain.annonce.loisir', 'Loisir'),
  });
  const details = [
    libelleSport({ name: partie?.terrain?.sport }),
    annonce.level && niveaux[annonce.level]
      ? t('reserverTerrain.annonce.niveauDe', 'niveau {{niveau}}', {
        niveau: niveaux[annonce.level],
        ...SANS_ECHAPPEMENT,
      })
      : null,
    prix?.principal
      ? t('reserverTerrain.prix.surPlace', '{{prix}}, à régler sur place', {
        prix: prix.principal,
        ...SANS_ECHAPPEMENT,
      })
      : null,
  ].filter(Boolean).join(' · ');
  const presents = Array.isArray(annonce.participants) ? annonce.participants : [];

  const venir = async () => {
    setRefus(null);
    try {
      const groupe = await rejoindre.mutateAsync(annonce.documentId);
      setRejointe(groupe || {});
    } catch (erreur) {
      setRefus(contenuDEchec(t, varianteDEchec(erreur), { erreur, rejoindre: true }).titre);
    }
  };
  const fermerLAnnonce = async () => {
    setRefus(null);
    try {
      await fermer.mutateAsync(annonce.documentId);
    } catch (erreur) {
      setRefus(contenuDEchec(t, varianteDEchec(erreur), { erreur }).titre);
    }
  };

  if (rejointe) {
    return enveloppe(
      <View style={{ alignItems: 'center', gap: 16 }}>
        <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00, Fonts.textCenter]}>
          {t('reserverTerrain.annonce.dansLaPartie', 'Tu es dans la partie !')}
        </Text>
        <View style={{ ...carte, alignSelf: 'stretch' }}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {[texteJourLong(t, partie.date), texteCreneau(partie.from, partie.to),
              partie?.terrain?.name].filter(Boolean).join(' · ')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {[
              partie?.complexe?.name,
              Number(rejointe?.places) > 0
                ? t(
                  'reserverTerrain.invitation.presentsSur',
                  '{{presents}} présents sur {{places}}',
                  {
                    places: Number(rejointe.places),
                    presents: Number(rejointe?.counts?.presents) || 0,
                  },
                )
                : null,
            ].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {rejointe?.reservation ? (
          <View style={{ alignSelf: 'stretch' }}>
            <Button
              onPress={() => navigation.navigate(RouteNames.ReserverMaReservation, {
                reservationId: rejointe.reservation,
              })}
              title={t('reserverTerrain.annonce.voirLaPartie', 'Voir la partie')}
              variant="Primary"
            />
          </View>
        ) : null}
      </View>,
    );
  }

  return (
    <>
      {enveloppe(
        <>
          <View style={{ gap: 8 }}>
            <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
              {titre.toUpperCase()}
            </Text>
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: withAlpha(pastille.couleur, 0.14),
                borderColor: withAlpha(pastille.couleur, 0.6),
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <Text style={[Fonts.p3Bold, { color: pastille.couleur }]}>{pastille.mot}</Text>
            </View>
          </View>
          {reserveur && params.publiee ? (
            <View
              accessibilityLiveRegion="polite"
              style={{ ...carte, borderColor: withAlpha(Colors.success500, 0.6) }}
            >
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('reserverTerrain.annonce.publiee', 'Annonce publiée.')}
              </Text>
              {/* RESA-FIN-APP (22/10, Adel « 1- A ») — « 38 favoris prévenus ». À 0 (case
                  décochée, heures calmes 22 h – 8 h, débit atteint : l'app ne sait pas lequel),
                  rien plutôt qu'une phrase fausse ; champ absent : rien. */}
              {Number(params.favorisPrevenus) > 0 ? (
                <Text style={[Fonts.p2, Fonts.neutral100]} testID="annonce-favoris-prevenus">
                  {t('reserverTerrain.annonce.favorisPrevenus', {
                    count: Number(params.favorisPrevenus),
                    defaultValue_one: '{{count}} favori prévenu',
                    defaultValue_other: '{{count}} favoris prévenus',
                  })}
                </Text>
              ) : null}
            </View>
          ) : null}
          <View style={carte}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {[texteJourLong(t, partie.date), texteCreneau(partie.from, partie.to)]
                .filter(Boolean).join(' · ')}
            </Text>
            <TouchableOpacity
              accessibilityRole="link"
              disabled={!partie?.complexe?.slug}
              onPress={() => navigation.navigate(RouteNames.ReserverComplexe, {
                slug: partie.complexe.slug,
              })}
              style={{ justifyContent: 'center', minHeight: 44 }}
            >
              <Text style={[Fonts.p2Bold, Fonts.primary200]}>
                {[partie?.complexe?.name, partie?.terrain?.name].filter(Boolean).join(' · ')}
              </Text>
            </TouchableOpacity>
            {details ? <Text style={[Fonts.p3, Fonts.neutral100]}>{details}</Text> : null}
          </View>
          {presents.length ? (
            <View style={{ gap: 6 }}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('reserverTerrain.annonce.dejaLaTitre', 'Déjà là · {{nombre}}', {
                  nombre: presents.length,
                })}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral100]}>{presents.join(', ')}</Text>
            </View>
          ) : null}
          {phraseDEtat ? (
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{phraseDEtat}</Text>
          ) : null}
          {ouverte && !reserveur && tropJeune ? (
            <Text style={[Fonts.p2Bold, Fonts.primary200]}>
              {t('reserverTerrain.annonce.aPartirDe', 'À partir de {{age}} ans dans ce complexe.', {
                age: ageMinimum,
              })}
            </Text>
          ) : null}
          {refus ? (
            <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{refus}</Text>
          ) : null}
          {ouverte && !reserveur && !tropJeune ? (
            <View style={{ gap: 8 }}>
              <TouchableOpacity
                accessibilityLabel={t('reserverTerrain.invitation.jeViens', 'Je viens')}
                accessibilityRole="button"
                accessibilityState={{ busy: Boolean(rejoindre?.isPending) }}
                disabled={Boolean(rejoindre?.isPending)}
                onPress={venir}
                style={{
                  alignItems: 'center',
                  backgroundColor: Colors.primary500,
                  borderRadius: 12,
                  justifyContent: 'center',
                  minHeight: 48,
                }}
                testID="annonce-je-viens"
              >
                <Text style={[Fonts.p2Bold, Fonts.primary900]}>
                  {t('reserverTerrain.invitation.jeViens', 'Je viens')}
                </Text>
              </TouchableOpacity>
              <Text style={[Fonts.p3, Fonts.neutral200, Fonts.textCenter]}>
                {t(
                  'reserverTerrain.maReservation.honneurPresent',
                  'Tu t’engages sur l’honneur à venir si tu réponds présent.',
                )}
              </Text>
            </View>
          ) : null}
          {reserveur ? (
            <View style={{ gap: 10 }}>
              <Button
                icon="share"
                onPress={() => setPartage(true)}
                title={t('reserverTerrain.lien.partager', 'Partager')}
                variant="Primary"
              />
              {ouverte ? (
                <Button
                  isLoading={Boolean(fermer?.isPending)}
                  onPress={fermerLAnnonce}
                  title={t('reserverTerrain.annonce.fermer', 'Fermer l’annonce')}
                  variant="Secondary"
                />
              ) : null}
            </View>
          ) : null}
        </>,
      )}
      {partage && params.reservationId ? (
        <FeuilleInviterParLien
          close={() => setPartage(false)}
          partie={{
            complexe: partie?.complexe?.name,
            date: partie.date,
            from: partie.from,
            sport: partie?.terrain?.sport,
          }}
          reservationId={params.reservationId}
          sansDesactiver
        />
      ) : null}
    </>
  );
}

export default ReserverAnnonce;
