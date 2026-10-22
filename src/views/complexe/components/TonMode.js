import { useFocusEffect } from '@react-navigation/native';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  colonnesDuTonMode,
  demanderLAnnonceDArrivee,
  prendreLAnnonceDArrivee,
} from '@/domains/complexe/tonMode';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import { quiTAttend } from '@/components/molecules/playerModeBanner/PlayerModeBanner';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';

/** @typedef {import('@/domains/complexe/tonMode').CleDePosition} CleDePosition */
/** @typedef {import('@/domains/complexe/tonMode').Position} Position */

/** La largeur des positions quand la carte tient sur une ligne (accueil sur ordinateur, O2). */
const LARGEUR_DES_POSITIONS_EN_LIGNE = 420;

// Le texte que le site lit sans le montrer (l'annonce, planche 5) : hors de l'écran, pas caché.
const HORS_ECRAN = Object.freeze({
  height: 1, left: -10000, overflow: 'hidden', position: 'absolute', top: 0, width: 1,
});

/**
 * La phrase de la position active — tableau de l'état 6 de la planche RB-3, mot pour mot.
 * @param {(cle: string, options?: any) => string} t - La traduction.
 * @param {CleDePosition} cle - La position.
 * @param {{ avecParent: boolean, nomDuComplexe: string, prenoms: string[] }} compte - Le nom du
 *   complexe ; ses enfants (« Léa t'attend dans le mode parent », quand le mode parent existe).
 * @returns {string} La phrase.
 */
export const phraseDuMode = (t, cle, { avecParent, nomDuComplexe, prenoms }) => {
  switch (cle) {
    case 'coach':
      return t('tonMode.phrase.coach');
    case 'complexe':
      // Pendant la lecture du complexe, pas de « Tu gères . » : la phrase attend son nom.
      return nomDuComplexe
        ? t('complexeGerant.bascule.gere', { nom: nomDuComplexe, ...SANS_ECHAPPEMENT })
        : '';
    case 'dirigeant':
      return t('tonMode.phrase.dirigeant');
    case 'parent':
      return t('tonMode.phrase.parent');
    default: {
      const joueur = t('playerMode.player.description', 'Tu vois l’app comme un joueur.');
      return avecParent ? `${joueur} ${quiTAttend(t, prenoms)}` : joueur;
    }
  }
};

/**
 * LA BASCULE « TON MODE » — RESA-BASCULE (20/10/2026), planche RB-3 validée par Adel : UN contrôle,
 * au même endroit, pour un compte qui gère un complexe. Le contrôle à onglets de l'app (celui des
 * plannings, `SegmentedControl`, en 44 px et en « boutons radio ») dans la carte de l'ancien
 * bandeau (coins 24, liseré cyan), sous le titre « Ton mode », avec la phrase de la position active
 * dessous.
 * · 2 ou 3 positions sur une ligne, 4 en deux rangées de deux (T2 A), une par rangée quand le texte
 *   est très agrandi (4c) ; `pile` : une par ligne (le menu du site, O1 et O3) ; `ligne` : titre et
 *   phrase à gauche, positions à droite (l'accueil d'un joueur ou d'un parent sur ordinateur, O2).
 * · Toucher la position déjà choisie ne fait rien. « Complexe » change d'espace : la position passe
 *   en cyan tout de suite, un tourniquet précède « Ouverture de ton complexe… », les autres sont
 *   inertes (5a) ; l'espace du complexe, en s'ouvrant, annonce « Mode complexe. Tu gères … » (5b).
 *   Joueur, Parent, Dirigeant, Coach changent l'accueil sur place, sans tourniquet (5c). Cette
 *   pièce ne sait ni naviguer ni écrire un réglage : son hôte le fait (`onChoisir`).
 * @param {object} props - Les propriétés.
 * @param {CleDePosition | null} props.actif - La position allumée.
 * @param {'auto' | 'pile' | 'ligne'} [props.disposition] - La forme (voir plus haut).
 * @param {string} props.nomDuComplexe - Le nom du complexe (« Tu gères … »).
 * @param {{ onPress: () => void } | null} [props.offre] - L'offre du compte Parent, sous un filet
 *   (« Tu pratiques aussi un sport ? », planche 2a) ; seulement sur l'accueil.
 * @param {() => void} [props.onArrivee] - L'espace du complexe vient de s'ouvrir par la bascule :
 *   l'hôte y pose le curseur du lecteur d'écran sur le nom du complexe.
 * @param {(position: Position) => void} props.onChoisir - Une autre position est choisie.
 * @param {Position[]} props.positions - Les positions du compte, dans l'ordre.
 * @param {string[]} [props.prenoms] - Les prénoms de ses enfants.
 * @param {string} [props.testID] - Le repère.
 * @returns {import('react').ReactElement | null} La carte, ou rien sous deux positions.
 */
