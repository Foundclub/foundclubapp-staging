import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal, Platform, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import useTheme from '@/theme/themeContext';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import GrilleDesHeures from '@/components/molecules/timePickerInput/GrilleDesHeures';

/**
 * La roue native SE MESURE TOUTE SEULE : sa vue d'ombre porte une fonction de
 * mesure Yoga qui interroge `sizeThatFits` du `UIDatePicker`
 * (`RNDateTimePickerShadowView.m:71`). Toute contrainte posee ici ECRASE cette
 * mesure.
 *
 * 🧨 Defaut trouve a la recette du 2026-08-07 — « les colonnes du selecteur
 * d'heure sont mal alignees et mal centrees ». Le code imposait `height: 200`
 * et ne donnait aucun `alignSelf` : la roue etait donc comprimee sous sa
 * hauteur naturelle (les rangees ne tombent plus au centre de la bande de
 * selection) ET etiree sur toute la largeur de la feuille, alors que ses
 * colonnes gardent leur largeur propre. On rend la main a la mesure native —
 * c'est une SUPPRESSION de contrainte, pas un reglage a la main.
 * @type {import('react-native').ViewStyle}
 */
const ROUE_NATIVE_STYLE = { alignSelf: 'center' };

// Une heure « HH:mm » : la seule forme d'exemple qui puisse servir de départ à la roue.
const HEURE_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// ⏰ A7-UX — une seule grille ouverte à la fois (Début et Fin côte à côte) : la dernière ouverte
// referme la précédente.
/** @type {(() => void) | null} */
let fermerLaGrilleOuverte = null;

/**
 * A7-UX — ce qu'on tape, lu comme une heure : « 1730 », « 17:30 », « 17h30 », « 930 ».
 * @param {string} texte - La saisie.
 * @returns {string | null} « HH:mm », ou null tant que la saisie est incomplète ou fausse.
 */
const lireLaSaisie = (texte) => {
  const chiffres = String(texte || '').replace(/\D/g, '');
  if (chiffres.length < 3 || chiffres.length > 4) return null;
  const lue = `${chiffres.slice(0, -2).padStart(2, '0')}:${chiffres.slice(-2)}`;
  return HEURE_HHMM.test(lue) ? lue : null;
};

/**
 * TimePickerInput - A time input component with native iOS picker
 * @param {object} props
 * @param {string} props.label - Input label
 * @param {string} props.value - Time value in HH:mm format
 * @param {Function} props.onChange - Callback when time changes
 * @param {string} [props.placeholder] - Placeholder text
 * @param {string} [props.error] - Error message
 * @param {string} [props.testID] - Repère du champ (témoins)
 * @param {string | null} [props.apres] - A7-UX : sur le site, rien ne se choisit jusqu'à cette
 *   heure incluse (la Fin après le Début).
 * @returns {import('react').ReactElement} Le champ, et sa roue ou sa grille.
 */
