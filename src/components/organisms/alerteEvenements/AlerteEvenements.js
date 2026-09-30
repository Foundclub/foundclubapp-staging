import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { SorteAlerte, StatutAlerte } from '@/domains/searchAlert/alerteEvenement';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

import texteInsecable from '@/utils/texteInsecable';

/**
 * ALERTES (audit V1, A20) — les trois surfaces qui mènent à une alerte
 * d'événements depuis la recherche : la carte « Me prévenir » sous les résultats,
 * la proposition de première ouverture, et le guide « Comment créer une alerte ? ».
 *
 * Aucune ne parle au serveur : elles appellent ce qu'on leur donne. La création
 * vit dans `useAlerteRecherche`, les règles dans `domains/searchAlert/`.
 *
 * ALERTES-ANNONCES (30/09) — les MÊMES surfaces servent aux alertes d'ANNONCES
 * (Rechercher › Recrutement) : `sorte="annonce"` ne change que les mots. L'étoile
 * « Créer alerte » et sa note vivent ici aussi, pour les deux feuilles de filtres.
 * Le nom du fichier est resté celui du lot ALERTES : trois témoins le doublent.
 */

const TAILLE_PASTILLE = 40;
const TAILLE_ICONE = 20;
const TAILLE_NUMERO = 28;
const HAUTEUR_TACTILE = 44;

const styles = StyleSheet.create({
  // Un lien texte garde une cible tactile de 44 pt, sans s'étirer sur la largeur.
  lienDiscret: {
    alignSelf: 'flex-start',
    minHeight: HAUTEUR_TACTILE,
  },
});

/**
 * Déclenche `onExit` quand la feuille qui le porte est RÉELLEMENT partie (son
 * contenu est démonté). Même motif que `SheetExitSignal` d'`EventDetails.js` (lot
 * EVEDIT-2) : lancer l'action suivante au toucher laissait la feuille montée
 * par-dessus l'écran d'arrivée, et sa couche mangeait le premier appui.
 * ponytail: copie locale de 8 lignes plutôt qu'un export tiré d'`EventDetails.js`
 * (fichier-fleuve tenu par d'autres lots) ; voie de sortie : en faire une molécule.
 * @param {{ onExit: () => void }} props Les props.
 * @returns {null} Rien à l'écran.
 */
function SignalDeSortie({ onExit }) {
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  useEffect(() => () => {
    onExitRef.current?.();
  }, []);
  return null;
}

/**
 * La pastille ronde qui porte la cloche.
 * @returns {import('react').ReactElement} La pastille.
 */
function PastilleCloche() {
  const { Alignments, Colors, Images } = /** @type {any} */ (useTheme());
  return (
    <View
      style={[
        Alignments.alignCenter,
        Alignments.justifyCenter,
        {
          backgroundColor: withAlpha(Colors.primary500, 0.15),
          borderRadius: TAILLE_PASTILLE / 2,
          height: TAILLE_PASTILLE,
          width: TAILLE_PASTILLE,
        },
      ]}
    >
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={Images.bell}
        style={{ height: TAILLE_ICONE, tintColor: Colors.primary500, width: TAILLE_ICONE }}
      />
    </View>
  );
}

/**
 * « Alerte créée » : une coche ET des mots — le vert seul ne dirait rien à qui ne
 * le distingue pas.
 * @param {{ avecCorps?: boolean, sorte?: string }} props Les props.
 * @returns {import('react').ReactElement} La confirmation.
 */
