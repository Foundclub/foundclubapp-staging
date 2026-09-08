import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import DatePickerInput from '@/components/molecules/datePickerInput/DatePickerInput';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import TrainingSessionRow, {
  formatSessionDate,
} from '@/components/organisms/training/TrainingSessionRow';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useMyTraining, useUpdateTrainingSession } from '@/hooks/useTraining';

/**
 * « TOUTES MES SÉANCES » — les huit journées, dans l'ordre du planning.
 *
 * 🔎 POURQUOI CET ÉCRAN EXISTE. Le pack de design sort DÉLIBÉRÉMENT la liste des
 * huit journées de « Mon entraînement » pour la mettre derrière une porte : le
 * premier écran ne doit montrer que trois choses — la prochaine séance, où j'en
 * suis, et trois portes. Une liste de huit rangées au premier écran noyait le
 * seul geste qui compte : commencer la séance du jour.
 *
 * 🔎 L'ORDRE EST CELUI DU SERVEUR, jamais celui des dates : une journée reportée
 * garde sa place dans la progression, sinon le planning se réorganiserait sous
 * les yeux à chaque report.
 */

/**
 * LES DEUX DELAIS D UN GESTE, plus le calendrier pour tout le reste.
 *
 * 🔎 POURQUOI DEUX ET PAS TROIS : le pack en dessine deux (« Demain », « Dans
 * 2 jours ») et laisse le calendrier absorber les cas rares. Une troisieme
 * rangee « dans 7 jours » n a de sens que pour une blessure — et dans ce cas on
 * choisit une date, on ne compte pas en semaines.
 */
const DECALAGES = [1, 2];

/**
 * La date d une seance repoussee de N jours, ecrite comme le serveur l attend.
 *
 * 🪤 PAS `toISOString()` : il reconvertit en UTC, et minuit local a l est de
 * Greenwich retombe la VEILLE. Un « +1 jour » rendait donc la meme date, en
 * silence. On recompose la date avec les morceaux LOCAUX.
 * @param {string} depart la date de depart, au format ISO
 * @param {number} jours de combien de jours on repousse
 * @returns {string} la nouvelle date, au format AAAA-MM-JJ
 */
export const dateDecalee = (depart, jours) => {
  const nouvelle = new Date(`${String(depart).slice(0, 10)}T00:00:00`);
  nouvelle.setDate(nouvelle.getDate() + jours);
  return [
    nouvelle.getFullYear(),
    String(nouvelle.getMonth() + 1).padStart(2, '0'),
    String(nouvelle.getDate()).padStart(2, '0'),
  ].join('-');
};

/**
 * Une rangée de choix dans la feuille de décalage.
 * @param {object} props Les propriétés de la rangée.
 * @param {boolean} props.actif Vrai quand c'est le choix courant.
 * @param {string} [props.aDroite] Ce qui s'écrit à droite : la date visée.
 * @param {boolean} [props.enOr] Vrai pour « Sauter » : ce n'est pas un décalage.
 * @param {string} props.libelle Le texte de la rangée.
 * @param {() => void} props.onPress Retient ce choix.
 * @returns {React.ReactElement} une rangée sélectionnable
 */
function Rangee({
  actif, aDroite, enOr = false, libelle, onPress,
}) {
  const { Colors, Fonts } = useTheme();
  const teinte = enOr ? Colors.gold500 : Colors.primary500;

  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ selected: actif }}
      onPress={onPress}
      style={{
        alignItems: 'center',
        // Le choix retenu se REMPLIT : une simple bordure ne se voit pas au
        // soleil, et la feuille agissait avant sans jamais montrer ce qu'on
        // avait demandé.
        backgroundColor: actif ? withAlpha(teinte, 0.18) : 'transparent',
        borderColor: actif ? teinte : withAlpha(Colors.primary500, 0.25),
        borderRadius: 10,
        borderWidth: actif ? 2 : 1,
        flexDirection: 'row',
        gap: 8,
        // 52 points : on décale une séance debout, souvent en marchant.
        minHeight: 52,
        paddingHorizontal: 12,
      }}
    >
      <Text style={[Fonts.p2, { color: enOr ? Colors.gold500 : Colors.neutral00, flex: 1 }]}>
        {libelle}
      </Text>
      {Boolean(aDroite) && (
        <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>{aDroite}</Text>
      )}
    </TouchableOpacity>
  );
}

/**
 * L'écran lui-même.
 * @param {object} props
 * @param {Record<string, any>} props.navigation
 * @param {Record<string, any>} [props.route]
 * @returns {React.ReactElement} la liste de toutes les séances du programme suivi
 */