function TimePickerInput({
  apres = null, error, label, onChange, placeholder = 'HH:mm', testID = undefined, value,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);
  // A7-UX (site) — la grille ouverte sous le champ, ce qu'on tape (null : la valeur), le focus.
  const [grilleOuverte, setGrilleOuverte] = useState(false);
  const [saisie, setSaisie] = useState(/** @type {string | null} */ (null));
  const [focus, setFocus] = useState(false);
  const fermer = useRef(() => setGrilleOuverte(false)).current;
  useEffect(() => () => {
    if (fermerLaGrilleOuverte === fermer) fermerLaGrilleOuverte = null;
  }, [fermer]);
  // SAIS (heure A) — iPhone : l'heure que montre la roue, écrite seulement par « OK ».
  const [brouillon, setBrouillon] = useState(/** @type {Date | null} */ (null));

  // ⏰ SAIS — DÉCISION D'ADEL « heure A » (08/10, tournée T20 lot 1) : la roue / le cadran
  // s'ouvre sur la valeur, sinon sur l'EXEMPLE affiché s'il a la forme HH:mm (« 17:30 » gris
  // ressemblait à une valeur choisie, alors que la roue s'ouvrait sur l'heure du moment), sinon
  // sur une heure ronde.
  const getDateFromValue = () => {
    const depart = value || (HEURE_HHMM.test(String(placeholder || '')) ? placeholder : '');
    if (depart) {
      const [hours, minutes] = depart.split(':').map(Number);
      const date = new Date();
      date.setHours(hours || 0, minutes || 0, 0, 0);
      return date;
    }
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return now;
  };

  const ouvrir = () => {
    setBrouillon(getDateFromValue());
    setShowPicker(true);
  };
  // iPhone : « Annuler », le voile ou le retour ferment SANS rien écrire (la valeur d'avant reste).
  const annuler = () => {
    setShowPicker(false);
    setBrouillon(null);
  };

  // Format the time from Date to HH:mm string
  const formatTime = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const handleChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    // T19 (08/10) — Android rappelle onChange a la fermeture (« Annuler ») avec
    // { type: 'dismissed' } et la valeur d'origine : annuler ne doit rien ecrire.
    if (event?.type === 'dismissed') return;
    if (!selectedDate) return;
    // SAIS (heure A) — iPhone : chaque cran de roue ne fait que bouger le brouillon ; « OK »
    // l'écrit. Android : le cadran rend « set » au OK, même sans geste (la valeur montrée).
    if (Platform.OS === 'ios') setBrouillon(selectedDate);
    else onChange(formatTime(selectedDate));
  };

  // SAIS (heure A) — « OK » ÉCRIT l'heure que montre la roue, tournée ou non (avant : il ne
  // faisait que fermer ; « OK direct, ça ne s'enregistre pas », TestFlight 2.6.71).
  const handleConfirm = () => {
    onChange(formatTime(brouillon || getDateFromValue()));
    setShowPicker(false);
    setBrouillon(null);
  };

  // ⏰ A7-UX (20/10) — sur le site, le choix de l'heure de FoundClub remplace la liste du site.
  const ouvrirLaGrille = () => {
    if (fermerLaGrilleOuverte && fermerLaGrilleOuverte !== fermer) fermerLaGrilleOuverte();
    fermerLaGrilleOuverte = fermer;
    setGrilleOuverte(true);
  };
  const fermerLaGrille = () => {
    if (fermerLaGrilleOuverte === fermer) fermerLaGrilleOuverte = null;
    setGrilleOuverte(false);
  };
  const choisir = (/** @type {string} */ heure) => {
    setSaisie(null);
    onChange(heure);
    fermerLaGrille();
  };
  // Au clavier : l'heure s'écrit dès qu'elle est lisible ; vider le champ rend « ».
  const taper = (/** @type {string} */ texte) => {
    setSaisie(texte);
    if (!String(texte || '').trim()) {
      onChange('');
      return;
    }
    const lue = lireLaSaisie(texte);
    if (!lue) return;
    // Lisible : le champ se remet en forme (« 1830 » devient « 18:30 »).
    setSaisie(lue);
    if (lue !== value) onChange(lue);
  };
  // Les flèches avancent ou reculent d'un quart d'heure ; Entrée referme la grille.
  const toucheDuChamp = (/** @type {any} */ evenement) => {
    const touche = evenement?.nativeEvent?.key;
    if (touche === 'Enter') fermerLaGrille();
    if (touche !== 'ArrowUp' && touche !== 'ArrowDown') return;
    evenement.preventDefault?.();
    const depart = getDateFromValue();
    const pas = touche === 'ArrowUp' ? 15 : -15;
    const visee = (depart.getHours() * 60) + depart.getMinutes() + pas;
    const total = Math.min(Math.max(visee, 0), 1439);
    setSaisie(null);
    onChange(formatTime(new Date(2000, 0, 1, Math.floor(total / 60), total % 60)));
  };
  // Échap referme la grille ET s'arrête là : la fenêtre du tunnel l'écoute (keyup sur le document)
  // et reculait d'une étape (mesuré au banc A7-UX, 4/6 → 3/6). Grille fermée, Échap passe.
  const echapDuChamp = (/** @type {any} */ evenement) => {
    if (evenement?.key !== 'Escape' || !grilleOuverte) return;
    evenement.stopPropagation();
    fermerLaGrille();
  };

  const displayValue = value || placeholder;
  // SAIS (T20 lot 1) — un CADRE : sur une feuille de sa couleur (« Attribuer »), la boîte
  // disparaissait et l'exemple flottait comme du texte. Le même que le sélecteur de date.
  const cadre = { borderColor: withAlpha(Colors.neutral00, 0.14), borderWidth: 1 };

  return (
    <View style={[Spaces.gap[4], { zIndex: 1 }]}>
      {label && (
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {label}
        </Text>
      )}
      {/* ⏰ A7-UX (20/10, constat d'Adel : « le défilement d'heure n'est pas UX/UI ») — SUR LE SITE,
          le choix de l'heure de FoundClub, posé dans la page sous le champ : la liste grise du
          navigateur (minutes de 1 en 1) recouvrait « Suivant ». Le champ se tape aussi (« 1730 »),
          sans clavier virtuel au téléphone (la grille suffit). Avant : FINITIONS16 · POINT 6. */}
      {Platform.OS === 'web' ? (
        <View onKeyUp={echapDuChamp} style={{ gap: 8 }}>
          <View style={[
            ApplicationStyle.borderRadius12,
            ApplicationStyle.backgroundColor.primary700,
            cadre,
            (focus || grilleOuverte) && { borderColor: Colors.primary500 },
            error && { borderColor: Colors.error500, borderWidth: 1 },
            { justifyContent: 'center' },
          ]}
          >
            <SvgIcon
              color={Colors.primary200}
              height={16}
              name="clock-two-thirty"
              style={{ left: 16, position: 'absolute' }}
              width={16}
            />
            <TextInput
              accessibilityLabel={label || placeholder}
              accessibilityState={{ expanded: grilleOuverte }}
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect={false}
              inputMode="none"
              onBlur={() => {
                setFocus(false);
                setSaisie(null);
              }}
              onChangeText={taper}
              onFocus={() => {
                setFocus(true);
                ouvrirLaGrille();
              }}
              onKeyPress={toucheDuChamp}
              placeholder={placeholder}
              placeholderTextColor={Colors.neutral300}
              spellCheck={false}
              style={[Fonts.p1, Fonts.neutral00, {
                minHeight: 52, outlineStyle: 'none', paddingLeft: 44, paddingRight: 16,
              }]}
              testID={testID}
              value={saisie ?? (value || '')}
            />
          </View>
          {grilleOuverte ? (
            <GrilleDesHeures
              apres={apres}
              onChoisir={choisir}
              suggestion={HEURE_HHMM.test(String(placeholder || '')) ? placeholder : null}
              valeur={value}
            />
          ) : null}
        </View>
      ) : (
        <TouchableOpacity
          onPress={ouvrir}
          style={[
            ApplicationStyle.borderRadius12,
            ApplicationStyle.backgroundColor.primary700,
            Spaces.padding[16],
            cadre,
            error && { borderColor: Colors.error500, borderWidth: 1 },
          ]}
          testID={testID}
        >
          <Text style={[
            Fonts.p1,
            value ? Fonts.neutral00 : { color: Colors.neutral300 },
          ]}
          >
            {displayValue}
          </Text>
        </TouchableOpacity>
      )}

      {error && (
        <Text style={[Fonts.p3, { color: Colors.error500 }]}>
          {error}
        </Text>
      )}

      {/* iOS: Show modal with picker */}
      {Platform.OS === 'ios' && showPicker && (
        <Modal
          animationType="slide"
          onRequestClose={annuler}
          transparent
          visible={showPicker}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={annuler}
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', flex: 1 }}
          >
            <View style={{ flex: 1 }} />
            <View style={{
              backgroundColor: Colors.primary700,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: 34,
            }}
            >
              {/* Entete : trois TIERS EGAUX, pas un `space-between`. Avec
                  `space-between`, trois enfants de largeurs differentes posent
                  le titre la ou l'espace restant le pousse — jamais au centre. */}
              <View style={[
                Alignments.row,
                Alignments.alignCenter,
                Spaces.paddingHorizontal[16],
                Spaces.paddingVertical[12],
                { borderBottomColor: Colors.neutral100, borderBottomWidth: 1 },
              ]}
              >
                <TouchableOpacity onPress={annuler} style={{ flex: 1 }}>
                  <Text style={[Fonts.p1, { color: Colors.neutral300 }]}>
                    {t('timePickerInput.cancel', 'Annuler')}
                  </Text>
                </TouchableOpacity>
                <Text style={[Fonts.p1Bold, Fonts.neutral00, { flex: 1, textAlign: 'center' }]}>
                  {label}
                </Text>
                <TouchableOpacity onPress={handleConfirm} style={{ flex: 1 }}>
                  <Text
                    style={[Fonts.p1Bold, { color: Colors.primary500, textAlign: 'right' }]}
                  >
                    OK
                  </Text>
                </TouchableOpacity>
              </View>

              <DateTimePicker
                display="spinner"
                locale={localeDesFormats()}
                minuteInterval={5}
                mode="time"
                onChange={handleChange}
                style={ROUE_NATIVE_STYLE}
                textColor={Colors.neutral00}
                value={brouillon || getDateFromValue()}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Android: Show inline picker */}
      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          display="default"
          is24Hour
          mode="time"
          onChange={handleChange}
          value={getDateFromValue()}
        />
      )}
    </View>
  );
}

export default TimePickerInput;
