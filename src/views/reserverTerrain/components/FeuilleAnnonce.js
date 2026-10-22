import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { libelleSport } from '@/domains/complexe/complexeTerrain';
import {
  contenuDEchec,
  texteCreneau,
  texteJourCourt,
  varianteDEchec,
} from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import InputStepper from '@/components/molecules/inputStepper/InputStepper';
import PuceChoix from '@/views/reserverTerrain/components/PuceChoix';

import { usePublierUneAnnonce } from '@/services/complexe/complexeJoueurQueries';

/** Les niveaux du serveur (`ANNONCE_LEVELS`), dans l'ordre de la planche. */
const NIVEAUX = Object.freeze(['debutant', 'loisir', 'confirme']);
const DEJA_LA_MAX = 3;

/**
 * « IL ME MANQUE DES JOUEURS », LA CRÉATION — RESA-L6B-2 (20/10/2026), planche EP09 état 1 et 5,
 * plan E-P09 A (A-P09, A-P10, RC-P09, RG-MASSE). Les 6 éléments de la fiche : le titre,
 * « Combien ? » (de 1 aux places restantes), « Niveau » (facultatif), l'aperçu de l'annonce (la
 * partie, les joueurs déjà là en prénom + initiale, les places), la case « Prévenir les joueurs qui
 * ont ce complexe en favori » COCHÉE par défaut (avec l'âge minimum), « Publier l'annonce ».
 * Publiée : la page de l'annonce (E-P09 B). Une seule annonce par partie : le refus du serveur
 * (`_ANNONCE_DEJA`) dit sa phrase ; sans réseau, rien n'est publié.
 * Montée seulement quand on l'ouvre.
 * @param {object} props - Les propriétés.
 * @param {number | null} props.ageMinimum - L'âge minimum du complexe.
 * @param {() => void} props.close - Fermer.
 * @param {{ counts?: { presents?: number }, participants?: any[], places?: number }} props.groupe
 *   - Le groupe (les présents, les places).
 * @param {(annonce: any) => void} props.onPubliee - L'annonce publiée.
 * @param {any} props.reservation - La réservation (jour, heures, complexe, terrain, sport).
 * @returns {import('react').ReactElement} La feuille.
 */