function TrainingSessions({ navigation, route }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const {
    error, isLoading, nextSession, refetch, sessions,
  } = useMyTraining();
  const decaler = useUpdateTrainingSession();

  // On peut ARRIVER sur cet ecran avec une seance deja designee : c est ce que
  // font les cinq questions de forme quand elles concluent « on reporte ». La
  // feuille s ouvre alors toute seule, sur la bonne seance, et la personne n a
  // qu un geste a faire — choisir de combien.
  const aReporter = route?.params?.postponeSessionId;
  const [aDecaler, setADecaler] = useState(/** @type {Record<string, any>|null} */ (null));
  const [demandeTraitee, setDemandeTraitee] = useState(false);
  // Le programme prescrit des ECARTS entre ses journees (« au moins 24 h apres le
  // dernier entrainement »). Repousser une seule seance les ecrase en silence :
  // la suivante se retrouve collee a celle qu on vient de bouger. Le choix est
  // donc explicite, et il est PRE-COCHE — c est ce qui preserve le protocole.
  const [enChaine, setEnChaine] = useState(true);
  // Le choix se VOIT avant d agir : la feuille agissait au toucher, on ne savait
  // donc jamais ce qu on venait de demander ni ce que ca changeait.
  const [choix, setChoix] = useState(/** @type {number|'custom'|'skip'|null} */ (null));
  const [dateLibre, setDateLibre] = useState(/** @type {Date|null} */ (null));

  // 🪤 La liste arrive APRES le premier rendu : ouvrir la feuille dans le corps du
  // composant la rouvrirait a chaque rendu, y compris apres une fermeture a la
  // main. `demandeTraitee` fait de cette demande un evenement UNIQUE.
  useEffect(() => {
    if (!aReporter || demandeTraitee) return;
    const cible = sessions.find((item) => item.documentId === aReporter);
    if (!cible) return;
    setDemandeTraitee(true);
    setADecaler(cible);
  }, [aReporter, demandeTraitee, sessions]);

  const openSession = useCallback((/** @type {Record<string, any>} */ session) => {
    navigation.navigate(RouteNames.TrainingDay, {
      dayId: session?.day?.documentId,
      sessionId: session?.documentId,
      title: session?.day?.title,
    });
  }, [navigation]);

  /** Ferme la feuille et remet le choix a zero : la prochaine repart propre. */
  const fermer = () => {
    setADecaler(null);
    setChoix(null);
    setDateLibre(null);
  };

  /** La date que le choix courant demande, ou `null` s il n en demande aucune. */
  const dateChoisie = (() => {
    if (!aDecaler?.plannedDate) return null;
    if (typeof choix === 'number') return dateDecalee(aDecaler.plannedDate, choix);
    if (choix === 'custom' && dateLibre) {
      return [
        dateLibre.getFullYear(),
        String(dateLibre.getMonth() + 1).padStart(2, '0'),
        String(dateLibre.getDate()).padStart(2, '0'),
      ].join('-');
    }
    return null;
  })();

  /**
   * LA DATE DE FIN DU PROGRAMME, avant et apres le geste.
   *
   * 🔎 C EST TOUT L INTERET DE LA FEUILLE : dire AVANT ce que le decalage change.
   * La fin se lit sur la DERNIERE seance planifiee ; elle ne bouge que si les
   * suivantes bougent, donc seulement quand la chaine est cochee.
   */
  const finApres = (() => {
    if (!enChaine || !dateChoisie || !aDecaler?.plannedDate) return null;
    const dernieres = (Array.isArray(sessions) ? sessions : [])
      .map((s) => s?.plannedDate).filter(Boolean).sort();
    const fin = dernieres[dernieres.length - 1];
    if (!fin) return null;
    const avant = new Date(`${String(aDecaler.plannedDate).slice(0, 10)}T00:00:00`);
    const apres = new Date(`${dateChoisie}T00:00:00`);
    const jours = Math.round((apres.getTime() - avant.getTime()) / 86400000);
    return formatSessionDate(dateDecalee(fin, jours));
  })();

  /**
   * Fait ce que le choix demande, puis referme.
   * @returns {void} rien : la feuille se ferme et la liste se relit
   */
  const confirmer = () => {
    if (!aDecaler?.documentId) return;
    // ⛔ SAUTER N EST PAS REPORTER, et la difference est dans le tuyau, pas dans un
    // reglage : sauter ne touche PAS `plannedDate`, et le decalage en chaine du
    // serveur ne se declenche que sur un changement de date. Les seances suivantes
    // ne peuvent donc pas bouger — on abandonne la seance, on ne la deplace pas.
    if (choix === 'skip') {
      decaler.mutate(
        { payload: { status: 'skipped' }, sessionDocumentId: aDecaler.documentId },
        { onSettled: fermer },
      );
      return;
    }
    if (!dateChoisie) return;
    decaler.mutate(
      {
        payload: { plannedDate: dateChoisie, shiftFollowing: enChaine },
        sessionDocumentId: aDecaler.documentId,
      },
      { onSettled: fermer },
    );
  };

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="tab-scene">
      <ScrollView
        contentContainerStyle={[Spaces.paddingBottom[40]]}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <View style={Spaces.gap[16]}>
          <View style={Spaces.gap[4]}>
            <Text style={[Fonts.h2Bold, { color: Colors.neutral00 }]}>
              {t('training.sessions.title')}
            </Text>
            {/*
              La phrase qui enlève la pression : le programme conseille un ordre,
              il ne l'impose pas. Sans elle, une date passée se lit comme un retard.
            */}
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              {t('training.sessions.lead')}
            </Text>
          </View>

          <WithDataWrapper error={error} isLoading={isLoading} onRetry={refetch}>
            <View style={Spaces.gap[12]}>
              {(Array.isArray(sessions) ? sessions : []).map((session) => (
                <View key={session.documentId} style={Spaces.gap[4]}>
                  <TrainingSessionRow
                    isNext={session.documentId === nextSession?.documentId}
                    onPress={() => openSession(session)}
                    session={session}
                  />
                  {/*
                    🎯 UNE PASTILLE BORDEE, pas un lien de texte nu : posé sous une
                    carte a dégradé, un mot cyan sans contour se lit comme une
                    légende, pas comme un bouton. Le contour est ce qui le rend
                    cliquable a l'oeil.
                  */}
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => setADecaler(session)}
                    style={{
                      alignSelf: 'flex-end',
                      borderColor: withAlpha(Colors.primary500, 0.5),
                      borderRadius: 999,
                      borderWidth: 1,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                    }}
                  >
                    <Text style={[Fonts.caption, { color: Colors.primary400 }]}>
                      {t('training.actions.postpone')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </WithDataWrapper>
        </View>
      </ScrollView>

      <BottomModal close={fermer} isVisible={Boolean(aDecaler)}>
        <View style={[Spaces.gap[12], Spaces.paddingBottom[24]]}>
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
            {t('training.postpone.title', { date: formatSessionDate(aDecaler?.plannedDate) })}
          </Text>

          {/*
            🔗 Le décalage EN CHAÎNE, pré-coché. Le programme prescrit des écarts
            entre ses journées ; repousser une seule séance les écrase en silence.
            Le serveur sait décaler les suivantes du même nombre de jours
            (`shiftFollowing`), et les écarts sont préservés tels quels.
          */}
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: enChaine }}
            onPress={() => setEnChaine((avant) => !avant)}
            style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}
          >
            <View style={{
              backgroundColor: enChaine ? Colors.primary500 : 'transparent',
              borderColor: Colors.primary500,
              borderRadius: 4,
              borderWidth: 1,
              height: 18,
              width: 18,
            }}
            />
            <Text style={[Fonts.p3, { color: Colors.neutral300, flex: 1 }]}>
              {t('training.postpone.scope')}
            </Text>
          </TouchableOpacity>

          {DECALAGES.map((jours) => (
            <Rangee
              actif={choix === jours}
              aDroite={aDecaler?.plannedDate
                ? formatSessionDate(dateDecalee(aDecaler.plannedDate, jours))
                : undefined}
              key={jours}
              libelle={t('training.postpone.byDays', { count: jours })}
              onPress={() => setChoix(jours)}
            />
          ))}
          <Rangee
            actif={choix === 'custom'}
            aDroite={dateLibre ? formatSessionDate(dateChoisie) : undefined}
            libelle={t('training.postpone.chooseDate')}
            onPress={() => setChoix('custom')}
          />
          {choix === 'custom' && (
            <DatePickerInput
              label={t('training.postpone.chooseDate')}
              minimumDate={new Date()}
              onChange={setDateLibre}
              value={dateLibre}
            />
          )}
          <Rangee
            actif={choix === 'skip'}
            enOr
            libelle={t('training.postpone.skip')}
            onPress={() => setChoix('skip')}
          />

          {/*
            LA PHRASE QUI VAUT LA FEUILLE : elle dit AVANT ce que le geste change
            à la date de fin. Elle change avec le choix — et « Sauter » a la
            sienne, parce qu'il ne décale rien du tout.
          */}
          {choix === 'skip' && (
            <Text style={[Fonts.caption, { color: Colors.gold500 }]}>
              {t('training.postpone.skipWarning')}
            </Text>
          )}
          {choix !== 'skip' && dateChoisie && (
            <Text style={[Fonts.caption, { color: Colors.neutral300 }]}>
              {finApres
                ? t('training.postpone.consequence', { date: finApres })
                : t('training.postpone.consequenceAlone')}
            </Text>
          )}

          <Button
            // ⛔ ÉTEINT tant qu'aucun choix n'est fait, et tant qu'un « Choisir une
            // date » n'a pas de date : sans ça le bouton part sans rien envoyer.
            disabled={!choix || (choix !== 'skip' && !dateChoisie)}
            isLoading={decaler.isPending}
            onPress={confirmer}
            title={choix === 'skip'
              ? t('training.postpone.confirmSkip')
              : t('training.postpone.confirm', {
                date: dateChoisie ? formatSessionDate(dateChoisie) : '…',
              })}
            variant={choix === 'skip' ? 'Secondary' : 'Primary'}
          />

          <Text style={[Fonts.caption, { color: withAlpha(Colors.neutral00, 0.6) }]}>
            {t('training.postpone.hint')}
          </Text>
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default TrainingSessions;
