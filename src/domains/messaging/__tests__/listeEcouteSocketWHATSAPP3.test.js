import fs from 'fs';
import path from 'path';

// WHATSAPP3 / ETAPE 2 — 🧨 L ECRAN DE LA LISTE N ECOUTAIT RIEN DU TOUT.
//
// Adel, 23/09 : « si je recois un message et que je suis sur l onglet Messagerie,
// avec la liste de toutes les conversations, il ne s affiche pas directement ».
//
// 🔎 DEUX MAILLONS CASSES, PAS UN. Le premier est cote serveur (il n annoncait le
// message qu a la salle du fil, que personne ne rejoint depuis la liste). Le
// SECOND est ici, et il aurait suffi a lui seul a tout bloquer :
//
//   `useEffect(() => {
//      if (!isConnected || !safeCurrentChatId || !socket) return undefined;
//      ... socket.on(MESSAGE_RECEIVED, ...) ...`
//
// Les ecouteurs n etaient poses QUE si l on avait un fil courant. Or l ecran de
// la liste appelle `useMessaging()` SANS argument (Messaging.js:123) : pour lui,
// `currentChatId` vaut `undefined`, l effet sortait aussitot, et AUCUN ecouteur
// n existait. Meme un serveur qui annonce correctement aurait parle dans le vide.
//
// 🎯 CE QUE CE TEMOIN GARDE : les ecouteurs se posent des qu une socket est
// connectee, avec ou sans fil ouvert. Seuls l entree et la sortie de salle
// (`JOIN_CHAT` / `LEAVE_CHAT`) restent conditionnees a un fil — les demander
// sans identifiant n aurait aucun sens.
//
// ⚠️ CE QU IL NE PROUVE PAS : que deux vrais telephones se parlent. Il lit les
// conditions posees dans le code, la ou le defaut vivait. Le bout en bout reseau
// demanderait `socket.io-client`, absent du depot (voir le compte rendu).

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, '..', 'useMessaging.js'),
  'utf8',
);

/** Le corps de l effet qui pose les ecouteurs de la socket. */
const effetDesEcouteurs = () => {
  const debut = SOURCE.indexOf('    // Set up event listeners after joining');
  if (debut === -1) throw new Error('effet des ecouteurs introuvable');
  const garde = SOURCE.lastIndexOf('useEffect(() => {', debut);
  return SOURCE.slice(garde, SOURCE.indexOf('}, [socket,', debut));
};

describe('WHATSAPP3 — la liste des conversations ecoute la socket', () => {
  it('🚪 les ecouteurs ne dependent PLUS d un fil ouvert', () => {
    const effet = effetDesEcouteurs();

    // C est la ligne exacte qui empechait l ecran de la liste d ecouter.
    expect(effet).not.toContain('if (!isConnected || !safeCurrentChatId || !socket) return undefined;');
    expect(effet).toMatch(/if \(!isConnected \|\| !socket\) return undefined;/);
  });

  it('l ecouteur des nouveaux messages est bien pose', () => {
    expect(effetDesEcouteurs()).toMatch(/socket\.on\(EVENTS\.MESSAGE_RECEIVED, handleNewMessage\)/);
  });

  it('entrer dans une salle reste conditionne a un fil : on ne rejoint pas « undefined »', () => {
    const effet = effetDesEcouteurs();

    expect(effet).toMatch(/if \(safeCurrentChatId\) \{[\s\S]*?EVENTS\.JOIN_CHAT/);
  });

  it('en sortant, on ne quitte une salle QUE si on en avait une', () => {
    const debut = SOURCE.indexOf('    // Cleanup: leave chat and remove listeners');
    expect(debut).toBeGreaterThan(-1);
    const nettoyage = SOURCE.slice(debut, SOURCE.indexOf('}, [socket,', debut));

    expect(nettoyage).toMatch(/if \(safeCurrentChatId\) \{[\s\S]*?EVENTS\.LEAVE_CHAT/);
    // Et les ecouteurs, eux, sont TOUJOURS retires : sinon ils s empileraient a
    // chaque navigation, et un message arriverait en double, puis en triple.
    expect(nettoyage).toMatch(/socket\.off\(EVENTS\.MESSAGE_RECEIVED, handleNewMessage\)/);
  });

  it('l ecran de la liste appelle bien useMessaging SANS fil : c est le cas a couvrir', () => {
    const messagerie = fs.readFileSync(
      path.resolve(__dirname, '..', '..', '..', 'views', 'Messaging.js'),
      'utf8',
    );

    expect(messagerie).toMatch(/\}\s*=\s*useMessaging\(\);/);
  });
});