function FeuilleAnnonce({
  ageMinimum, close, groupe, onPubliee, reservation,
}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const publier = usePublierUneAnnonce();
  const presents = Number(groupe?.counts?.presents) || 0;
  const restantes = Math.max(1, (Number(groupe?.places) || 0) - presents);
  const [places, setPlaces] = useState(restantes);
  const [niveau, setNiveau] = useState(/** @type {string | null} */ (null));
  const [favoris, setFavoris] = useState(true);
  const [refus, setRefus] = useState(/** @type {string | null} */ (null));

  const libellesDesNiveaux = /** @type {Record<string, string>} */ ({
    confirme: t('reserverTerrain.annonce.confirme', 'Confirmé'),
    debutant: t('reserverTerrain.annonce.debutant', 'Débutant'),
    loisir: t('reserverTerrain.annonce.loisir', 'Loisir'),
  });
  const presentsNommes = (Array.isArray(groupe?.participants) ? groupe.participants : [])
    .filter((participant) => participant?.response === 'present')
    .map((participant) => String(participant?.label || ''));
  const dejaLa = presentsNommes.length > DEJA_LA_MAX
    ? `${presentsNommes.slice(0, DEJA_LA_MAX).join(', ')}, …`
    : presentsNommes.join(', ');
  const partie = [
    libelleSport(reservation?.terrain?.sport),
    texteJourCourt(t, reservation?.date),
    texteCreneau(reservation?.from, reservation?.to),
    reservation?.complexe?.name,
    reservation?.terrain?.name,
  ].filter(Boolean).join(' · ');

  const envoyer = async () => {
    setRefus(null);
    try {
      const annonce = await publier.mutateAsync({
        annonce: { level: niveau, notifyFavorites: favoris, places },
        reservationId: reservation.documentId,
      });
      onPubliee(annonce);
    } catch (erreur) {
      const variante = varianteDEchec(erreur);
      setRefus(variante === 'reseau' || variante === 'panne'
        ? t('reserverTerrain.annonce.pasPartie', 'L’annonce n’est pas partie. Réessaie.')
        : contenuDEchec(t, variante, { erreur }).titre);
    }
  };

  return (
    <BottomModal close={close} isVisible webPresentation="dialog">
      <View style={{ gap: 14 }}>
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('reserverTerrain.annonce.titre', 'Il me manque des joueurs')}
        </Text>
        <View style={{ gap: 6 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('reserverTerrain.annonce.combien', 'Combien ?')}
          </Text>
          <InputStepper
            decrementLabel={t('reserverTerrain.annonce.moins', 'Une place de moins')}
            incrementLabel={t('reserverTerrain.annonce.plus', 'Une place de plus')}
            max={restantes}
            min={1}
            onDecrement={() => setPlaces((avant) => Math.max(1, avant - 1))}
            onIncrement={() => setPlaces((avant) => Math.min(restantes, avant + 1))}
            tone="tunnel"
            value={places}
          />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('reserverTerrain.annonce.niveau', 'Niveau (facultatif)')}
          </Text>
          <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
            {NIVEAUX.map((cle) => (
              <PuceChoix
                choisie={niveau === cle}
                key={cle}
                libelle={libellesDesNiveaux[cle]}
                onPress={() => setNiveau((avant) => (avant === cle ? null : cle))}
                testID={`annonce-niveau-${cle}`}
              />
            ))}
          </View>
        </View>
        <View
          style={{
            backgroundColor: withAlpha(Colors.primary800, 0.6),
            borderColor: withAlpha(Colors.primary500, 0.24),
            borderRadius: 16,
            borderWidth: 1,
            gap: 6,
            padding: 12,
          }}
        >
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {t('reserverTerrain.annonce.apercu', 'Aperçu de l’annonce')}
          </Text>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{partie}</Text>
          {dejaLa ? (
            <Text style={[Fonts.p3, Fonts.neutral100]}>
              {t('reserverTerrain.annonce.dejaLa', {
                count: presents,
                defaultValue_one: '{{count}} joueur déjà là : {{noms}}',
                defaultValue_other: '{{count}} joueurs déjà là : {{noms}}',
                noms: dejaLa,
                ...SANS_ECHAPPEMENT,
              })}
            </Text>
          ) : null}
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
            {t('reserverTerrain.annonce.places', {
              count: places,
              defaultValue_one: '{{count}} place',
              defaultValue_other: '{{count}} places',
            })}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityLabel={t(
            'reserverTerrain.annonce.favoris',
            'Prévenir les joueurs qui ont ce complexe en favori',
          )}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: favoris }}
          onPress={() => setFavoris((avant) => !avant)}
          style={[Alignments.row, { alignItems: 'flex-start', gap: 12, minHeight: 44 }]}
          testID="annonce-favoris"
        >
          <View
            style={[
              Alignments.alignCenter,
              Alignments.justifyCenter,
              {
                backgroundColor: favoris ? Colors.primary500 : 'transparent',
                borderColor: favoris ? Colors.primary500 : Colors.primary200,
                borderRadius: 6,
                borderWidth: 2,
                height: 24,
                marginTop: 2,
                width: 24,
              },
            ]}
          >
            {favoris ? (
              <SvgIcon color={Colors.primary900} height={16} name="check" width={16} />
            ) : null}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t(
                'reserverTerrain.annonce.favoris',
                'Prévenir les joueurs qui ont ce complexe en favori',
              )}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {Number(ageMinimum) > 0
                ? t(
                  'reserverTerrain.annonce.favorisAge',
                  'Seuls ceux qui ont l’âge minimum du complexe ({{age}} ans) sont prévenus.',
                  { age: Number(ageMinimum) },
                )
                : t(
                  'reserverTerrain.annonce.favorisAgeSansChiffre',
                  'Seuls ceux qui ont l’âge minimum du complexe sont prévenus.',
                )}
            </Text>
          </View>
        </TouchableOpacity>
        {refus ? (
          <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{refus}</Text>
        ) : null}
        <Button
          isLoading={Boolean(publier?.isPending)}
          onPress={envoyer}
          title={t('reserverTerrain.annonce.publier', 'Publier l’annonce')}
          variant="Primary"
        />
      </View>
    </BottomModal>
  );
}

export default FeuilleAnnonce;