function TonMode({
  actif, disposition = 'auto', nomDuComplexe, offre = null, onArrivee, onChoisir, positions,
  prenoms = [], testID = 'ton-mode',
}) {
  const { t } = useTranslation();
  const { ApplicationStyle, Colors, Fonts } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [largeur, setLargeur] = useState(0);
  const [enCours, setEnCours] = useState(/** @type {CleDePosition | null} */ (null));
  const [annonce, setAnnonce] = useState('');
  const minuterie = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  const avecParent = positions.some((p) => p.cle === 'parent');
  const libelleDe = (/** @type {CleDePosition} */ cle) => t(`tonMode.positions.${cle}`);
  const phraseDe = (/** @type {CleDePosition} */ cle) => phraseDuMode(t, cle, {
    avecParent, nomDuComplexe, prenoms,
  });

  const annoncer = useCallback((/** @type {string} */ texte) => {
    if (Platform.OS === 'web') setAnnonce(texte);
    else AccessibilityInfo.announceForAccessibility(texte);
  }, []);

  // Revenu sur l'écran (le retour du téléphone depuis le complexe) : plus rien n'est en cours.
  useFocusEffect(useCallback(() => {
    setEnCours(null);
  }, []));
  useEffect(() => () => {
    if (minuterie.current) clearTimeout(minuterie.current);
  }, []);

  // 5b — arrivé dans l'espace du complexe PAR la bascule : l'annonce, puis le curseur sur le nom.
  useEffect(() => {
    if (actif !== 'complexe' || !nomDuComplexe || !prendreLAnnonceDArrivee()) return;
    annoncer(t('tonMode.annonce', {
      mode: libelleDe('complexe').toLocaleLowerCase('fr'),
      phrase: phraseDe('complexe'),
      ...SANS_ECHAPPEMENT,
    }));
    onArrivee?.();
    // Une fois par arrivée : le drapeau vient de retomber.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, nomDuComplexe]);

  if (positions.length < 2) return null;

  const choisir = (/** @type {string} */ cle) => {
    const position = positions.find((p) => p.cle === cle);
    if (!position || enCours || cle === actif) return;
    if (cle === 'complexe') {
      setEnCours('complexe');
      annoncer(t('tonMode.ouvertureAnnonce'));
      demanderLAnnonceDArrivee();
      // Le tour suivant : la position cyan et le tourniquet sont peints avant le changement
      // d'espace.
      minuterie.current = setTimeout(() => onChoisir(position), 0);
      return;
    }
    annoncer(t('tonMode.annonce', {
      mode: libelleDe(position.cle).toLocaleLowerCase('fr'),
      phrase: phraseDe(position.cle),
      ...SANS_ECHAPPEMENT,
    }));
    onChoisir(position);
  };

  const total = positions.length;
  const options = positions.map((position, index) => ({
    accessibilityLabel: `${libelleDe(position.cle)}, ${t('tonMode.position', {
      rang: index + 1, total,
    })}`,
    disabled: Boolean(enCours) && position.cle !== enCours,
    label: libelleDe(position.cle),
    value: position.cle,
  }));
  let colonnes = colonnesDuTonMode({ echelleDuTexte: fontScale, largeur, nombre: total });
  if (disposition === 'pile') colonnes = 1;
  if (disposition === 'ligne') colonnes = total;
  /** @type {typeof options[]} */
  const rangees = [];
  for (let debut = 0; debut < total; debut += colonnes) {
    rangees.push(options.slice(debut, debut + colonnes));
  }
  const valeur = enCours || actif || '';

  const titre = (
    <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.6 }]}>
      {t('tonMode.titre').toUpperCase()}
    </Text>
  );
  const piste = (
    <View
      onLayout={(evenement) => setLargeur(evenement.nativeEvent.layout.width)}
      style={[
        { gap: 8 },
        disposition === 'ligne' ? { width: LARGEUR_DES_POSITIONS_EN_LIGNE } : null,
      ]}
    >
      {rangees.map((rangee) => (
        <SegmentedControl
          centerContent
          fitLabels
          grand
          key={rangee.map((option) => option.value).join('-')}
          onChange={choisir}
          options={rangee}
          radio
          value={valeur}
        />
      ))}
    </View>
  );
  const phrase = enCours ? (
    <View
      style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}
      testID={`${testID}-en-cours`}
    >
      <ActivityIndicator color={Colors.primary200} size="small" />
      <Text style={[Fonts.p2Bold, Fonts.primary200, { flexShrink: 1 }]}>
        {t('tonMode.ouverture')}
      </Text>
    </View>
  ) : (
    <Text
      style={[Fonts.p2, Fonts.neutral200, disposition === 'ligne' ? { flex: 1 } : null]}
      testID={`${testID}-phrase`}
    >
      {actif ? phraseDe(actif) : ''}
    </Text>
  );

  return (
    <View
      accessibilityLabel={t('tonMode.titre')}
      accessibilityRole="radiogroup"
      accessibilityState={{ busy: Boolean(enCours) }}
      style={[
        {
          borderColor: withAlpha(Colors.primary500, 0.33),
          borderRadius: 24,
          borderWidth: 1,
          gap: 12,
          padding: 16,
        },
        disposition === 'ligne' ? { alignItems: 'center', flexDirection: 'row', gap: 24 } : null,
      ]}
      testID={testID}
    >
      {titre}
      {disposition === 'ligne' ? phrase : piste}
      {disposition === 'ligne' ? piste : phrase}
      {offre ? (
        <View style={{ gap: 12 }} testID={`${testID}-offre`}>
          <View style={{ backgroundColor: withAlpha(Colors.primary500, 0.22), height: 1 }} />
          <Text style={[Fonts.p2, Fonts.neutral00]}>
            {t('playerMode.parentAccount.offer', 'Tu pratiques aussi un sport ?')}
          </Text>
          <TouchableOpacity
            accessibilityLabel={t('playerMode.player.enter', 'Basculer en mode joueur')}
            accessibilityRole="button"
            onPress={offre.onPress}
            style={[
              ApplicationStyle.borderRadius12,
              ApplicationStyle.backgroundColor.primary700,
              { alignItems: 'center', minHeight: 44, paddingVertical: 12 },
            ]}
            testID={`${testID}-pratiquer`}
          >
            {/* FINITIONS3 (29/09) : la boîte s'étire, sinon Android 16 perd son dernier mot. */}
            <Text
              style={[Fonts.p2Bold, Fonts.neutral00, Fonts.textCenter, { alignSelf: 'stretch' }]}
            >
              {t('playerMode.player.enter', 'Basculer en mode joueur')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {Platform.OS === 'web' ? (
        <Text accessibilityLiveRegion="polite" style={HORS_ECRAN} testID={`${testID}-annonce`}>
          {annonce}
        </Text>
      ) : null}
    </View>
  );
}

export default TonMode;