export function ConfirmationAlerte({ avecCorps = true, sorte = SorteAlerte.evenement }) {
  const {
    Alignments, Colors, Fonts, Images, Spaces,
  } = /** @type {any} */ (useTheme());
  const { t } = useTranslation();
  return (
    <View accessibilityLiveRegion="polite" style={[Spaces.gap[4]]}>
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={Images.check}
          style={{ height: 16, tintColor: Colors.success500, width: 16 }}
        />
        <Text style={[Fonts.p2Bold, { color: Colors.success500, flex: 1 }]}>
          {t('searchAlerts.created.title', 'Alerte créée')}
        </Text>
      </View>
      {avecCorps ? (
        <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
          {sorte === SorteAlerte.annonce
            ? t(
              'searchAlerts.created.bodyAds',
              'Tu seras prévenu·e dès qu\'une nouvelle annonce comme celles-ci est publiée.',
            )
            : t(
              'searchAlerts.created.body',
              'Tu seras prévenu·e dès qu\'un nouvel événement comme ceux-ci est publié.',
            )}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Les trois étapes pour créer une alerte. Elles servent au guide ET, sur place, à
 * la proposition de première ouverture : un seul texte, deux portes.
 * @param {{ sorte?: string }} props Les props.
 * @returns {import('react').ReactElement} Les étapes.
 */
export function EtapesAlerte({ sorte = SorteAlerte.evenement }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());
  const { t } = useTranslation();
  const pourAnnonces = sorte === SorteAlerte.annonce;
  const etapes = [
    {
      corps: pourAnnonces
        ? t(
          'searchAlerts.guide.step1BodyAds',
          // eslint-disable-next-line max-len -- un texte ne se coupe pas
          'Dans Rechercher › Recrutement, ouvre les filtres et écris une ville. Le sport, le profil, la catégorie et le niveau sont en plus.',
        )
        : t(
          'searchAlerts.guide.step1Body',
          // eslint-disable-next-line max-len -- un texte ne se coupe pas
          'Dans Rechercher › Événement, ouvre les filtres et choisis au moins une ville. Le sport, la catégorie et le niveau sont en plus.',
        ),
      titre: t('searchAlerts.guide.step1Title', 'Choisis tes critères'),
    },
    {
      corps: t(
        'searchAlerts.guide.step2Body',
        // eslint-disable-next-line max-len -- un texte ne se coupe pas
        'L\'étoile en haut à droite des filtres, ou le bouton sous les résultats, enregistre ta recherche en un toucher.',
      ),
      titre: t('searchAlerts.guide.step2Title', 'Touche ★ ou « Créer l\'alerte »'),
    },
    {
      corps: pourAnnonces
        ? t(
          'searchAlerts.guide.step3BodyAds',
          // eslint-disable-next-line max-len -- un texte ne se coupe pas
          'Dès qu\'une nouvelle annonce correspondante est publiée, on te prévient. Tes alertes (10 au maximum) se gèrent dans Mon compte › Gérer mes alertes.',
        )
        : t(
          'searchAlerts.guide.step3Body',
          // eslint-disable-next-line max-len -- un texte ne se coupe pas
          'Dès qu\'un nouvel événement correspondant est publié, on te prévient. Tes alertes (10 au maximum) se gèrent dans Mon compte › Gérer mes alertes.',
        ),
      titre: t('searchAlerts.guide.step3Title', 'Reçois une notification'),
    },
  ];

  return (
    <View style={[Spaces.gap[16]]}>
      {etapes.map((etape, index) => (
        <View key={etape.titre} style={[Alignments.row, Spaces.gap[12]]}>
          <View
            style={[
              Alignments.alignCenter,
              Alignments.justifyCenter,
              {
                backgroundColor: withAlpha(Colors.primary500, 0.15),
                borderRadius: TAILLE_NUMERO / 2,
                height: TAILLE_NUMERO,
                width: TAILLE_NUMERO,
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>{String(index + 1)}</Text>
          </View>
          <View style={[Spaces.gap[4], { flex: 1 }]}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{etape.titre}</Text>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>{etape.corps}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Le guide « Comment créer une alerte ? », ouvrable autant de fois qu'on veut.
 * @param {{ isVisible: boolean, onClose: () => void, sorte?: string }} props Les props.
 * @returns {import('react').ReactElement} La feuille.
 */
export function GuideAlertes({ isVisible, onClose, sorte = SorteAlerte.evenement }) {
  const { Fonts, Spaces } = /** @type {any} */ (useTheme());
  const { t } = useTranslation();
  return (
    <BottomModal close={onClose} isVisible={isVisible}>
      <View style={[Spaces.gap[24], Spaces.paddingTop[8]]}>
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
          {t('searchAlerts.guide.title', 'Comment créer une alerte ?')}
        </Text>
        <EtapesAlerte sorte={sorte} />
        <Button
          onPress={onClose}
          title={t('searchAlerts.guide.close', 'J\'ai compris')}
          variant="Primary"
        />
      </View>
    </BottomModal>
  );
}

/**
 * Sous les résultats : « Me prévenir des nouveaux événements comme ceux-ci », ou
 * « … des nouvelles annonces comme celles-ci » (`sorte="annonce"`).
 * @param {{
 *   dejaCreee: boolean;
 *   enCours: boolean;
 *   onCreer: () => void;
 *   onGerer: () => void;
 *   onGuide: () => void;
 *   resume: string;
 *   sorte?: string;
 * }} props `resume` vide = pas de ville : le bouton mène alors aux filtres.
 * @returns {import('react').ReactElement} La carte.
 */
export function CarteMePrevenir({
  dejaCreee, enCours, onCreer, onGerer, onGuide, resume, sorte = SorteAlerte.evenement,
}) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());
  const { t } = useTranslation();
  const sansVille = !resume;
  const libelleBouton = sansVille
    ? t('searchAlerts.card.chooseCity', 'Choisir une ville')
    : t('searchAlerts.card.create', 'Créer l\'alerte');

  return (
    <View
      style={[
        Spaces.gap[12],
        Spaces.marginTop[16],
        Spaces.padding[16],
        {
          backgroundColor: withAlpha(Colors.primary900, 0.6),
          borderColor: withAlpha(Colors.primary500, 0.4),
          borderRadius: 16,
          borderWidth: 1,
        },
      ]}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
        <PastilleCloche />
        <Text style={[Fonts.p1Bold, Fonts.neutral00, { flex: 1 }]}>
          {sorte === SorteAlerte.annonce
            ? t('searchAlerts.card.titleAds', 'Me prévenir des nouvelles annonces comme celles-ci')
            : t('searchAlerts.card.title', 'Me prévenir des nouveaux événements comme ceux-ci')}
        </Text>
      </View>

      {dejaCreee ? (
        <>
          <ConfirmationAlerte sorte={sorte} />
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onGerer}
            style={[Alignments.justifyCenter, styles.lienDiscret]}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.primary300 }]}>
              {t('profile.actions.manageAlerts', 'Gérer mes alertes')}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
            {resume || t(
              'searchAlerts.card.noCity',
              'Choisis une ville : une alerte en a besoin pour savoir où chercher.',
            )}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ busy: enCours, disabled: enCours }}
            disabled={enCours}
            onPress={onCreer}
            style={[
              Alignments.alignCenter,
              Alignments.justifyCenter,
              {
                backgroundColor: Colors.primary500,
                borderRadius: 999,
                minHeight: HAUTEUR_TACTILE,
                opacity: enCours ? 0.6 : 1,
              },
            ]}
          >
            {enCours ? <Loader color={Colors.primary900} size="small" /> : (
              // Étiré sur toute la largeur du bouton : un libellé gras de deux mots
              // à sa largeur mesurée perd son dernier mot sous Android 16
              // (`piege-android16-gras-dernier-mot-perdu`).
              <Text
                style={[
                  Fonts.p2Bold,
                  { alignSelf: 'stretch', color: Colors.primary900, textAlign: 'center' },
                ]}
              >
                {libelleBouton}
              </Text>
            )}
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity
        accessibilityRole="button"
        onPress={onGuide}
        style={[Alignments.justifyCenter, styles.lienDiscret]}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.primary300 }]}>
          {t('searchAlerts.guide.link', 'Comment ça marche ?')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * La proposition de première ouverture. Une seule fois par compte : la mémoire
 * « déjà vu » est tenue par l'appelant (`useFeatureTutorial`).
 *
 * « Créer mon alerte » n'agit qu'une fois la feuille PARTIE (`SignalDeSortie`) :
 * l'action suivante peut ouvrir une autre feuille, celle des filtres.
 * @param {{ isVisible: boolean, onCreer: () => void, onFermer: () => void }} props Les props.
 * @returns {import('react').ReactElement} La feuille.
 */
export function PropositionAlerte({ isVisible, onCreer, onFermer }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());
  const { t } = useTranslation();
  const [etapesVisibles, setEtapesVisibles] = useState(false);
  /** @type {import('react').MutableRefObject<null | (() => void)>} */
  const actionEnAttenteRef = useRef(null);

  // Idempotent : les deux signaux de sortie (rappel `onDismissed` de la feuille et
  // démontage de son contenu) peuvent arriver tous les deux.
  const lancerLActionEnAttente = useCallback(() => {
    const action = actionEnAttenteRef.current;
    actionEnAttenteRef.current = null;
    action?.();
  }, []);

  const creer = useCallback(() => {
    actionEnAttenteRef.current = onCreer;
    onFermer();
  }, [onCreer, onFermer]);

  return (
    <BottomModal close={onFermer} isVisible={isVisible} onDismissed={lancerLActionEnAttente}>
      <View style={[Spaces.gap[16], Spaces.paddingTop[8]]}>
        <SignalDeSortie onExit={lancerLActionEnAttente} />
        <PastilleCloche />
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {t('searchAlerts.offer.title', 'Ne rate plus aucun événement')}
          </Text>
          <Text style={[Fonts.p1, { color: Colors.neutral200 }]}>
            {t(
              'searchAlerts.offer.body',
              // eslint-disable-next-line max-len -- un texte ne se coupe pas
              'Choisis une ville et un sport : on te prévient dès qu\'un nouvel événement correspondant est publié près de chez toi.',
            )}
          </Text>
        </View>

        {etapesVisibles ? <EtapesAlerte /> : (
          <TouchableOpacity
            accessibilityLabel={t('searchAlerts.guide.linkLabel', 'Voir comment créer une alerte')}
            accessibilityRole="button"
            onPress={() => setEtapesVisibles(true)}
            style={[Alignments.justifyCenter, styles.lienDiscret]}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.primary300 }]}>
              {t('searchAlerts.guide.link', 'Comment ça marche ?')}
            </Text>
          </TouchableOpacity>
        )}

        <View style={[Spaces.gap[8]]}>
          <Button
            onPress={creer}
            title={t('searchAlerts.offer.create', 'Créer mon alerte')}
            variant="Primary"
          />
          <Button
            onPress={onFermer}
            title={t('searchAlerts.offer.later', 'Plus tard')}
            variant="Ghost"
          />
        </View>
      </View>
    </BottomModal>
  );
}

/**
 * ⭐ L'étoile d'une feuille de filtres : ce qu'on y touche, et ce qu'on en lit.
 * `creer(...)` confie ses arguments à `onCreateAlert` et range la réponse
 * (un `StatutAlerte`) dans `note`. Sans `onCreateAlert`, rien ne se passe.
 *
 * ALERTES-ANNONCES (30/09) — sortie d'`EventFiltersSheet` (A20.4), où elle vivait
 * seule : la feuille du recrutement la porte désormais aussi.
 * @param {((...args: any[]) => Promise<string>) | undefined} onCreateAlert La création.
 * @returns {{
 *   creer: (...args: any[]) => Promise<void>;
 *   enCours: boolean;
 *   note: string;
 *   setNote: (note: string) => void;
 * }} L'état de l'étoile.
 */
export function useEtoileAlerte(onCreateAlert) {
  // '' | StatutAlerte : la note lue sous le titre après un appui sur l'étoile.
  const [note, setNote] = useState('');
  const [enCours, setEnCours] = useState(false);

  const creer = async (/** @type {any[]} */ ...args) => {
    if (!onCreateAlert || enCours) return;
    setEnCours(true);
    try {
      setNote(await onCreateAlert(...args));
    } catch {
      setNote(StatutAlerte.erreur);
    } finally {
      setEnCours(false);
    }
  };

  return {
    creer, enCours, note, setNote,
  };
}

/**
 * ⭐ « Créer alerte », en haut à droite d'une feuille de filtres.
 * @param {{ enCours: boolean, onPress: () => void }} props Les props.
 * @returns {import('react').ReactElement} L'étoile.
 */
export function EtoileAlerte({ enCours, onPress }) {
  const { Alignments, Colors, Fonts } = /** @type {any} */ (useTheme());
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      accessibilityLabel={t('searchAlerts.sheet.starLabel', 'Créer une alerte avec ces filtres')}
      accessibilityRole="button"
      accessibilityState={{ busy: enCours, disabled: enCours }}
      disabled={enCours}
      hitSlop={{
        bottom: 8, left: 8, right: 8, top: 8,
      }}
      onPress={onPress}
      style={[Alignments.alignCenter, Alignments.justifyCenter, { minHeight: 44, minWidth: 44 }]}
    >
      <Text style={[Fonts.h3Bold, { color: Colors.primary500 }]}>★</Text>
      <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
        {texteInsecable(t('eventFilters.createAlert', 'Créer alerte'))}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Ce que l'étoile a produit, lu sous le titre de la feuille.
 * @param {{ statut: string, sorte?: string }} props `statut` : un `StatutAlerte`.
 * @returns {import('react').ReactElement | null} La note, ou rien.
 */
export function NoteAlerte({ sorte = SorteAlerte.evenement, statut }) {
  const { Colors, Fonts } = /** @type {any} */ (useTheme());
  const { t } = useTranslation();
  if (statut === StatutAlerte.creee) return <ConfirmationAlerte sorte={sorte} />;
  if (statut === StatutAlerte.villeManquante) {
    return (
      <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
        {t(
          'searchAlerts.sheet.needCity',
          'Choisis une ville, puis touche ★ pour créer ton alerte.',
        )}
      </Text>
    );
  }
  if (statut === StatutAlerte.erreur) {
    return (
      <Text style={[Fonts.p3, { color: Colors.error500 }]}>
        {t(
          'searchAlerts.sheet.error',
          'L\'alerte n\'a pas pu être créée. Réessaie dans un instant.',
        )}
      </Text>
    );
  }
  return null;
}
