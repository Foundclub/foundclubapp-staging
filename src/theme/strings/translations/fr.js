export default {
  addCoach: {
    actions: {
      invite: 'Inviter',
      save: 'Envoyer l\'invitation',
    },
    alerts: {
      alreadyExist: {
        actions: {
          addToClub: 'Ajouter au club',
          cancel: 'Annuler',
        },
        description: "Le détenteur de ce numéro de téléphone utilise l'application sous le nom de {{firstname}} {{lastname}}. Veux-tu l'ajouter à ton club ?",
        title: 'Un utilisateur existe déjà avec ce numéro de téléphone.',
      },
      alreadyInClub: {
        description: "Un utilisateur du nom de {{firstname}} {{lastname}} est déjà membre d'un autre club.",
        title: "Impossible d'ajouter cet·te entraîneur·e à l'équipe",
      },
      success: {
        description: "L'entraîneur·e {{trainerName}} a bien été ajouté·e à ton club.",
        title: 'Ajout réussi !',
      },
    },
    fields: {
      birthdate: {
        label: 'Date de naissance — optionnelle',
        placeholder: 'JJ/MM/AAAA',
      },
      firstname: {
        label: 'Prénom',
        placeholder: 'Luc',
      },
      lastname: {
        label: 'Nom',
        placeholder: 'Harne',
      },
      phoneNumber: {
        label: 'Numéro de téléphone — requis',
        placeholder: '+33612345678',
      },
      role: {
        label: 'Rôle',
      },
    },
    hints: {
      invitation: 'Une invitation SMS lui sera envoyée pour rejoindre le club.',
    },
    roles: {
      manager: 'Dirigeant·e',
      trainer: 'Entraîneur·e',
    },
    subtitles: {
      avatar: "Ajoute une photo de profil pour que l'on puisse reconnaître l'entraîneur·e facilement.",
      birthdate: "Renseigne la date de naissance de l'entraîneur·e.",
      name: "Renseigne le nom et prénom de l'entraîneur·e.",
    },
    titles: {
      birthdate: 'Quelle est sa date de naissance ?',
      main: 'Ajouter un·e entraîneur·e',
      name: "Comment s'appelle l'entraîneur·e ?",
    },
  },
  addSponsor: {
    actions: {
      save: 'Ajouter le partenaire',
    },
    fields: {
      link: {
        label: 'Lien vers le site du partenaire',
        placeholder: 'https://www.nike.com',
      },
      logo: 'Logo du partenaire',
      title: {
        label: 'Nom du partenaire',
        placeholder: 'Nike',
      },
    },
    hints: {
      visibility: 'Il apparaîtra sur les cartes équipe, les annonces et la page du club.',
    },
    title: 'Ajouter un partenaire',
  },
  APIerrors: {
    // Authentication errors
    AUTHENTICATION_FAILED: "Échec d'authentification.",
    INVALID_TOKEN: "Jeton d'authentification invalide.",
    MISSING_TOKEN: "Jeton d'authentification manquant.",
    OTP_ERROR: 'Une erreur est survenue lors de la connexion OTP',

    // Authorization errors
    FORBIDDEN: 'Accès refusé.',
    // Repli quand un écran n'héberge pas encore la feuille de vente : le refus est bien un
    // refus d'abonnement, pas un refus de droits — les deux ne se disent pas pareil.
    SUBSCRIPTION_PERMISSION_DENIED: "Cette action nécessite une offre FoundClub active. Rends-toi dans Mon abonnement pour l'activer.",
    UNAUTHORIZED: "Tu n'es pas autorisé·e à effectuer cette action.",

    // Validation errors
    INVALID_FIELD_FORMAT: 'Format de champ invalide.',
    MISSING_REQUIRED_FIELD: 'Un champ obligatoire est manquant.',
    VALIDATION_ERROR: 'Erreur de validation.',

    // User errors
    EMAIL_TAKEN: 'Cette adresse email est déjà utilisée.',
    PHONE_NUMBER_TAKEN: 'Ce numéro de téléphone est déjà utilisé.',
    USER_ALREADY_EXISTS: 'Cet utilisateur existe déjà.',
    USER_NOT_FOUND: 'Utilisateur introuvable.',
    USERNAME_TAKEN: "Ce nom d'utilisateur est déjà utilisé.",

    // Club errors
    CLUB_DELETE_ERROR: 'Erreur lors de la suppression du club.',
    CLUB_IMPORT_ERROR: "Erreur lors de l'import des données du club.",
    CLUB_NOT_FOUND: 'Club introuvable.',
    CLUB_SPONSOR_ERROR: 'Erreur concernant le partenaire du club.',
    CLUB_UPDATE_ERROR: 'Erreur lors de la mise à jour du club.',
    USER_NOT_IN_CLUB: "L'utilisateur n'est pas membre du club.",

    // Membership request errors
    MEMBERSHIP_REQUEST_ALREADY_PROCESSED: "La demande d'adhésion a déjà été traitée.",
    MEMBERSHIP_REQUEST_NOT_PENDING: "La demande d'adhésion n'est pas en attente.",
    MEMBERSHIP_REQUEST_REFUSED: "La demande d'adhésion a été refusée.",

    // Sport errors
    SPORT_DELETE_ERROR: 'Erreur lors de la suppression du sport.',

    // Trainer errors
    NOT_A_TRAINER: "L'utilisateur n'est pas un·e entraîneur·e.",
    TRAINER_ALREADY_IN_CLUB: "L'entraîneur·e est déjà membre d'un club.",
    TRAINER_HAS_TEAMS: "L'entraîneur·e est associé·e à des équipes.",
    TRAINER_IS_UNIQUE_TEAM_TRAINER: "L'entraîneur·e est le/la seul·e entraîneur·e de l'équipe.",
    TRAINER_NOT_FOUND: 'Entraîneur·e introuvable.',
    TRAINER_NOT_IN_CLUB: "L'entraîneur·e n'est pas membre du club.",

    // Team errors
    CLUB_MAX_TEAM_NUMBER_REACHED: 'Le nombre maximum d\'équipes pour ce club a été atteint.',
    TEAM_CLUB_REQUIRED: 'Un club est requis pour chaque équipe.',
    TEAM_MEMBER_POLICY_ERROR: 'Pour effectuer cette action, tu dois être membre de l\'équipe.',
    TEAM_PLAYER_REMOVE_ERROR: 'Erreur lors de la suppression du/de la joueur·se de l\'équipe.',
    TEAM_TRAINER_CONNECT_REQUIRED: 'La connexion avec l\'entraîneur·e est requise.',
    TEAM_TRAINER_REMOVE_ERROR: 'Erreur lors de la suppression de l\'entraîneur·e de l\'équipe.',
    TEAM_TRAINER_REQUIRED: 'Au moins un·e entraîneur·e est requis·e pour chaque équipe.',
    TEAM_TRAINER_SET_REQUIRED: 'Une équipe d\'entraîneur·e·s est requise.',

    // Department errors
    DEPARTMENT_IMPORT_ERROR: 'Erreur lors de l\'import des données du département.',
    DEPARTMENT_REQUIRED: 'Le département est requis.',

    // Event errors
    EVENT_ALREADY_MISSING: 'Tu as déjà répondu absent à cet événement.',
    EVENT_AUDIENCE_NOT_TARGETED: "Cet événement ne convie qu'une partie de ton équipe.",
    EVENT_CANCEL_ERROR: "Erreur lors de l'annulation de l'événement.",
    EVENT_CAPACITY_ERROR: "La capacité maximale de l'événement est atteinte.",
    EVENT_CREATE_ERROR: "Erreur lors de la création de l'événement.",
    EVENT_DATE_ERROR: "La date de l'événement est invalide.",
    EVENT_DATE_PAST: "La date ou l'heure de l'événement est déjà passée.",
    EVENT_FIND_ERROR: "Erreur lors de la recherche de l'événement.",
    EVENT_INVALID_TIME_RANGE: "L'heure de fin doit être après l'heure de début.",
    EVENT_IS_NOT_ACTIVE_ERROR: "L'événement n'est pas actif.",
    EVENT_LOCATION_REQUIRED: 'Un lieu est requis pour créer un événement.',
    EVENT_MISSING_ERROR: "Erreur lors de la réponse à l'événement.",
    EVENT_PARTICIPATION_ACCEPT_ERROR: "Erreur lors de l'acceptation de la participation.",
    EVENT_PARTICIPATION_ALREADY_TREATED: 'La demande de participation a déjà été traitée.',
    EVENT_PARTICIPATION_CREATE_ERROR: 'Erreur lors de la création de la participation.',
    EVENT_PARTICIPATION_REFUSE_ERROR: 'Erreur lors du refus de la participation.',
    EVENT_SLOT_CONFLICT: 'Un conflit de créneau a été détecté pour ce lieu.',
    EVENT_UPDATE_ERROR: "Erreur lors de la mise à jour de l'événement.",
    EVENT_USER_ALREADY_IN_EVENT_ERROR: "L'utilisateur est déjà inscrit à cet événement.",
    // W01 — le serveur n envoie ce code que pour UNE raison : ne faire partie
    // d aucune des equipes conviees (`event-rsvp.ts:101`, `event.ts:3052`,
    // `event-participation.ts:436`). Depuis le lot U02 un encadrant MEMBRE est
    // accepte : lui dire « pas joueur de l equipe » nommait son role au lieu de
    // son appartenance, et lui faisait croire que son compte lui interdisait de
    // repondre. Meme cle, meme place — seule la phrase change.
    EVENT_USER_NOT_PLAYER_OF_TEAM_ERROR: "Cet événement est réservé aux équipes conviées, et tu n'es membre d'aucune d'elles.",

    // Event participation request errors
    EVENT_PARTICIPATION_ALREADY_HAS_A_REQUEST_POLICY_ERROR: 'Une demande de participation existe déjà pour cet événement.',
    EVENT_PARTICIPATION_DELETE_ERROR: 'Erreur lors de la suppression de la participation à l\'événement.',
    EVENT_PARTICIPATION_REQUEST_ALREADY_EXISTS: 'Une demande de participation existe déjà.',
    EVENT_PARTICIPATION_REQUEST_NOT_FOUND: 'Demande de participation introuvable.',
    EVENT_PARTICIPATION_REQUEST_POLICY_ERROR: 'Violation de la politique concernant les demandes de participation.',
    EVENT_PLAYER_POLICY_ERROR: 'Violation de la politique concernant les joueur·se·s.',

    // Chat errors
    CHAT_ID_NOT_PROVIDED: 'ID de chat non fourni.',
    FAILED_TO_ACCESS_CHAT: 'Impossible d\'accéder au chat.',
    FAILED_TO_JOIN_CHAT: 'Impossible de rejoindre le chat.',
    FAILED_TO_SEND_MESSAGE: 'Impossible d\'envoyer le message.',
    MESSAGE_TOO_LONG: 'Le message est trop long.',
    RATE_LIMIT_EXCEEDED: 'Limite de taux dépassée.',
    USER_NOT_PARTICIPANT_OF_CHAT: 'L\'utilisateur·rice n\'est pas participant·e du chat.',

    // Server errors
    DATABASE_ERROR: 'Erreur de base de données.',
    INTERNAL_SERVER_ERROR: 'Erreur interne du serveur.',

    // File upload errors
    FILE_TOO_LARGE: 'Fichier trop volumineux.',
    FILE_UPLOAD_ERROR: 'Erreur lors du téléchargement du fichier.',
    INVALID_FILE_TYPE: 'Type de fichier invalide.',

    // Policy errors
    // AB05 — CES QUATRE-LÀ AFFICHAIENT LEUR PROPRE CODE À L'ÉCRAN.
    // Leur « traduction » était le nom de la constante, en majuscules :
    // `CHAT_NOT_FOUND_POLICY_ERROR` s'affichait tel quel dans la fenêtre
    // d'erreur. Ce n'est pas une phrase, c'est une fuite de plomberie —
    // et c'est la seule famille de messages creux que ce lot répare, parce
    // qu'elle est la seule qui ne demande aucune enquête par appelant.
    // Chaque phrase dit ce qui manque, côté serveur, à l'endroit exact où le
    // refus est posé.
    //   `is-message-sender.ts` : le message n'existe pas, OU il n'est pas de toi
    CHAT_MESSAGE_NOT_FOUND_POLICY_ERROR: 'Ce message n’existe plus, ou il n’est pas de toi.',
    //   `can-report-message.ts` : le message signalé est introuvable
    CHAT_MESSAGE_REPORT_NOT_FOUND_POLICY_ERROR: 'Ce message n’existe plus : il a peut-être été supprimé.',
    //   `can-access-chat.ts` : la conversation est introuvable ou fermée pour toi
    CHAT_NOT_FOUND_POLICY_ERROR: 'Cette conversation n’existe plus, ou tu n’en fais plus partie.',
    //   `is-club-manager-create.ts` : la demande est partie SANS club (le code
    //   n'est posé que dans ce cas-là — le refus de droit, lui, sort en 403 nu)
    CLUB_MANAGER_CREATE_POLICY_ERROR: 'Cette action n’a pas pu identifier le club concerné. Réessaie depuis la fiche du club.',
    CLUB_MANAGER_POLICY_ERROR: 'Violation de la politique concernant les dirigeant·e·s du club.',
    CLUB_MEMBER_POLICY_ERROR: 'Violation de la politique concernant les membres du club.',
    CLUB_STAFF_CREATE_POLICY_ERROR: 'Violation de la politique de création de personnel du club.',
    CLUB_STAFF_POLICY_ERROR: 'Violation de la politique concernant le personnel du club.',
    error: 'Erreur',
    EVENT_TRAINER_CREATE_POLICY_ERROR: "Violation de la politique de création d'événements par les entraîneur·e·s.",
    EVENT_TRAINER_POLICY_ERROR: 'Violation de la politique concernant les entraîneur·e·s et les événements.',
    generic: 'Une erreur est survenue. Merci de réessayer plus tard.',
    HAD_PENDING_MEMBERSHIP_REQUEST_POLICY_ERROR: "Tu as déjà une demande d'adhésion en attente.",
    MANAGER_TRAINER_CLUB_POLICY_ERROR: 'Violation de la politique concernant les entraîneur·e·s et dirigeant·e·s du club.',
    MANAGER_WITH_CLUB_POLICY_ERROR: 'Violation de la politique concernant les dirigeant·e·s avec club.',
    phoneNumberAlreadyUsed: 'Ce numéro est déjà utilisé par {{firstname}} {{lastname}}.',
    phoneNumberAlreadyUsedWithClub: 'Ce numéro est déjà utilisé par un·e entraîneur·e qui appartient à un club.',
    'Request failed with status code 404': 'La ressource demandée est introuvable.',
    schemaMismatch: 'Un problème est survenu lors de la récupération des informations.'
      + ' Merci de vérifier que ton application est à jour ou réessayer plus tard.',
    TEAM_MANAGER_POLICY_ERROR: 'Violation de la politique concernant les gestionnaires d\'équipe.',
    TEAM_TRAINER_CREATE_POLICY_ERROR: 'Violation de la politique de création d\'événements par les entraîneur·e·s.',
    title: 'Erreur',
    UNIQUE_CLUB_CHAT_POLICY_ERROR: 'Violation de la politique concernant les discussions de club.',
    UNIQUE_TEAM_CHAT_POLICY_ERROR: 'Violation de la politique concernant les discussions d\'équipe.',
    UNIQUE_WHISPER_CHAT_POLICY_ERROR: 'Violation de la politique concernant les discussions privées.',
    unknown: 'Une erreur inconnue est survenue.',
    USER_NOT_FOUND_POLICY_ERROR: 'Violation de la politique concernant les utilisateurs introuvables.',
  },
  appUpdateGate: {
    a11y: {
      contactHint: "Ouvre le site FoundClub pour joindre l'équipe.",
      laterHint: 'Ferme ce message et continue dans FoundClub.',
      updateHint: "Ouvre la boutique d'applications de ce téléphone.",
    },
    actions: {
      contact: 'Un problème ? Nous contacter',
      later: 'Plus tard',
      update: 'Mettre à jour',
    },
    installedVersion: 'Version installée : {{version}}',
    recommended: {
      description: 'Mets à jour FoundClub pour profiter des dernières nouveautés '
        + 'et corrections.',
      title: 'Une mise à jour est disponible',
      version: 'Version {{version}}',
    },
    redirectNotice: 'Tu seras redirigé·e vers {{store}}.',
    releaseNotesTitle: 'Dans cette version',
    requiredVersion: 'Version demandée : {{version}}',
    stores: {
      android: 'Google Play',
      ios: "l'App Store",
    },
    storeUnreachable: "Impossible d'ouvrir le store. Réessaie.",
    title: 'Une mise à jour est disponible',
    versionChip: 'Version {{minimum}} requise · tu es en {{current}}',
    what: 'Tes données et ton compte sont intacts.',
    why: 'Télécharge la nouvelle version de FoundClub pour continuer à profiter '
      + "de l'app.",
  },
  club: {
    fields: {
      address: {
        label: 'Adresse',
        placeholder: 'Adresse du club',
      },
      email: {
        label: 'Email',
        placeholder: 'Email du club',
      },
      name: {
        label: 'Nom',
        placeholder: 'Nom du club',
      },
      phoneNumber: {
        label: 'Téléphone',
        placeholder: 'Téléphone du club',
      },
    },
  },
  clubDetails: {
    actions: {
      // S02 — la VALEUR change, la clef reste (aucune clef n'est supprimee de ce
      // fichier). « Me prévenir dès qu’une équipe existe » decrivait ce que fait
      // l'AUTRE bouton : ce bouton-ci, lui, ouvre le formulaire « je suis deja
      // dans ce club, faites-le venir ». Les deux disaient la meme chose, et
      // c'est ce que « très nul » designait (Adel, 2026-08-16).
      bringClubOver: 'C’est mon club',
      claimClub: "C'est mon club",
      // S02 — la SECONDE porte. Elle dit ce que la personne OBTIENT (on la
      // previent), pas ce qu'elle declare : c'est ce qui la rend impossible a
      // confondre avec « C’est mon club » juste au-dessus.
      clubArrivalInterest: 'Prévenez-moi quand ce club arrive',
      clubArrivalInterestPending: 'Tu seras prévenu·e',
      contactTrainers: 'Contacter les entraîneur·e·s',
      delete: 'Supprimer',
      editInfo: 'Modifier',
      join: "C'est mon club !",
      joinAsMyClub: "C'est mon club !",
      leave: 'Quitter le club',
      manageJoinRequests: 'Voir les demandes d\'affiliation',
      playAtClub: 'Je joue dans ce club',
      requestJoin: 'Demander à rejoindre ce club',
      requestPending: 'Demande en attente',
    },
    alerts: {
      // S02 — la 2e porte parle de CE QU'ON FAIT DE L'INTERET : on previent la
      // personne, et le club voit combien de gens l'attendent. Rien n'est promis
      // d'autre : elle n'est rattachee a rien, et le texte le dit.
      clubArrivalInterest: {
        alreadySentDescription: 'On sait déjà que tu attends ce club.'
          + ' On te prévient dès qu’il arrive.',
        alreadySentTitle: 'Tu es déjà sur la liste',
        description: 'On te prévient dès que ce club arrive sur FoundClub.'
          + ' Tu n’es rattaché·e à rien pour le moment.',
        error: 'Impossible d’enregistrer ton intérêt pour le moment.',
        title: 'C’est noté',
      },
      deleteSponsor: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer',
        },
        description: 'Es-tu sûr·e de vouloir continuer ?',
        title: 'Tu es sur le point de supprimer le partenaire {{sponsorName}}.',
      },
      deleteTrainer: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer',
        },
        description: 'Le compte ne sera pas supprimé, mais l\'entraîneur·e ne sera plus lié·e au club. Es-tu sûr·e de vouloir continuer ?',
        title: 'Tu es sur le point de supprimer cet·te entraîneur·e.',
      },
      inviteTrainer: {
        message: 'Bonjour {{coachName}} !'
          + '\nTu as été désigné·e comme entraîneur·e dans le club {{clubName}}.'
          + "\nTélécharge l'application Found Club pour finaliser la création de ton compte"
          + ' et commencer à gérer tes équipes et tes événements.',
        title: 'Bienvenue sur Found Club !',
      },
      joinClub: {
        actions: {
          ok: 'OK',
        },
        description: 'Ton dirigeant·e va recevoir ta demande et la traiter dès que possible.',
        title: "Ta demande d'adhésion a bien été envoyée",
      },
      leave: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Quitter le club',
        },
        description: "Tu ne seras plus lié·e à ce club ni à ses équipes en tant qu'encadrant·e. Es-tu sûr·e de vouloir continuer ?",
        error: 'Impossible de quitter ce club pour le moment.',
        title: 'Quitter le club ?',
      },
      myClub: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Contacter Found Club',
        },
        description: 'Contacte nos équipes pour accéder aux fonctionnalités réservées aux dirigeant·e·s et aux entraîneur·e·s du club.',
        title: 'Tu es dirigeant·e de ce club ?',
      },
      playerNoTeamRequest: {
        alreadySentDescription: 'Tu attends déjà ce club. On te prévient dès qu’une équipe y est créée.',
        alreadySentTitle: 'Demande déjà envoyée',
        description: 'On a bien noté que tu attends ce club. On te prévient dès qu’une équipe y est créée.',
        error: "Impossible d'envoyer ta demande pour le moment.",
        title: 'Demande envoyée',
      },
      // V01 — le même geste sur un club QUI EST déjà là. On ne peut pas lui
      // promettre « on te prévient quand il arrive » : il est arrivé. Ce qui
      // l'attend, ce sont des dirigeants qui vont lire son intérêt.
      wholeClubInterest: {
        description: 'Les dirigeants du club ont reçu ton intérêt et pourront te répondre.'
          + ' Tu n’es rattaché·e à rien pour le moment.',
      },
    },
    playerNoTeamRequest: {
      clubLabel: 'Club que tu attends',
      coachSectionNotice: 'Tu peux laisser vide : ta demande part quand même. Si tu donnes un contact, on le prévient que c’est toi qui nous as transmis ses coordonnées, et on l’efface s’il nous le demande.',
      coachSectionTitle: 'Tu connais ton coach ou un dirigeant ? (facultatif)',
      description: 'Ton club est bien là, mais personne n’y a encore créé d’équipe. Dis-nous que tu l’attends : on contacte le club pour qu’il rejoigne FoundClub, et on te prévient dès qu’une équipe existe.',
      fields: {
        coachContact: 'Contact du coach (téléphone ou e-mail)',
        coachContactPlaceholder: 'Ex: 06 12 34 56 78 ou coach@club.fr',
        coachName: 'Nom de ton coach ou dirigeant',
        coachNamePlaceholder: 'Ex: Karim Benali',
      },
      // S02 — meme motif que `actions.bringClubOver` : ce bouton VALIDE le
      // formulaire de « C’est mon club ». Promettre ici « je te préviens » le
      // rendait indiscernable de la seconde porte.
      submit: 'Envoyer ma demande',
      title: 'Ce club n’a pas encore d’équipe sur FoundClub',
    },
    // AB05 — CE QUE DIT LA FENETRE QUAND « C’EST MON CLUB » EST REFUSÉ.
    // Adel, 2026-08-20 : « il y a écrit "Accès refusé" sans expliquer pourquoi ».
    // « Accès refusé » est un statut HTTP traduit, pas un motif : le filet global
    // le fabrique pour TOUT 403, donc il ne peut rien apprendre à personne.
    // Chaque phrase ci-dessous dit la RAISON puis la SORTIE, et jamais un code.
    // La table qui les choisit vit dans `services/requests/clubAffiliationRefusal.js`.
    refusal: {
      alreadyAsked: 'Tu as déjà demandé ce club. Un administrateur FoundClub est en train de regarder ta demande.',
      clubGone: 'Ce club n’existe plus. Reviens à la recherche pour en trouver un autre.',
      noRole: 'Ton compte n’a pas encore de rôle. Termine ton inscription pour pouvoir dire qu’un club est le tien.',
      sessionExpired: 'Ta session a expiré. Reconnecte-toi, puis renvoie ta demande.',
      // ⛔ Le repli ne PRÉTEND RIEN SAVOIR : il dit ce qui s’est passé (rien
      // n’est parti) et quoi faire. « Une erreur est survenue » ne fait ni l’un
      // ni l’autre.
      unknown: 'Ta demande n’est pas partie. Réessaie dans un instant.',
    },
    titles: {
      activities: 'Sports',
      coachs: 'Nos entraîneur·e·s',
      owners: 'Nos dirigeant·e·s',
      sponsors: 'Nos partenaires',
      teams: 'Nos équipes',
    },
  },
  clubEdit: {
    title: 'Modifier le club',
  },
  clubFilters: {
    actions: {
      apply: 'Appliquer les filtres',
      clear: 'Effacer les filtres',
    },
    fields: {
      activity: {
        label: 'Sport',
        placeholder: 'Sélectionner une activité',
      },
      city: {
        label: 'Ville',
        placeholder: 'Marseille',
      },
      radius: {
        label: 'Dans un rayon autour de : ',
      },
    },
  },
  clubList: {
    actions: {
      createClub: 'Ajouter mon club',
    },
    fields: {
      search: 'Rechercher',
    },
    noData: 'Aucun club ne correspond à la recherche.',
    title: 'Trouver mon club',
  },
  clubMembershipRequestList: {
    actions: {
      accept: 'Accepter',
      reject: 'Refuser',
    },
    errors: {
      accept: 'Impossible de valider la demande pour le moment.',
      missingRequester: 'Impossible de traiter cette demande. Demande au joueur de renvoyer sa demande.',
      reject: 'Impossible de refuser la demande pour le moment.',
    },
    fields: {
      accepted: 'Demande acceptée',
      claimAccepted: '{{firstname}} a bien été ajouté·e comme dirigeant·e du club.',
      claimAcceptedTitle: 'Dirigeant ajouté',
      pending: "{{firstname}} s'est signalé·e comme entraîneur·e de cette équipe",
      pendingClaim: '{{firstname}} souhaite revendiquer la gestion de ce club.',
      rejected: 'Demande refusée',
    },
    noData: 'Aucune demande d\'affiliation en attente',
    title: 'Demandes d\'affiliation',
  },
  clubWizard: {
    activities: {
      empty: 'Aucun sport ne correspond.',
      searchLabel: 'Rechercher un sport',
      searchPlaceholder: 'Football, basket…',
      subtitle: 'Sélectionne les sports pratiqués dans ton club (tu pourras en ajouter plus tard).',
      title: 'Quels sports pratiques-tu ?',
    },
    address: {
      label: 'Adresse du club',
      placeholder: 'Rue, ville…',
      subtitle: 'Recherche l\'adresse de ton club. Elle le rend visible sur la carte et près des joueurs.',
      title: 'Où se trouve ton club ?',
    },
    contact: {
      alsoDirector: 'Je suis aussi dirigeant de ce club',
      alsoDirectorSubtitle: 'Coche si tu gères aussi le club (et pas seulement une équipe).',
      emailInvalid: 'Adresse email invalide.',
      emailLabel: 'Email du club (facultatif)',
      emailPlaceholder: 'contact@club.fr',
      phoneLabel: 'Téléphone du club (facultatif)',
      phonePlaceholder: '0612345678',
      skip: 'Passer cette étape',
      subtitle: 'Ces coordonnées aident les joueurs à contacter ton club. Tu peux les ajouter plus tard.',
      title: 'Coordonnées du club',
    },
    name: {
      duplicateHint: 'C\'est peut-être l\'un de ceux-ci ?',
      label: 'Nom du club',
      placeholder: 'FC Marseille',
      subtitle: 'Donne le nom officiel de ton club. On vérifie au passage qu\'il n\'existe pas déjà.',
      title: 'Quel est le nom de ton club ?',
    },
    recap: {
      address: 'Adresse',
      create: 'Créer mon club',
      createAnyway: 'Créer quand même',
      duplicateHint: 'Rejoins-le s\'il s\'agit du tien, ou touche « Créer quand même » si c\'est un autre club.',
      duplicateTitle: 'Un club très proche existe déjà',
      email: 'Email',
      error: 'Impossible de créer le club.',
      missing: 'Renseigne au moins le nom et l\'adresse du club.',
      name: 'Nom',
      phone: 'Téléphone',
      sports: 'Sports',
      subtitle: 'Vérifie les informations avant de créer ton club.',
      successDescription: 'Ton club est en ligne. Notre équipe le vérifiera prochainement.',
      successTitle: 'Club créé !',
      title: 'Récapitulatif',
    },
  },
  common: {
    actions: {
      askLater: 'Plus tard',
      cancel: 'Annuler',
      confirm: 'Confirmer',
      continueLater: 'Continuer plus tard',
      create: 'Créer',
      delete: 'Supprimer',
      next: 'Continuer',
      ok: 'OK',
      openInGps: 'Ouvrir dans le GPS',
      photoFromCamera: 'Prendre une photo',
      photoFromGallery: 'Choisir depuis la galerie',
      save: 'Enregistrer',
    },
    back: 'Retour',
    chat: 'Conversation',
    close: 'Fermer',
    error: 'Erreur',
    errorOccurred: 'Une erreur est survenue.',
    finish: 'Terminer',
    ignore: 'Ignorer',
    loading: 'Chargement...',
    member: 'Membre',
    messages: {
      noData: 'Aucune donnée disponible',
    },
    next: 'Suivant',
    previous: 'Précédent',
    skip: 'Passer',
    success: 'Succès',
    teams: 'Équipes',
    view: 'Voir',
  },
  // C-C — ECRAN 11 du pack composition : la compo type d'une équipe.
  compoTemplate: {
    actions: {
      duplicate: 'Dupliquer',
      save: 'Enregistrer la compo type',
    },
    alerts: {
      error: {
        save: 'Impossible d’enregistrer la compo type.',
        title: 'Erreur',
      },
      saved: {
        message: 'La compo type pré-remplira le terrain à la prochaine convocation.',
        title: 'Compo type enregistrée',
      },
    },
    apply: {
      subtitle: 'La compo type pré-remplit le terrain — il ne reste '
        + 'qu’à ajuster les convoqués du jour.',
      title: 'Appliquer à un match',
    },
    bench: {
      empty: 'Tout le monde est sur le terrain.',
      title: 'Non placés · {{count}}',
    },
    defaultChip: 'Par défaut',
    emptyField: 'Glisse un joueur sur le terrain pour commencer.',
    sources: {
      last: 'Dernier',
      new: 'Nouvelle compo',
      template: 'Compo type',
    },
    subtitle: 'modèle réutilisable',
    title: 'Compo type',
    tokenOnBench: '{{name}}, pas encore placé',
    tokenOnField: '{{name}}, sur le terrain',
    unavailable: {
      // ⚠️ Mesuré le 2026-08-15 : aucune route d'équipe ne rend la dernière
      // composition publiée. La cascade du serveur est attachée à un ÉVÉNEMENT.
      noLastMatch: 'La compo du dernier match se retrouve depuis '
        + 'l’événement, pas depuis l’équipe.',
      noTemplate: 'Cette équipe n’a pas encore de compo type.',
    },
  },
  // C-C — ECRAN 12 du pack composition : le mur payant, en écran plein.
  compositionPaywall: {
    actions: {
      compare: 'Comparer les offres',
      subscribe: 'Passer à l’offre Équipe',
    },
    benefits: {
      autoSplit: 'Répartition automatique sur les détections',
      field: 'Terrain interactif sur les 5 sports',
      responses: 'Réponses présent / absent centralisées',
      template: 'Compo type réutilisable par équipe',
      twoTaps: 'Composition et convocations en 2 taps',
    },
    subtitle: 'Composition réservée',
    text: 'Prépare tes compos, convoque tes joueurs et suis leurs réponses '
      + '— sans quitter FOUNDCLUB.',
    title: 'Offre Équipe',
    wall: 'La composition d’équipe est réservée à l’offre Équipe.',
  },
  conversation: {
    actions: {
      copy: 'Copier',
      copySuccess: {
        description: 'Le message a été copié.',
        title: 'Copié',
      },
      copyUnavailable: 'Le presse-papiers est indisponible sur cette build.',
      delete: 'Supprimer',
      deleteConfirm: {
        description: 'Ce message sera supprimé pour tous les participants.',
        title: 'Supprimer le message',
      },
      deleteError: 'Impossible de supprimer ce message.',
      edit: 'Modifier',
      editModal: {
        addFile: 'Ajouter un fichier',
        addMedia: 'Ajouter un média',
        attachmentFallback: 'Pièce jointe',
        attachments: 'Pièces jointes',
        noAttachments: 'Aucune pièce jointe',
        placeholder: 'Modifier le texte...',
        takePhoto: 'Prendre une photo',
        title: 'Modifier le message',
      },
      modalTitle: 'Actions du message',
      reply: 'Répondre',
      report: 'Signaler',
    },
    attachments: {
      camera: 'Caméra',
      contact: 'Contact',
      createPoll: 'Créer un sondage',
      document: 'Document',
      documentDisabled: 'Indisponible sur cette build',
      event: 'Événement',
      noContact: 'Aucun contact partageable',
      photos: 'Photos',
      pickFile: 'Envoyer un fichier',
      pickMedia: 'Envoyer un média',
      poll: 'Sondage',
      subtitle: 'Partage du contenu dans cette conversation',
      takePhoto: 'Prendre une photo',
      title: 'Ajouter',
      unavailable: 'Bientôt disponible',
    },
    messagePlaceholder: 'Message',
    modals: {
      actions: {
        cancel: 'Annuler',
        report: 'Signaler le message',
        seeUser: 'Voir le profil',
      },
      reportMessage: {
        description: 'Dis-nous ce qui ne va pas. Notre équipe relira ce message.',
        fields: {
          reason: {
            label: 'Motif du signalement',
            placeholder: 'Explique en quelques mots ce qui pose problème.',
          },
        },
        title: 'Signaler ce message',
      },
      reportSuccess: {
        description: 'Merci de ton retour, nous allons traiter ta demande dans les plus brefs délais.',
        title: 'Ton signalement a bien été envoyé',
      },
    },
    poll: {
      bubble: {
        anonymousBadge: 'Sondage anonyme',
        detailsHint: 'Appuie sur une option pour voter ou modifier ton vote. '
          + 'Appuie à nouveau pour le retirer, ou ouvre la carte pour les détails.',
        questionFallback: 'Question',
        selectedBadge: 'Ton vote',
      },
      common: {
        member: 'Membre',
        vote: 'vote',
      },
      details: {
        anonymousHint: 'Ce sondage est anonyme. Les votants ne sont pas affichés.',
        anonymousVotes: 'Votes anonymes',
        createdBy: 'Créé par',
        date: 'Date',
        infoTitle: 'Informations du sondage',
        notFound: 'Ce sondage est introuvable ou a été supprimé.',
        noVotes: 'Aucun vote pour cette option.',
        syncInProgress: 'Le sondage est en cours de synchronisation.',
        syncTitle: 'Information',
        title: 'Détail du sondage',
        visibleVotes: 'Votes visibles',
        voteCount: 'Nombre de votes',
        voteHint: 'Sélectionne une option pour voter ou modifier ton vote. '
          + 'Appuie à nouveau dessus pour retirer ton vote. '
          + "Le detail des votants s'affiche quand le sondage n'est pas anonyme.",
        votesByOption: 'Votes par option',
      },
      errors: {
        chatMissing: 'Conversation introuvable.',
        createFailed: 'Impossible de créer ce sondage.',
        duplicateOptions: 'Chaque option doit être différente.',
        incomplete: 'Le sondage est incomplet.',
        minOptions: 'Ajoute au moins deux options.',
        optionAlreadyUsed: 'Cette option est déjà utilisée.',
        questionRequired: 'Ajoute une question pour ton sondage.',
        sendUnavailable: 'Connexion messagerie indisponible. Réessaie dans quelques secondes.',
        voteSave: 'Impossible de sauvegarder ce vote.',
      },
      footer: {
        mode: 'mode',
      },
      form: {
        addOption: '+ Ajouter une option',
        addOptionA11y: 'Ajouter une option',
        allowMultipleVotes: 'Autoriser plusieurs votes',
        allowMultipleVotesA11y: 'Autoriser plusieurs votes',
        allowMultipleVotesHint: 'Active cette option pour permettre à chacun de voter pour plusieurs réponses.',
        isAnonymous: 'Sondage anonyme',
        isAnonymousA11y: 'Sondage anonyme',
        isAnonymousDisabledHint: 'Les membres pourront voir qui a voté pour chaque option.',
        isAnonymousEnabledHint: 'Les votes restent anonymes pour les autres membres.',
        optionPlaceholder: 'Option {{index}}',
        optionsLabel: 'Options',
        questionLabel: 'Question',
        questionPlaceholder: 'Ex: Quel créneau te convient ?',
        removeOptionA11y: 'Supprimer l option {{index}}',
        submit: 'Envoyer le sondage',
        subtitle: 'Pose une question, ajoute des options et lance le vote.',
      },
      modes: {
        multiple: 'multiple',
        single: 'unique',
      },
      visibility: {
        anonymous: 'anonyme',
        visible: 'visible',
      },
    },
    shareContact: {
      empty: 'Aucun contact partageable dans ce chat.',
      send: 'Partager',
      title: 'Partager un contact',
    },
    shareEvent: {
      empty: 'Aucun événement disponible.',
      planningTitle: 'Événements de mon planning',
      publicEmpty: 'Aucun événement public disponible.',
      publicPickerTitle: 'Partager un événement public',
      searchPlaceholder: 'Rechercher un événement',
      sharePublicAction: 'Partager un événement public',
      title: 'Partager un événement',
    },
    shareLocation: {
      placeholder: 'Rechercher une adresse',
      send: 'Partager',
      title: 'Partager une localisation',
    },
    voice: {
      hint: 'Glisser gauche pour annuler, glisser haut pour verrouiller.',
      hintShort: 'Maintiens appuyé pour enregistrer',
      locked: 'Note vocale verrouillée',
      lockedHint: 'Enregistrement verrouillé. Touche envoyer ou annuler.',
      permissionDescription: 'Autorise le micro pour envoyer des notes vocales.',
      permissionTitle: 'Micro requis',
      recording: 'Enregistrement vocal',
      sendErrorDescription: 'Impossible d\'envoyer la note vocale. Réessaie.',
      sendErrorTitle: 'Envoi impossible',
      sending: 'Envoi en cours...',
      stopErrorDescription: 'Impossible de finaliser l\'enregistrement vocal. Réessaie.',
      unavailableDescription: 'Le module vocal n\'est pas disponible sur cette build.',
      unavailableTitle: 'Vocal indisponible',
    },
  },
  createClubRequest: {
    actions: {
      create: 'Ajouter le club',
      ok: 'OK',
    },
    alerts: {
      description: "L'équipe Found Club va examiner ta demande et te recontacter dans les plus brefs délais.",
      title: 'Ta demande de création de club a bien été envoyée',
    },
    fields: {
      clubName: {
        label: 'Nom du club',
        placeholder: 'FC Marseille',
      },
      holderFirstname: {
        label: 'Prénom du responsable',
        placeholder: 'Luc',
      },
      holderLastname: {
        label: 'Nom du responsable',
        placeholder: 'Harne',
      },
      holderPhone: {
        label: 'Numéro de téléphone du responsable',
        placeholder: '0612345678',
      },
    },
    title: 'Ajouter un club',
  },
  detection: {
    // Les 3 ecrans empruntaient `matchComposition.board.alerts.*`, dont les textes
    // disent « convocation » et « composition » — deux mots que le pack interdit
    // en detection (§6). Elle a donc ses propres alertes, et son propre mot :
    // une detection produit une REPARTITION.
    alerts: {
      error: {
        publish: 'Impossible de publier cette répartition.',
        save: 'Impossible d’enregistrer cette répartition.',
        title: 'Erreur',
      },
      ok: 'OK',
      published: {
        // ⚠️ Le mot « convocation » est interdit en détection (règle du pack §6),
        // et une détection ne passe JAMAIS par le canal d’une équipe : ses
        // candidats n’y sont pas. Chacun reçoit une notification personnelle.
        message: 'Chaque joueur est prévenu de son équipe.',
        ok: 'Voir la détection',
        title: 'Équipes publiées',
      },
      saved: {
        message: 'Les équipes sont gardées en brouillon. Personne n’a été prévenu.',
        title: 'Répartition enregistrée',
      },
    },
    squad: {
      actions: {
        manual: 'Manuel',
        next: 'Continuer',
      },
      checkIn: {
        empty: 'Personne d’inscrit à pointer pour le moment.',
        subtitle: 'Sur {{count}} inscrits, rarement {{count}} se présentent. '
          + 'Générer avant le pointage produit des équipes fausses.',
        title: 'Pointer les présents d’abord',
      },
      checkInList: {
        markAll: 'Tout pointer',
        markNone: 'Tout dépointer',
        title: 'Pointage · {{present}}/{{total}}',
      },
      intro: {
        subtitle: 'Choisis comment ils entrent dans la répartition — '
          + 'c’est ce qui change le plus le résultat.',
        title_one: '{{count}} joueur de {{teamName}} est inscrit à cette détection.',
        title_other: '{{count}} joueurs de {{teamName}} sont inscrits à cette détection.',
      },
      meta: {
        member: 'Membre de {{teamName}}',
        positionToDefine: 'Poste à définir',
        requestedPosition: 'Demande : {{position}}',
      },
      modes: {
        excluded: {
          subtitle: 'Ils ne sont pas répartis du tout. Utile quand ils encadrent la séance.',
          title: 'Les sortir de la répartition',
        },
        grouped: {
          subtitle: 'Les membres de l’équipe forment une équipe verrouillée. '
            + 'Les candidats sont répartis dans les autres.',
          title: 'Garder l’équipe groupée',
        },
        mix: {
          subtitle: 'Membres et candidats sont mélangés dans toutes les équipes.',
          title: 'Mélanger tout le monde',
        },
      },
      next: 'Ensuite',
      preview: {
        excluded: '{{candidates}} candidats répartis. '
          + 'Les {{members}} membres de {{teamName}} restent en dehors.',
        grouped: '{{members}} membres de {{teamName}} forment une équipe. '
          + 'Les {{candidates}} candidats se répartissent dans les autres.',
        mix: '{{total}} joueurs mélangés, membres et candidats confondus.',
        withCheckIn: 'Seuls les joueurs pointés à l’arrivée seront répartis.',
      },
      previewTitle: 'Aperçu',
      progress: 'Étape {{current}}/{{total}}',
      sectionTitle: 'Comment les traiter',
      subtitle: 'Détection · {{registered}} inscrits · {{members}} de {{teamName}}',
      title: 'Membres de l’équipe',
    },
    teams: {
      auto: {
        actions: {
          generate: 'Générer la répartition',
          manual: 'Manuel',
        },
        chip: 'Auto',
        perTeam: '{{registered}} inscrits · ~{{perTeam}} joueurs par équipe',
        positions: {
          candidates_one: '{{count}} candidat',
          candidates_other: '{{count}} candidats',
          missing_one: '{{count}} manquant',
          missing_other: '{{count}} manquants',
          onePerTeam: '1 par équipe',
          title: 'Postes recherchés · {{count}}',
        },
        preview: {
          empty: 'Personne à répartir : pointe d’abord les présents.',
          text: '{{teams}} équipes de ~{{perTeam}} joueurs. {{unassigned}} non affectés.',
        },
        previewTitle: 'Aperçu',
        splitBy: {
          subtitle: 'Chaque joueur est placé sur le poste '
            + 'qu’il a demandé en candidatant à la détection.',
          title: 'Séparer par poste recherché',
        },
        subtitle: 'Détection · {{sport}} · {{registered}} inscrits',
        teamCount: 'équipes',
        title: 'Répartition',
      },
      board: {
        actions: {
          publish_one: 'Publier l’équipe',
          publish_other: 'Publier les {{count}} équipes',
          rotation: 'Faire tourner',
          save: 'Enregistrer',
        },
        addTeam: '+ Équipe',
        chips: {
          placed: '{{placed}}/{{slots}} placés',
          splitByPosition: 'Par poste recherché',
          swap: 'Glisse pour échanger',
        },
        relaunch: 'Relancer',
        subtitle_one: '{{count}} équipe générée · {{sport}}',
        subtitle_other: '{{count}} équipes générées · {{sport}}',
        teamTab: '{{name}} · {{count}}',
        title: 'Détection',
        tokenOnField: '{{name}}, sur le terrain de {{team}}',
        tokenUnassigned: '{{name}}, non affecté',
        unassigned: {
          empty: 'Tout le monde a une équipe.',
          hint: 'Glisse pour placer',
          title: 'Non affectés · {{count}}',
        },
      },
      manual: {
        actions: {
          auto: 'Auto',
          field: 'Placer sur le terrain',
        },
        bibs: {
          bleu: 'Bleu',
          jaune: 'Jaune',
          rouge: 'Rouge',
          vert: 'Vert',
        },
        empty: 'Personne à répartir : pointe d’abord les présents.',
        hint: 'Appuie sur un joueur pour l’ajouter à {{bib}}. Appuie encore pour le retirer.',
        remaining_one: '{{count}} restant',
        remaining_other: '{{count}} restants',
        subtitle: 'Détection · {{count}} présents',
        title: 'Équipes à la main',
        unassigned: 'Non affectés · {{count}}',
      },
      rotation: {
        actions: {
          nextRound: 'Lancer la manche {{count}}',
          teams_one: 'Voir l’équipe',
          teams_other: 'Voir les {{count}} équipes',
        },
        bib: 'Chasuble {{bib}}',
        chips: {
          onField: '{{count}} sur le terrain',
          round: 'Manche {{current}} / {{total}}',
        },
        // Le pack veut « qui n’a pas assez joué » lisible d’un coup d’œil :
        // c’est la raison d’être d’une détection, chaque joueur doit avoir eu
        // sa chance.
        lowPlaytime: '{{name}} n’a joué que {{count}} minutes',
        playtime: '{{count}} min',
        rotationBand: {
          empty: 'Toute l’équipe est sur le terrain.',
          hint: 'Temps de jeu cumulé',
          title: 'Rotation · {{count}}',
        },
        subtitle: 'Détection · {{sport}}',
        subtitleWithField: 'Détection · {{sport}} · {{field}}',
        title: 'Équipe {{bib}}',
        tokenInRotation: '{{name}}, en rotation, {{count}} minutes de jeu',
        tokenOnField: '{{name}}, sur le terrain, {{count}} minutes de jeu',
      },
    },
  },
  errorPage: {
    action: 'Recharger la page',
    subtitle: 'Une erreur est survenue.',
    title: 'Oups !',
  },
  event: {
    shareChatAccessibilityHint: 'Partager l’événement dans cette conversation',
    shareChatCardHint: 'Partage direct FoundClub',
    shareChatType: {
      club: 'Club',
      group: 'Groupe',
      multisport: 'Omnisport',
      team: 'Équipe',
      whisper: 'Privé',
    },
    sharedEvent: 'Événement partagé',
    shareEyebrow: 'Diffusion',
    shareInChat: 'Partager dans une conversation',
    shareInChatHint: 'Envoi direct dans FoundClub.',
    shareNoChatAvailable: 'Aucune conv disponible.',
    shareNoChatAvailableHint: 'Rejoins ou crée une conversation pour partager cet événement ici.',
    shareOutsideHint: 'SMS, mail ou application externe',
    shareOutsideLabel: 'Lien externe',
    shareSubtitle: 'Choisis un canal pour envoyer cette fiche rapidement.',
  },
  eventDetails: {
    actions: {
      accept: 'Accepter',
      cancelEvent: 'Annuler l\'événement',
      cancelResponse: 'Annuler ma participation',
      edit: 'Modifier l\'événement',
      editResponse: 'Modifier ma réponse',
      join: 'Participer',
      refuse: 'Refuser',
      remind: 'Relancer',
    },
    attendanceActions: {
      edit: 'Modifier',
      late: 'En retard',
      onTime: "À l'heure",
    },
    attendanceBadge: {
      arrived: 'Arrivé',
      declaredLate: 'Retard annoncé',
      notMarked: 'Non pointé',
      saidYes: 'A dit présent',
      selfArrived: 'Je suis arrivé·e',
      toMark: 'À pointer',
    },
    attendanceCall: {
      actions: {
        markAll: 'Tout pointer',
        unmarkAll: 'Tout dépointer',
      },
      answers: {
        no: 'Absent·e·s',
        none: 'Sans réponse',
        yes: 'Présent·e·s',
      },
      before: {
        alreadySignalled: 'DÉJÀ SIGNALÉ',
        expected: 'attendus',
        explain: "L'appel devient disponible 30 minutes avant le début,"
          + ' et reste ouvert 2 h après la fin.',
        opensAt: 'Ouvre à',
        title: "Faire l'appel",
      },
      bulk: {
        allMarked: 'Tout le monde est pointé.',
        allRefused: "Personne n'a été pointé : le serveur a refusé pour la même raison.",
        partial: 'pointé·e·s, le reste a été refusé.',
        windowClosed: "Personne n'a été pointé : l'appel n'est pas ouvert en ce moment.",
      },
      close: {
        arrivedLate: 'Arrivé·e·s en retard',
        confirm: 'Clôturer',
        confirmLabel: "Clôturer l'appel maintenant",
        keepGoing: "Continuer l'appel",
        marked: 'pointés',
        neverSeen: 'jamais vus',
        serverWill: 'Le serveur les passera en « Non pointé » après la fin du match, vers',
        stillCorrect: "Tu pourras encore corriger jusqu'à",
        title: "CLÔTURER L'APPEL",
      },
      closed: {
        explain: "L'appel est clos. Il restait ouvert jusqu'à 2 h après la fin du match.",
        since: 'Fermé depuis',
      },
      correct: {
        changeTime: "Changer l'heure d'arrivée",
        clearNote: 'Annuler la note du staff',
        close: 'Fermer',
        unmark: 'Dépointer — remettre en attente',
      },
      errors: {
        generic: "Impossible d'enregistrer le pointage. Réessaie dans un instant.",
        windowClosed: "L'appel n'est pas ouvert en ce moment."
          + " Il s'ouvre 30 minutes avant le début et se ferme 2 h après la fin.",
      },
      footer: {
        close: "Clôturer l'appel",
        markSomeone: 'Pointe au moins une personne',
        outOf: 'sur',
      },
      header: {
        markedOf: 'pointé sur',
        open: 'Ouvert',
        title: 'APPEL',
      },
      late: {
        cancel: 'Fermer',
        custom: 'Autre heure',
        customPlaceholder: "Heure d'arrivée (HH:MM)",
        note: 'Note du staff (optionnel)',
        onTime: "À l'heure",
        onTimePreview: "Arrivé à l'heure",
        preview: 'Arrivé',
        previewAt: 'à',
        submit: 'Enregistrer',
        title: 'RETARD CONSTATÉ',
      },
      markedSection: 'DÉJÀ POINTÉS',
      presence: {
        arrived: 'Arrivé·e·s',
        late: 'En retard',
        waiting: 'En attente',
      },
      row: {
        anonymous: 'Participant·e',
        arrived: 'Arrivé',
        arrivedLate: 'Arrivé',
        correct: 'Corriger',
        declaredLate: 'Retard annoncé',
        lateFor: 'Retard pour',
        markedByYou: 'Pointé par toi à',
        markHere: 'Là',
        noAnswer: 'Sans réponse',
        noShow: 'Non pointé',
        saidNo: 'a dit absent',
        saidYes: 'a dit présent',
      },
      tabs: {
        expected: 'Attendus',
        unanswered: 'Sans réponse',
      },
      unanswered: {
        explain: 'Si tu les pointes, ils passent en Présent·e et Arrivé·e en même temps.',
        title: "Ils n'ont jamais répondu",
      },
    },
    compoReminder: {
      action: 'Préparer la convocation',
      draftAction: 'Reprendre le brouillon',
      draftTitle: 'Ta convocation est commencée',
      offerTitle: 'La convocation est incluse dans l’offre Équipe',
      title: 'Ce match n’a pas encore de convocation',
    },
    compositionSource: {
      defaultComposition: 'Composition type',
    },
    convocation: {
      bench: 'Sur le banc',
      starters: 'Sur le terrain',
    },
    detection: {
      candidateAccept: 'Accepter',
      candidateAppliedFor: 'A postulé au poste : {{position}}',
      candidateDecline: 'Refuser',
      candidateFallbackName: 'Candidat·e',
      candidateInvite: 'Inviter dans l’équipe',
      candidateInviteSoon: 'L’invitation arrive bientôt.',
      candidateNoPosition: 'Inscription hors annonce, sans poste',
      candidateReviewEmpty: 'Pas encore de retour du staff.',
      candidateReviewError: 'Impossible de lire le retour pour le moment.',
      candidateReviewLoading: 'Chargement du retour…',
      candidateReviewTitle: 'Retour individuel',
      candidateReviewUnavailable: 'Le retour individuel n’existe que pour les candidatures'
        + ' passées par une annonce.',
      candidateStatusAccepted: 'Retenu·e sur ce poste',
      candidateStatusDeclined: 'Refusé·e',
      candidateStatusPending: 'Demande à traiter',
      candidateStatusTitle: 'Statut',
      candidateStatusUnknown: 'Inscrit·e à la séance',
      groupParticipants: 'Participants retenus',
      groupPending: 'Demandes à traiter',
      noParticipantYet: 'Personne n’est encore retenu·e sur ce poste.',
      noPositionGroup: 'Sans poste précisé',
      noSlots: 'Aucun poste recherché',
      noSlotsHint: 'La séance est ouverte à tous les profils',
      noSpecificPositionAction: 'Participer sans poste',
      noSpecificPositionHint: 'Tu rejoins la séance sans viser un poste en particulier.'
        + ' Le staff te placera sur place.',
      noSpecificPositionTitle: 'Sans poste précis',
      positionFilled: '{{accepted}}/{{quantity}} retenu·e·s',
      slotsTitle: 'Postes recherchés',
      tileApplication: 'candidature à voir',
      tileApplications: 'candidatures à voir',
      tileOpenPosition: 'poste ouvert',
      tileOpenPositions: 'postes ouverts',
    },
    detectionSplit: {
      blockedUntilSplit: 'Génère d’abord la répartition, à l’étape 2.',
      generate: 'Générer la répartition',
      openBoard: 'Placer sur le terrain',
      openRotation: 'Faire tourner',
      staffOnlyHint: 'Le staff répartit les candidats en équipes et gère leur temps de jeu.',
      staffOnlyTitle: 'Réservé au staff de la séance',
      stepAttendance: 'Pointer les présent·e·s',
      stepAttendanceCount: '{{pointed}} pointé·e·s sur {{total}}',
      stepAttendanceEmpty: 'Aucun candidat inscrit pour l’instant',
      stepBoard: 'Placer sur le terrain',
      stepBoardHint: 'Après la répartition',
      stepDone: 'Fait',
      stepRotation: 'Faire tourner',
      stepRotationHint: 'Temps de jeu par joueur · plancher 5 min',
      stepSplit: 'Répartir en équipes',
      stepSplitDone: 'Réparti·e·s en {{count}} équipes',
      stepSplitHint: 'Séparer par poste recherché',
      title: 'LE CHEMIN COMPLET',
    },
    emptyStates: {
      allAnswered: 'Tout le monde a répondu.',
      noAbsence: 'Aucune absence signalée.',
      noConfirmation: 'Personne n\'a encore confirmé sa présence.',
    },
    export: {
      cancel: 'Annuler',
      columns: {
        email: 'E-mail',
        firstname: 'Prénom',
        lastname: 'Nom',
        phone: 'Téléphone',
        position: 'Poste',
        scope: 'Portée',
        status: 'Statut',
        team: 'Équipe',
      },
      columnsTitle: 'Ce que le fichier contient',
      confirm: 'Télécharger le fichier',
      count: 'Le fichier contiendra {{count}} personnes.',
      personalDataWarning: 'Ce fichier contient des données personnelles',
      removeContacts: 'Retirer e-mails et téléphones',
      title: 'Exporter la liste',
    },
    exportError: 'Impossible de sortir la liste des participants.',
    exporting: 'Nous préparons la liste des participants...',
    exportSuccess: 'La liste des participants est téléchargée.',
    featuredRequest: {
      alreadyFeatured: 'Déjà à la une',
      available: 'Disponible',
      error: 'Impossible d’envoyer la demande de mise à la une.',
      rejected: 'Refusée, tu peux redemander',
    },
    fields: {
      description: 'Description',
      participationRequests: 'Demandes de participation',
      participations: 'Participants',
    },
    header: {
      invitedTeams: 'Équipes invitées',
      tournamentFallback: 'Tournoi',
    },
    invitedTeams: {
      externalBadge: 'Ouvert à tous',
      externalHistoricalTitle: 'Historique participants externes',
      historicalPending: '{{count}} réponse(s) en attente',
      historicalTitle: 'Historique équipe retirée',
      homeTeamBadge: 'Équipe organisatrice',
      invitedTeamBadge: 'équipe invitée',
    },
    managePanel: {
      campaignAlreadyLinked: 'Cet événement a déjà une cotisation',
      cancel: 'Annuler',
      closeTraining: 'Fermer l\'entraînement',
      edit: 'Modifier',
      feature: 'À la une',
      lineup: 'Convocation',
      lineupDetection: 'Répartition',
      openTraining: 'Ouvrir l\'entraînement',
      title: 'Gérer l\'événement',
      tournamentSettings: 'Réglages tournoi',
    },
    matchCard: {
      nameOpponent: 'Nommer l\'adversaire',
      nameOpponentHint: 'Il apparaîtra sur la carte du match, face à ton club.',
      opponentPlaceholder: 'Nom de l\'équipe adverse',
      opponentToConfirm: 'Adversaire à confirmer',
      saveOpponentFailed: 'Impossible d\'enregistrer le nom de l\'adversaire pour le moment.',
      verdict: {
        draw: 'Nul',
        loss: 'Défaite',
        win: 'Victoire',
      },
    },
    menu: {
      campaign: 'Créer la cotisation de cet événement',
      cancel: 'Prévenir les participant·e·s et annuler',
      detectionTeamsBoard: 'Les terrains de la détection',
      edit: 'Date, lieu, description',
      feature: 'Proposer cet événement à la une',
      lineup: 'Choisir et convoquer les joueur·se·s',
      lineupDetection: 'Répartir les joueur·se·s sur les terrains',
      poster: 'Voir et partager l’affiche',
      tournamentSettings: 'Format, équipes et terrains',
      trainingVisibility: 'Accueillir des joueur·se·s de l’extérieur',
    },
    modals: {
      accept: {
        title: 'Es-tu sûr·e de vouloir accepter cette demande ?',
      },
      actions: {
        cancel: 'Annuler',
        confirm: 'Confirmer',
        report: 'Signaler',
      },
      cancelEvent: {
        description: 'Une fois annulé, l\'événement ne sera plus visible par les participant·e·s.',
        title: 'Es-tu sûr·e de vouloir annuler cet événement ?',
      },
      declareMissing: {
        description: 'Tu ne seras plus compté·e présent·e : tu passeras chez les absent·e·s.'
          + ' Tu pourras revenir sur ta réponse.',
        title: 'Me déclarer absent·e',
      },
      deleteParticipation: {
        actions: {
          cancel: 'Non, retour',
          confirm: 'Oui, annuler',
        },
        description: 'Es-tu sûr·e de vouloir annuler ta participation à cet événement ?',
        title: 'Annuler ma participation',
      },
      editResponse: {
        description: "En modifiant ta réponse tu indiques ta participation à l'événement",
        title: 'Modifier ma réponse',
      },
      recurrenceCancel: {
        actions: {
          all: 'Tous les événements',
          future: 'Cet événement et les suivants',
          thisEvent: 'Cet événement',
        },
        description: 'Cet événement fait partie d\'une série. Que veux-tu annuler ?',
        title: 'Annulation d un événement récurrent',
      },
      refuse: {
        fields: {
          reason: {
            label: 'Raison du refus',
            optionalHint: 'Ce champ est optionnel.',
            placeholder: 'Il faut avoir plus de 16 ans.',
          },
        },
        title: 'Es-tu sûr·e de vouloir refuser cette demande ?',
      },
      remindSuccess: {
        description: 'Les joueur·se·s vont recevoir une notification pour leur rappeler de répondre à l\'événement.',
        title: 'Ton relance a bien été envoyée',
      },
      reportEvent: {
        description: 'Merci de nous indiquer la raison pour laquelle tu signales cet événement.',
        fields: {
          reason: {
            label: 'Raison du signalement',
            placeholder: 'Cet événement est inapproprié.',
          },
        },
        title: 'Signaler un événement',
      },
      reportSuccess: {
        description: 'Merci de ton retour, nous allons traiter ta demande dans les plus brefs délais.',
        title: 'Ton signalement a bien été envoyé',
      },
    },
    nextAction: {
      action: 'Faire l’appel',
      done: 'Appel terminé',
      expectedOne: '{{count}} attendu',
      expectedOther: '{{count}} attendus',
      opensAt: 'Ouvre à {{time}}',
      opensSoon: 'Pas encore ouvert',
      title: 'Faire l’appel',
      window: 'L’appel devient disponible 30 minutes avant le début, '
        + 'et reste ouvert 2 h après la fin.',
    },
    openTraining: {
      cardClosedMeaning: 'Réservé à ton équipe : personne de l’extérieur ne peut s’inscrire.',
      cardClosedTitle: 'Entraînement privé',
      cardOpenMeaning: 'Ouvert aux joueur·se·s de l’extérieur, en plus de ton équipe.',
      cardOpenTitle: 'Entraînement ouvert',
      goToExternals: 'Voir les participants externes',
      goToPending: 'Voir les demandes',
      pendingSuffix: '{{pending}} demande(s) à vérifier',
      publicLine: 'Accueille {{quota}} joueur·se·s de l’extérieur · {{taken}} place(s) prise(s)',
      seatsLeft: '{{left}} place(s) externe(s) restante(s) sur {{quota}}',
      validationAuto: 'Validation automatique : les demandes sont acceptées toutes seules.',
      validationManual: 'Validation manuelle : c’est toi qui acceptes chaque demande.',
    },
    participantsFilter: {
      absent: 'Absents',
      all: 'Tous',
      empty: 'Personne dans ce groupe',
      notAnswered: 'Sans réponse',
      present: 'Présents',
    },
    participantsPayment: {
      manualReview: 'À valider',
      overdue: 'En retard',
      paid: 'Payée',
      partial: 'Partiel',
      pending: 'En attente',
      waived: 'Exemptée',
    },
    participantsSearch: {
      noResult: 'Aucun nom ne correspond',
      placeholder: 'Chercher un nom',
    },
    participantsSummary: {
      nextReminder: 'Prochaine relance possible le {{date}}',
      responses: '{{received}} réponses sur {{total}}',
    },
    participationStatus: {
      missing: 'Absent·e·s',
      notAnswered: 'Sans réponse',
      participating: 'Présent·e·s',
    },
    participationSuccess: 'Ta participation est enregistrée.',
    postMatch: {
      actionDone: 'Voir les stats du match',
      actionResponses: 'Voir les retours',
      actionReview: 'Mettre à jour',
      actionScore: 'Enregistrer le score',
      actionStats: 'Saisir les stats',
      complete: 'C’est complet',
      header: 'APRÈS LE MATCH',
      responsesCount: '{{received}} sur {{total}} ont répondu',
      responsesNone: 'Personne n’a encore répondu',
      responsesTitle: 'Retours des joueurs',
      scoreManual: 'saisi à la main',
      scoreOfficial: 'score officiel',
      scoreRecordedBy: 'saisi par {{name}} à {{time}}',
      scoreRecordedByMe: 'saisi par toi à {{time}}',
      scoreTitle: 'Score',
      scoreTodo: 'À enregistrer',
      statsSubtitle: 'Buteurs, passeurs, temps de jeu',
      statsTitle: 'Statistiques de l’équipe',
      step: 'Étape {{n}} sur 3',
    },
    remindSheet: {
      antiSpamHint: 'Une personne relancée il y a moins de 48 h ne recevra rien de plus.',
      close: 'Fermer',
      confirm: 'Relancer {{count}} personne·s',
      failedBody: 'Personne n’a été prévenu : réessaie dans un instant.',
      failedTitle: 'La relance n’a pas pu partir',
      indicative: 'Chiffre indicatif : le serveur écarte les personnes déjà relancées.',
      nobody: 'Tout le monde a répondu : il n’y a personne à relancer.',
      teamCount: '{{count}} sans réponse',
      teamFailed: 'échec',
      teamReminded: '{{count}} relancé·e·s',
      title: 'Relancer les sans-réponse',
      unnamedTeam: 'Équipe',
    },
    stage: {
      day: 'Jour',
      hours: 'Horaires',
      hoursEmpty: 'Variables',
      legend: 'présent·e·s · absent·e·s · sans réponse',
      mainPlace: 'Lieu principal',
      noDays: 'Aucune journée de stage n’est encore disponible.',
      period: 'Période',
      periodEmpty: 'Non renseignée',
      placeEmpty: 'À définir',
      today: 'AUJOURD’HUI',
    },
    stageLicense: {
      allPaid: 'Tout le monde a réglé sa cotisation.',
      body: 'Sur {{total}} inscrit·e·s, {{unpaid}} n’ont pas réglé les {{amount}} du stage',
      collected: '{{paid}} reçus sur {{expected}} attendus',
      confirmBody: 'Envoyer une relance aux cotisations en attente, partielles ou en retard ?',
      confirmSend: 'Envoyer',
      confirmTitle: 'Relancer les impayés',
      errorBody: 'Rien n’a été envoyé.',
      errorTitle: 'Relance impossible',
      generate: 'Mettre à jour les affectations',
      inactive: 'La campagne n’est pas active : aucune relance ne peut partir.',
      kicker: 'PROCHAINE ACTION',
      remind: 'Relancer {{count}} impayés',
      sentBody: 'Les impayés ont reçu un rappel.',
      sentTitle: 'Relances envoyées',
      title: 'Relancer {{count}} impayés',
      withoutAssignment: '{{count}} inscrit·e·s sans cotisation',
    },
    tabs: {
      callUp: 'Convocation',
      detectionCandidates: 'Candidats',
      detectionSplit: 'Répartition',
      overview: 'Aperçu',
      people: 'Personnes',
      stageDays: 'Jours',
      teams: 'Équipes',
    },
    tournamentPeople: {
      absent: 'Absent·e',
      awaiting: '{{count}} invitation·s ou demande·s en attente',
      empty: 'Aucune personne inscrite pour l’instant.',
      lockedHint: 'Tu retrouves ton équipe et ses joueurs depuis le bouton du bas.',
      lockedTitle: 'Réservé à l’organisation',
      pending: 'Sans réponse',
      present: 'Présent·e',
    },
    tournamentRail: {
      groups: 'Poules',
      matches: 'Matchs',
      published: 'Publié',
      settings: 'Réglages',
      teams: 'Équipes',
      title: 'OÙ EN EST LE TOURNOI',
    },
    tournamentTeams: {
      accepted: 'INSCRITE',
      archived: 'ARCHIVÉE',
      declined: 'REFUSÉE',
      lead: 'Référent·e : {{name}}',
      pending: 'À VÉRIFIER',
    },
    typeTag: {
      capacity: '{{taken}}/{{total}} PLACES',
      matchAway: 'À L\'EXTÉRIEUR',
      matchFinished: 'TERMINÉ',
      matchHome: 'À DOMICILE',
    },
  },
  eventEdit: {
    actions: {
      save: 'Enregistrer',
    },
    fields: {
      capacity: {
        label: 'Nombre de participant·e·s',
        placeholder: 'Illimité',
      },
      club: {
        label: 'Club',
        placeholder: 'Sélectionner un club',
      },
      date: {
        label: "Date de l'événement",
        placeholder: 'JJ/MM/AAAA',
      },
      description: {
        label: 'Description',
        placeholder: 'Événement de détection ouvert à tous·tes les joueur·se·s.',
      },
      endTime: {
        label: 'Heure de fin',
        placeholder: 'HH:mm',
      },
      invitedTeams: {
        label: 'Inviter des équipes',
        myTeams: 'MES ÉQUIPES',
        otherTeams: 'AUTRES ÉQUIPES',
        placeholder: 'Sélectionner des équipes',
      },
      isRecurrent: {
        label: 'Événement récurrent',
      },
      location: {
        label: 'Lieu',
        placeholder: '2 rue du stade, 69000 Lyon',
      },
      pricePerPerson: {
        label: 'Prix par personne (€)',
        placeholder: 'Ex: 10',
      },
      recurrenceDay: {
        label: 'Jour de la récurrence',
      },
      recurrenceEndDate: {
        label: 'Date de fin de la récurrence',
        placeholder: 'JJ/MM/AAAA',
      },
      recurrenceFrequency: {
        label: 'Fréquence de la récurrence',
        options: {
          month: 'Mensuel',
          week: 'Hebdomadaire',
        },
      },
      recurrenceStartDate: {
        label: 'Date de début de la récurrence',
        placeholder: 'JJ/MM/AAAA',
      },
      sessionStatus: {
        label: "Visibilité de l'événement",
        options: {
          closed: 'Privé',
          open: 'Public',
        },
      },
      startTime: {
        label: 'Heure de début',
        placeholder: 'HH:mm',
      },
      team: {
        label: 'Équipe',
        placeholder: 'Sélectionner une équipe',
      },
      time: {
        label: "Horaire de l'événement",
        placeholder: 'JJ/MM/AAAA',
      },
      totalPlayers: {
        label: 'Nombre total de joueurs',
        placeholder: 'Ex: 10',
      },
      type: {
        label: 'Type d\'événement',
        placeholder: 'Sélectionner un type d\'événement',
      },
      validationMode: {
        label: 'Mode de validation',
        options: {
          auto: 'Automatique',
          manual: 'Manuelle',
        },
      },
    },
    title: 'Créer un événement',
    titleEdit: 'Modifier l\'événement',
  },

  eventFilters: {
    actions: {
      apply: 'Appliquer les filtres',
      clear: 'Effacer les filtres',
    },
    fields: {
      activity: {
        label: 'Sport',
        placeholder: 'Sélectionner un sport',
      },
      category: {
        label: 'Catégorie',
        placeholder: 'Sélectionner une catégorie',
      },
      club: {
        label: 'Club',
        placeholder: 'Sélectionner un club',
      },
      date: {
        label: 'Date',
        placeholder: 'Sélectionner une date',
      },
      level: {
        label: 'Niveau',
        placeholder: 'Sélectionner un niveau',
      },
      sessionStatus: {
        label: 'Statut de la session',
        options: {
          closed: 'Fermé',
          open: 'Ouvert',
        },
        placeholder: 'Sélectionner un statut',
      },
      team: {
        label: 'Équipe',
        placeholder: 'Sélectionner une équipe',
        selectClubFirst: 'Sélectionner un club avant l\'équipe',
      },
      type: {
        label: 'Type d\'événement',
        placeholder: 'Sélectionner un type d\'événement',
      },
    },
    infos: {
      activity: 'Le sport pratiqué par l\'équipe (football, basketball, handball, etc.).\n\nFiltrer par sport te permet de ne voir que les événements correspondant à ton discipline.',
      category: 'La catégorie d\'âge de l\'équipe (U7, U9, U11, U13, Senior, etc.).\n\nTu peux sélectionner plusieurs catégories pour voir tous les événements correspondants.',
      level: 'Le niveau de jeu de l\'équipe (Départemental, Régional, National, etc.).\n\nCe filtre t\'aide à trouver des événements adaptés à ton niveau de pratique.',
      type: 'Le type d\'événement (Entraînement, Match, Détection, Tournoi, etc.).\n\nSélectionne plusieurs types pour voir différentes activités.',
    },
  },
  eventList: {
    actions: {
      about: 'À propos',
      absent: 'Absent·e',
      add: 'Ajouter un événement',
      findEvent: 'Trouver un événement',
      join: 'Participer',
      present: 'Présent·e',
    },
    featured: 'À la une :',
    info: {
      alreadyJoined: 'Je participe !',
      alreadyMissing: 'Je serai absent·e',
      declinedRequest: 'Demande refusée',
      eventFull: 'Cet événement est complet.',
      pendingRequest: 'Demande en attente',
      restrictedEvent: 'Accès réservé',
      staffDoesNotRsvp: 'Tu encadres cet événement : ce sont les joueurs qui répondent.',
    },
    joinModal: {
      actions: {
        cancel: 'Annuler',
        confirm: 'Confirmer ma participation',
      },
      checkboxes: {
        conditions: "J'accepte les conditions pour participer à l'événement",
        responsibility: 'Je déclare avoir pris connaissance de la "Déclaration de responsabilité et acceptation des risques"',
      },
      description: 'Je soussigné(e), participant majeur ou, le cas échéant, représentant légal du participant mineur, reconnais et accepte ce qui suit :'
        + '\n\nRôle de Found Club : '
        + '\n    - Found Club est une plateforme de mise en relation et n\'organise pas l\'événement. Found Club ne fournit aucune assurance liée à la participation.'
        + '\n\nTrajets aller/retour :'
        + '\n    - Sauf transport expressément organisé par l\'organisateur, le trajet vers et depuis l\'événement est sous ma responsabilité (ou celle du représentant légal pour un mineur), y compris assurance et choix du mode de transport.'
        + '\n\nAssurance :'
        + '\n    - J\'atteste disposer (ou, pour un mineur, que l\'enfant dispose) d\'une couverture d\'assurance appropriée (ex. licence fédérale en cours et/ou responsabilité civile). J\'ai compris que Found Club n\'assure ni les dommages corporels ni matériels.'
        + '\n\nAptitude médicale :'
        + '\nJ\'atteste être apte à la pratique au jour de l\'événement (ou que l\'enfant est apte, conformément aux exigences fédérales : certificat/questionnaire le cas échéant) et je m\'engage à ne pas participer / ne pas autoriser la participation en cas de doute sur l\'état de santé.'
        + '\n\nLimites de responsabilité (droit FR) :'
        + '\nDans la mesure permise par la loi, je m\'engage à ne pas rechercher la responsabilité de Found Club du fait de la participation ; cette clause ne s\'applique pas en cas de faute lourde ou intentionnelle ou de manquement grave aux obligations de sécurité imputable à Found Club ou à l\'organisateur.'
        + '\n\nRèglement & sécurité :'
        + '\nJe m\'engage (ou j\'engage le mineur) à respecter le règlement, les consignes de sécurité et les instructions des encadrants ; l\'organisateur peut refuser ou interrompre la participation en cas de non-respect.'
        + '\n\nUrgence médicale :'
        + '\nJ\'autorise l\'organisateur à prévenir les secours en cas d\'urgence ; pour un mineur, j\'autorise l\'organisateur à accompagner l\'enfant si nécessaire et je m\'engage à rester joignable.',
      title: 'DÉCLARATION DE RESPONSABILITÉ ET ACCEPTATION DES RISQUES',
      validation: 'En cochant les cases et en validant mon inscription, je confirme avoir lu, compris et accepté la présente déclaration et j\'accepte de participer à l\'événement dans ces conditions.',
    },
    loadingDesc: 'Nous chargeons les événements correspondant à ta recherche.',
    loadingTitle: 'Chargement des événements',
    loadingUpdating: 'Actualisation des événements...',
    noData: 'Aucun événement trouvé.',
    title: 'Mes événements',
  },
  eventWizard: {
    common: {
      stepCounter: 'Étape {{current}}/{{total}}',
    },
    errors: {
      datePast: "La date ou l'heure de début doit être dans le futur.",
      genericCreate: "Erreur de création d'événement.",
      invalidTimeRange: "L'heure de fin doit être après l'heure de début.",
      invitesFetch: 'Impossible de charger les équipes à inviter.',
      locationRequired: 'Un lieu est requis.',
      noOtherTeams: 'Aucune autre équipe disponible à inviter.',
      noTeams: 'Aucune équipe organisatrice disponible.',
      noTypes: "Aucun type d'événement disponible.",
      recurrenceDatesRequired: 'Les dates de récurrence sont obligatoires.',
      recurrenceDaysRequired: 'Sélectionne au moins un jour de récurrence.',
      recurrenceInvalidRange: 'La date de fin de récurrence doit être après la date de début.',
      slotConflict: 'Conflit de créneau détecté pour le lieu sélectionné.',
    },
    partial: {
      actions: {
        keep: 'Conserver les créations',
        retry: 'Réessayer les échecs',
        rollback: 'Annuler les créations',
      },
      noCreated: "Aucun événement n'a été créé.",
      rollbackPartial: "{{count}} annulation(s) n'ont pas pu être finalisées.",
      rollbackSuccess: 'Les événements créés ont été annulés.',
      summary: '{{success}} succès / {{failed}} échec(s).',
      title: 'Création partielle détectée',
    },
    recap: {
      actions: {
        create: 'Créer les événements',
        createShort: 'Créer',
        edit: 'Modifier',
      },
      capacity: 'Participants max: {{value}}',
      completedCount: '{{done}}/5 infos clés complétées',
      dateLabel: 'Date',
      incomplete: 'à compléter',
      invitedTeamsTitle: 'équipes invitées',
      invitesCount: '{{count}} équipe(s) invitée(s)',
      noDescription: 'Aucune description',
      notSet: 'Non renseigné',
      organizationTitle: 'Organisation',
      participationTitle: 'Participation',
      pricePerPerson: 'Prix par personne: {{value}}',
      quickOverviewTitle: 'Vue d\'ensemble',
      ready: 'Prêt à créer',
      recurrenceCount: '{{count}} occurrence(s) prévues',
      reservationMode: 'Mode de réservation: {{value}}',
      sections: {
        description: 'Description',
        location: 'Lieu',
        logistics: 'Logistique',
        participants: 'Participants',
        reservation: 'Réservation',
        team: 'Équipe',
        type: 'Type',
        validation: 'Validation',
        visibility: 'Visibilité',
      },
      timeLabel: 'Horaire',
      totalPlayers: 'Joueurs attendus: {{value}}',
      totalPlayersTitle: 'Joueurs attendus',
      validationMode: 'Validation: {{value}}',
      whenWhereTitle: 'Quand et lieu',
    },
    steps: {
      description: {
        label: 'Description',
        placeholder: 'Ajoute des détails utiles pour les participants.',
        subtitle: 'Ajoute un contexte clair pour cet événement.',
        title: 'Description',
      },
      invites: {
        myTeams: 'MES ÉQUIPES',
        otherTeams: 'AUTRES ÉQUIPES',
        subtitle: 'Invite des équipes, ou passe cette étape.',
        title: 'Invitations',
      },
      location: {
        addInstallation: 'Ajouter une installation',
        addressMissing: 'Adresse non renseignée',
        helper: 'Sélectionne un lieu du club ou saisis une adresse externe.',
        installationHelper: 'Choisis une installation existante de ton club.',
        noInstallations: 'Aucune installation disponible pour ce club.',
        subtitle: 'Le lieu est obligatoire pour continuer.',
        title: 'Lieu',
      },
      logistics: {
        isRecurrent: 'Événement récurrent',
        recurrenceDays: 'Jours de récurrence',
        recurrenceInterval: 'Intervalle de récurrence',
        recurrenceIntervalDecrement: "Réduire l'intervalle de récurrence",
        recurrenceIntervalIncrement: "Augmenter l'intervalle de récurrence",
        recurrenceIntervalMonthlyMany: 'Tous les {{count}} mois',
        recurrenceIntervalMonthlyOne: 'Tous les mois',
        recurrenceIntervalWeeklyMany: 'Toutes les {{count}} semaines',
        recurrenceIntervalWeeklyOne: 'Toutes les semaines',
        recurrenceTitle: 'Configuration récurrence',
        reservationMode: 'Mode de réservation',
        reservationTitle: 'Paramêtres réservation',
        subtitle: "Configure date, horaires et règles d'accès.",
        title: 'Logistique',
      },
      // Y02 — l'etape « Contre qui ? » du tunnel, posee uniquement pour un match.
      // Idee d'Adel du 2026-08-19 : l'evenement doit s'appeler « Match vs X ».
      opponent: {
        hint: 'Tu ne le connais pas encore ? Passe cette étape, tu pourras l’ajouter plus tard.',
        placeholder: 'Ex. : US Blaisoise U15',
        subtitle: 'Le match s’appellera « Match vs » suivi de ce nom.',
        title: 'Contre qui ?',
      },
      participants: {
        fixed: 'Capacité fixe',
        hint: 'Tu pourras encore modifier ces valeurs avant la création finale.',
        modeHintFixed: 'Mode capacité fixe: nombre de places limite.',
        modeHintUnlimited: 'Mode illimité: aucun plafond de participants.',
        modeLabel: 'Mode de capacité',
        playersUnit: 'joueurs max',
        previewCapacity: 'Capacité: {{value}}',
        previewMode: 'Mode: {{value}}',
        previewTitle: 'Aperçu',
        previewTotalPlayers: 'Joueurs attendus: {{value}}',
        quickPresets: 'Valeurs rapides',
        subtitle: 'Choisis une capacité max, ou laisse l événement en accès illimité.',
        summaryTitle: 'Résumé',
        title: 'Participants',
        totalPlayersExceedsCapacity: 'Le nombre de joueurs attendus ne peut pas dépasser la capacité max.',
        unlimited: 'Illimité',
        unlimitedHint: 'Aucune limite de places',
        unlimitedLabel: 'Illimité',
      },
      recap: {
        subtitle: 'Vérifie les informations avant création.',
        title: 'Récapitulatif',
      },
      team: {
        createTeamCta: 'Créer une équipe',
        createTeamHint: "Crée d'abord ton équipe, puis reviens créer ton événement.",
        subtitle: "Sélectionne l'équipe organisatrice.",
        title: 'Équipe organisatrice',
      },
      type: {
        subtitle: "Sélectionne le type d'événement.",
        title: "Type d'événement",
      },
      validation: {
        autoDesc: 'Les participants peuvent confirmer automatiquement leur présence.',
        autoRuleOne: 'Check-in simplifié pour les joueurs',
        autoRuleTwo: 'Idéal pour les sessions ouvertes',
        manualDesc: 'Le coach valide manuellement les participants.',
        manualRuleOne: 'Contrôle total par le staff',
        manualRuleTwo: 'Recommandé pour les groupes fermés',
        optionLabel: 'Mode {{title}}',
        previewTitle: 'Mode sélectionné',
        recommended: 'Recommandé',
        selectedHint: 'Mode actuellement sélectionné.',
        selectHint: 'Sélectionne ce mode de validation.',
        subtitle: "Définis comment valider les présences à l'événement.",
        title: 'Mode de validation',
      },
      visibility: {
        public: 'Public',
        publicDesc: 'Visible pour tous les profils qui y ont accès.',
        subtitle: "Définis qui peut voir l'événement.",
        team: 'Équipe',
        teamDesc: "Visibilité uniquement pour les membres de l'équipe créatrice de l'événement.",
        title: 'Visibilité',
      },
    },
  },
  facilityForm: {
    accessibility: {
      planningColor: 'Couleur de planning',
    },
    actions: {
      create: 'Créer',
      save: 'Enregistrer',
    },
    capacity: {
      teamPlural: 'équipes simultanées',
      teamSingular: 'équipe simultanée',
    },
    conflictModes: {
      allow: {
        description: 'Le créneau reste confirmé, les dirigeants sont notifiés.',
        label: 'Autoriser et notifier',
      },
      pending: {
        description: 'Le créneau passe en demande, un dirigeant valide avant confirmation.',
        label: 'Demande à valider',
      },
    },
    defaults: {
      name: 'Nom de l\'installation',
      type: 'Type inconnu',
    },
    errors: {
      addressGeocodeRequired: 'Sélectionne une adresse géolocalisée dans la liste.',
      planningColorInvalid: 'Sélectionne une couleur validé.',
    },
    fields: {
      address: 'Adresse (lieu exact)',
      capacity: 'Capacité',
      capacityConflictMode: 'Comportement en cas de conflit',
      name: 'Nom de l\'installation',
      planningColor: 'Couleur dans le planning',
      type: 'Type — requis',
    },
    hints: {
      addressSelection: 'Sélectionne une adresse dans la liste pour activer le GPS.',
      gpsActive: '✓ GPS activé',
      planningColor: 'Elle sert à repérer l\'installation dans le planning — elle apparaît en pastille sur sa carte.',
    },
    placeholders: {
      address: 'Ex: 12 Rue du Stade...',
      name: 'Ex: Terrain Honneur, Salle A...',
    },
    subtitle: {
      create: 'Configure une nouvelle installation pour ton club.',
      edit: 'Mets à jour les informations de cette installation.',
    },
    title: {
      create: 'Nouvelle installation',
      edit: 'Modifier l\'installation',
    },
  },
  facilityList: {
    actions: {
      add: 'Ajouter',
      viewPlanning: 'Voir planning',
    },
    badges: {
      multisport: 'Multisport',
      shared: 'Partagée',
    },
    capacity: {
      hintPlural: 'Capacité simultanée: {{count}} équipes',
      hintSingular: 'Capacité simultanée: {{count}} équipe',
      teamPlural: 'équipes simultanées',
      teamSingular: 'équipe simultanée',
    },
    defaults: {
      addressMissing: 'Adresse non renseignée',
      facilityName: 'Installation',
      unknownType: 'Type inconnu',
    },
    labels: {
      planningColor: 'Couleur planning',
    },
    planning: {
      allClubFacilities: 'Toutes installations',
      allSharedFacilities: 'Toutes partagées',
      occupiedBy: 'Occupé par {{clubName}}',
      scopeClub: 'Mon club',
      scopeShared: 'Partagées',
      sharedEmpty: 'Aucune installation partagée disponible pour ce club.',
      sharedFallbackTitle: 'Occupation',
      sharedLabel: 'Planning partagé',
    },
    readOnlyHint: 'Installation partagée, modification depuis le multisport uniquement.',
    sections: {
      club: 'Installations du club',
      shared: 'Installations partagées',
    },
    sharedOwnerHint: 'Installation partagée du multisport {{ownerName}}. Lecture seule côté club.',
  },
  // LOT D41 ② — la copy des chantiers B (tunnel amical, etape 2/7) et C (carte
  // d'annonce) descend ici. Elle etait ecrite en chaines litterales dans le JSX :
  // rien n'etait traduisible, et corriger une faute demandait de toucher le code.
  // ⛔ CE BLOC NE REFORMULE RIEN. Chaque valeur est le texte deja affiche, mot
  // pour mot, apostrophes typographiques comprises. Un rapatriement qui change
  // un mot n'est plus un rapatriement.
  // ⚠️ Les seules interpolations sont des NOMBRES ({{total}}, {{km}}) et une
  // heure validee par regex ({{start}}) : i18next echappe les valeurs interpolees
  // (&, ', <, >), donc un nom de club ou une ville ne passe JAMAIS par {{...}} —
  // « L'Étoile » y deviendrait « L&#39;Étoile ». Ces valeurs restent assemblees
  // en JS, autour du fragment traduit.
  friendlyMatch: {
    adCard: {
      accessibilityHint: 'Ouvrir le détail de l\'annonce',
      accessibilityLabelPrefix: 'Match amical',
      applications: '{{total}} proposition{{plural}}',
      cta: {
        apply: 'Proposer un match',
        applying: 'Envoi...',
        closed: 'Annonce clôturée',
        confirmed: 'Match confirmé',
        declined: 'Proposition refusée',
        matched: 'Adversaire trouvé',
        pending: 'Proposition envoyée',
        staffOnly: 'Réservé aux entraîneurs et dirigeants',
      },
      distance: 'à {{km}} km',
      edit: 'Modifier',
      editAd: 'Modifier l’annonce',
      fallback: {
        category: 'Catégorie libre',
        club: 'Club inconnu',
        dates: 'Dates à convenir',
        format: 'Format à convenir',
        level: 'Niveau libre',
        place: 'Lieu non précisé',
        sport: 'Football',
        time: 'Heure à convenir',
      },
      seeApplications: 'Voir les {{total}} proposition{{plural}}',
      status: {
        closed: 'Clôturée',
        matched: 'Match trouvé',
        online: 'En ligne',
      },
      timeFrom: 'dès {{start}}',
      view: 'Voir',
    },
    wizard: {
      hosting: {
        info: 'Seules les équipes compatibles avec ton choix verront ton annonce'
          + ' — les autres ne la voient pas.',
        options: {
          away: {
            consequence: 'Tu joues chez l’adversaire.',
            label: 'Je me déplace',
          },
          both: {
            consequence: 'Ton annonce touche le plus d’équipes.',
            label: 'Les deux',
          },
          host: {
            consequence: 'Le match se jouera sur ton terrain.',
            label: 'Je reçois',
          },
        },
        subtitle: 'C’est ce qui décide où le match se jouera.',
        title: 'Tu peux recevoir ?',
      },
      location: {
        facilities: {
          hint: 'Choisis-en une et l’adresse se remplit toute seule.'
            + ' Sinon, tape une ville ci-dessous.',
          info: 'Le terrain exact reste modifiable : il se convient dans la discussion'
            + ' qui s’ouvre quand une équipe te répond.',
          title: 'Une installation de ton club',
        },
      },
    },
  },
  home: {
    fields: {
      type: {
        label: 'Trouver',
        options: {
          club: 'un club',
          event: 'un événement',
          reservation: 'une réservation',
          team: 'une équipe',
        },
      },
    },
  },
  homeHub: {
    account: {
      logoutDescription: 'Veux-tu te déconnecter de ton compte ?',
      logoutTitle: 'Déconnexion',
    },
    alerts: {
      featuredFallback: {
        description: 'Aucun club omnisport détecté. Redirection vers les demandes du club.',
        title: 'Information',
      },
      missingContext: {
        description: 'Aucun club disponible pour gérer les demandes à la une.',
        title: 'Contexte manquant',
      },
      noClub: {
        description: 'Ton compte doit être rattaché à un club pour gérer ces demandes.',
        title: 'Club introuvable',
      },
      noTrainedTeams: {
        description: 'Tu dois être entraîneur d\'au moins une équipe pour gérer les demandes d\'adhésion.',
        title: 'Aucune équipe disponible',
      },
    },
    // D72 — le bandeau de tete de l'accueil, une variante par role.
    banner: {
      coach: {
        action: 'Ouvrir la compo',
        called: 'convoquées',
        label: 'Ma prochaine séance',
        missing: 'réponses manquantes',
      },
      player: {
        absent: 'Absent',
        label: 'Ma semaine',
        present: 'Présent',
      },
      superAdmin: {
        claims: 'Revendications de club',
        featured: 'À la une — à valider',
        label: 'À traiter',
        onboarding: 'Clubs à onboarder',
        reports: 'Signalements',
      },
      today: {
        label: 'Aujourd’hui',
        requests: 'Demandes en attente',
        unpaid: 'Cotisations impayées',
      },
    },
    cards: {
      account: {
        logout: {
          subtitle: 'Ferme ta session sur cet appareil.',
          title: 'Déconnexion',
        },
        switch: {
          subtitle: 'Bascule vers un autre compte connecté.',
          title: 'Changer de compte',
        },
        tutorial: {
          subtitle: 'Relancer un tutoriel ou réinitialiser les guides.',
          title: 'Tutoriels et aide',
        },
      },
      // D72 — le rayon « Administration », visible du seul super admin.
      admin: {
        dashboard: {
          subtitle: 'Les 23 tuiles de suivi.',
          title: 'Dashboard complet',
        },
        league: {
          subtitle: 'Saisons, divisions, classements.',
          title: 'League',
        },
        triage: {
          subtitle: 'Signalements, revendications, à la une, clubs à onboarder.',
          title: 'À traiter',
        },
        users: {
          subtitle: 'Recherche, modération, fiches.',
          title: 'Utilisateurs et clubs',
        },
      },
      league: {
        subtitle: 'Le mode compétitif de FoundClub.',
        title: 'FoundClub League',
      },
      manage: {
        addAd: {
          subtitle: 'Publie une offre de recrutement.',
          // D72 — « Publier une offre » devient « Recruter » : c'est le besoin,
          // pas le geste. La clef ne bouge pas, seule sa valeur change.
          title: 'Recruter',
        },
        addEvent: {
          subtitle: 'Crée un entraînement, un match\u2026',
          title: 'Ajouter un événement',
        },
        clubRequests: {
          subtitle: "Valider ou refuser les demandes d'adhésion au club.",
          title: 'Demandes adhésion club',
        },
        featuredRequests: {
          subtitle: 'Traite les demandes d événements à la une du club.',
          title: 'Demandes événements à la une',
        },
        licenses: {
          subtitle: 'Suis les statuts de tes membres.',
          teamsSubtitle: 'Suis les paiements de tes équipes.',
          teamsTitle: 'Cotisations de mes équipes',
          title: 'Cotisations du club',
        },
        manageClub: {
          coachSubtitle: 'L’espace de ton club et de tes équipes.',
          coachTitle: 'Mon club',
          subtitle: 'Ton espace club pour tout piloter.',
          title: 'Gérer mon club',
        },
        myAds: {
          subtitle: 'Tes offres, tes matchs et les réponses reçues.',
          title: 'Mes activités',
        },
        requests: {
          // D72 — l'entraineur n'a pas l'onglet « Club », reserve au dirigeant.
          coachSubtitle: 'Équipes, événements, à la une.',
          subtitle: 'Club, équipes, événements, à la une.',
          title: 'Demandes',
        },
        teamRequests: {
          subtitle: 'Traite les demandes d adhésion des joueurs à tes équipes.',
          title: 'Demandes adhésion équipes',
        },
      },
      profile: {
        alerts: {
          subtitle: 'Reçois des notifications ciblées.',
          title: 'Gérer mes alertes',
        },
        edit: {
          subtitle: 'Mets à jour tes informations.',
          title: 'Modifier mon profil',
        },
        history: {
          subtitle: 'Ajoute ou ajuste ton parcours.',
          title: 'Historique sportif',
        },
        subscription: {
          fallbackSubtitle: 'Consulte tes offres, quotas gratuits et équipes couvertes.',
          title: 'Mon abonnement',
        },
        view: {
          subtitle: 'Consulte les infos de ton profil.',
          title: 'Voir mon profil',
        },
      },
      quick: {
        chat: {
          subtitle: 'Ouvre ta messagerie.',
          title: 'Messagerie',
        },
        license: {
          // AA07 / K1 — le PLURIEL, parce qu on peut cotiser dans plusieurs clubs
          // et qu au singulier la case laissait croire qu il n y en avait qu une.
          subtitle: 'Tes statuts et ton reste à payer.',
          title: 'Mes cotisations',
        },
        planning: {
          subtitle: 'Retrouve tes événements à venir.',
          title: 'Mon planning',
        },
        teams: {
          subtitle: 'Accède à tes équipes et leurs infos.',
          title: 'Mes équipes',
        },
      },
      search: {
        ads: {
          subtitle: 'Postuler aux offres des équipes.',
          title: 'Recrutement',
        },
        amicaux: {
          subtitle: 'Trouve un adversaire pour ton équipe.',
          title: 'Matchs amicaux',
        },
        clubs: {
          subtitle: 'Trouve la page d\u2019un club.',
          title: 'Club',
        },
        events: {
          subtitle: 'Détections, séances d\u2019essai, matchs\u2026',
          title: 'Événement',
        },
        profiles: {
          subtitle: 'Trouve des profils ouverts.',
          title: 'Profils',
        },
        reservations: {
          subtitle: 'Réserve un terrain (foot à 5\u2026).',
          title: 'Réservations',
        },
      },
    },
    roles: {
      coach: 'Entraîneur',
      player: 'Joueur',
      president: 'Dirigeant',
      superAdmin: 'Super admin',
    },
    sections: {
      account: 'Compte',
      administration: 'Administration',
      league: 'FoundClub League',
      manageClub: 'Gérer mon club',
      manageTeams: 'Gérer mes équipes',
      myClub: 'Mon club',
      profile: 'Mon profil',
      // D72 — la section « Navigation rapide » n'est plus rendue par aucun ecran.
      // La clef reste : ⛔ aucune suppression dans fr.js (le controle est la
      // comparaison des ENSEMBLES de clefs, pas le compte de lignes).
      quickNav: 'Navigation rapide',
      search: 'Rechercher',
    },
    title: 'Accueil',
  },
  homeHubTutorial: {
    actions: {
      scrollDown: 'Descendre',
    },
    center: {
      actions: {
        pickFeature: 'Choisir un tutoriel de fonctionnalité',
        relaunchHome: 'Relancer le tutoriel Accueil',
        resetAll: 'Réinitialiser tous les tutoriels',
      },
      subtitle: 'Relance un tutoriel ou réinitialise tous les guides.',
      title: 'Tutoriels et aide',
    },
    entry: {
      actions: {
        skip: 'Passer',
        start: 'Lancer le tutoriel complet',
      },
      description: 'Tu peux lancer le tutoriel complet pour tout comprendre, ou explorer l\'application par te même.',
      subtitle: 'FoundClub est un outil conçu pour t\'accompagner dans toute ton aventure sportive, peu importe ton sport.',
      title: 'Bienvenue sur FoundClub',
    },
    featurePicker: {
      subtitle: 'Sélectionne une fonctionnalité à découvrir.',
      title: 'Choisir un tutoriel',
    },
    reset: {
      confirm: 'Réinitialiser',
      description: 'Tous les tutoriels seront remis a zéro pour ce compte.',
      title: 'Réinitialiser les tutoriels',
    },
    steps: {
      accountLogout: {
        description: 'Déconnecte-te proprement de l appareil actuel.',
        title: 'Déconnexion',
      },
      accountSwitch: {
        description: 'Ouvre la modale pour changer ou ajouter un compte.',
        title: 'Changer de compte',
      },
      header: {
        description: 'Cette page te donne un accès rapide à toutes les fonctionnalités principales.',
        title: 'Accueil FoundClub',
      },
      league: {
        description: 'Bascule vers FoundClub League pour les fonctionnalités compétitives.',
        title: 'FoundClub League',
      },
      manageAddAd: {
        description: 'Publie une annonce de recrutement pour cibler des profils précis.',
        title: 'Ajouter une annonce',
      },
      manageAddEvent: {
        description: 'Crée un entraînement, match ou détection pour tes équipes.',
        title: 'Ajouter un événement',
      },
      manageClub: {
        description: 'Accèdes à ton espace club pour piloter ton organisation.',
        title: 'Gérer mon club',
      },
      manageClubRequests: {
        description: 'Traite les demandes d\'adhésion reçues par ton club.',
        title: 'Demandes adhésion club',
      },
      manageFeaturedRequests: {
        description: 'Valide les demandes d événements à la une de ton organisation.',
        title: 'Demandes événements à la une',
      },
      manageRequests: {
        description: 'Regroupe et traite toutes les demandes depuis un seul onglet.',
        title: 'Demandes',
      },
      manageTeamRequests: {
        description: 'Valide ou refuse les demandes pour rejoindre tes équipes.',
        title: 'Demandes adhésion équipes',
      },
      profileAlerts: {
        description: 'Configure des alertes personnalisées selon tes recherches.',
        title: 'Gérer mes alertes',
      },
      profileEdit: {
        description: 'Modifie tes informations personnelles et sportives.',
        title: 'Modifier mon profil',
      },
      profileHistory: {
        description: 'Ajoute tes expériences via le wizard historique.',
        title: 'Historique sportif',
      },
      profileView: {
        description: 'Consulte ta page profil complète.',
        title: 'Voir mon profil',
      },
      quickChat: {
        description: 'Ouvre ta messagerie et suis tes conversations.',
        title: 'Messagerie',
      },
      quickPlanning: {
        description: 'Accèdes rapidement à ton planning personnel.',
        title: 'Mon planning',
      },
      quickTeams: {
        description: 'Retrouve toutes tes équipes et leurs pages.',
        title: 'Mes équipes',
      },
      searchAds: {
        description: 'Consulte les annonces de recrutement et les profils disponibles.',
        title: 'Rechercher des annonces',
      },
      searchClubs: {
        description: 'Explore les clubs et ouvre leur fiche détaillée.',
        title: 'Rechercher un club',
      },
      searchEvents: {
        description: 'Trouve des événements sportifs en utilisant les filtres de recherche.',
        title: 'Rechercher un événement',
      },
      searchReservations: {
        description: 'Accèdes aux réservations et filtre selon ton activité.',
        title: 'Rechercher une réservation',
      },
      tutorialCenter: {
        description: 'Relance un tutoriel quand tu veux, ou remets tout a zéro.',
        title: 'Tutoriels et aide',
      },
    },
  },
  invitationLink: {
    club: {
      body: 'Tu as reçu une invitation à rejoindre ce club. Envoyer ta demande ?',
      primary: 'Voir le club',
      title: 'Invitation à rejoindre un club',
    },
    event: {
      body: "Tu as reçu une invitation pour un événement. Veux-tu l'ouvrir ?",
      primary: "Voir l'événement",
      title: 'Invitation à un événement',
    },
    eyebrow: 'Invitation',
    invalid: {
      body: "Ce lien d'invitation est incomplet ou périmé. Demande-en un nouveau.",
      primary: "J'ai compris",
      title: "Lien d'invitation invalide",
    },
    later: 'Plus tard',
    team: {
      body: 'Tu as reçu une invitation à rejoindre cette équipe. Envoyer ta demande ?',
      primary: 'Envoyer ma demande',
      title: 'Invitation à rejoindre une équipe',
    },
  },
  login: {
    actions: {
      login: 'Se connecter',
      register: 'Créer un compte',
    },
    fields: {
      phoneNumber: {
        label: 'Numéro de téléphone',
        placeholder: '0612345678',
      },
    },
    or: 'ou',
    subtitle: 'Renseigne ton numéro de téléphone.',
    title: 'Connecte-toi',
  },
  matchCallUp: {
    manualPlayer: {
      actions: {
        cancel: 'Annuler',
        submit: 'Ajouter au groupe',
      },
      errors: {
        nameRequired: 'Prénom et nom requis.',
      },
      fields: {
        firstname: {
          label: 'Prénom',
          placeholder: 'Yanis',
        },
        jerseyNumber: {
          label: 'Numéro de maillot',
          placeholder: '23',
        },
        lastname: {
          label: 'Nom',
          placeholder: 'Bertrand',
        },
        optional: 'Optionnel',
      },
      intro: "Il apparaîtra sur la compo et dans la convocation comme les autres. Il ne pourra simplement pas répondre depuis l'app.",
      subtitle: "Il n'a pas l'app · {{teamName}}",
      title: 'Ajouter un joueur',
      warning: {
        after: '. Ce sera à toi de le prévenir.',
        before: '{{firstname}} ne recevra',
        fallbackName: 'ce joueur',
        strong: 'aucune notification',
      },
    },
    selection: {
      absentWarning: {
        cancel: 'Revoir ma sélection',
        confirm: 'Convoquer quand même',
        message_one: '{{names}} a répondu qu’il ne serait pas là.',
        message_other: '{{names}} ont répondu qu’ils ne seraient pas là.',
        note: 'Rien ne t’en empêche : la convocation partira quand même.',
        title_one: '1 joueur a dit ABSENT',
        title_other: '{{count}} joueurs ont dit ABSENT',
      },
      addPlayer: {
        subtitle: "Nom, prénom et numéro, pour un joueur sans l'app",
        title: 'Ajouter un joueur',
      },
      alerts: {
        noneSelected: {
          message: 'Sélectionne au moins un joueur.',
          title: 'Attention',
        },
      },
      defaultEventType: 'Match',
      empty: {
        offApp: 'Aucun joueur hors app pour le moment.',
        reinforcements: "Aucune autre équipe dans le club pour l'instant.",
        search: 'Aucun résultat.',
        squad: "Aucun joueur dans l'équipe.",
      },
      footer: {
        calledUp_one: '{{count}} convoqué',
        calledUp_other: '{{count}} convoqués',
        extras: 'dont {{reinforcements}} renforts · {{offApp}} hors app',
        next: 'Suivant',
        split: '{{starters}} titulaires · {{bench}} sur le banc',
      },
      meta: {
        number: 'N°{{number}}',
        numberAndPosition: 'N°{{number}} · {{position}}',
        positionToDefine: 'Poste à définir',
      },
      noSms: 'Préviens-le toi-même',
      offAppTag: 'Hors app',
      progress: '{{current}}/{{total}}',
      rsvp: {
        absent: 'Absent',
        none: 'Sans réponse',
        pending: 'En attente',
        present: 'Présent',
      },
      search: 'Rechercher un joueur',
      sections: {
        offApp: 'Déjà ajoutés · {{count}}',
        reinforcements: 'Renforts du club · {{count}}',
        squad: 'Effectif {{teamName}} · {{count}}',
      },
      tabs: {
        offApp: 'Hors app',
        others: 'Autres équipes',
        squad: 'Mon équipe',
      },
      title: 'Convoqués',
      unavailability: {
        injury: 'Blessé',
        licence: 'Licence non validée',
        suspension_one: 'Suspendu {{count}} match',
        suspension_other: 'Suspendu {{count}} matchs',
      },
    },
  },
  matchComposition: {
    board: {
      actions: {
        publish: 'Publier',
        save: 'Enregistrer',
      },
      alerts: {
        error: {
          publish: 'Impossible de publier cette convocation.',
          save: "Impossible d'enregistrer cette composition.",
          title: 'Erreur',
        },
        published: {
          message: 'La convocation est partie dans le canal de l’équipe.',
          ok: 'OK',
          title: 'Convocation publiée',
        },
        saved: {
          message: 'Ta composition est gardée en brouillon. Personne n’a été prévenu.',
          title: 'Composition enregistrée',
        },
      },
      bench: {
        empty: 'Tout le monde est sur le terrain.',
        hint: 'Glisse un joueur sur le terrain',
        title: 'Remplaçants · {{count}}',
      },
      chips: {
        bench: 'Banc {{count}}',
        freePlacement: 'Placement libre',
        magnet: 'Aimanté aux postes',
        placed: '{{placed}}/{{starters}} placés',
      },
      edit: 'Modifier',
      title: 'Composition',
      tokenOnBench: '{{name}}, sur le banc',
      tokenOnField: '{{name}}, sur le terrain',
    },
    sheet: {
      actions: {
        publish: 'Publier la convocation',
      },
      description: 'La convocation part dans le canal {{teamName}} — seuls les joueurs retenus sont convoqués.',
      kicker: 'Convocation',
      requireResponse: {
        subtitle: 'Présent / absent dans le canal',
        title: 'Demander une réponse',
      },
      summary: {
        offApp: 'Joueurs hors app',
        offAppValue_one: '{{count}} ajouté à la main',
        offAppValue_other: '{{count}} ajoutés à la main',
        starters: 'Titulaires',
        startersValue: '{{count}} sur le terrain',
        substitutes: 'Remplaçants',
        substitutesValue: '{{count}} sur le banc',
      },
      title: 'Publier la compo ?',
    },
    sports: {
      basketball: 'Basketball',
      football: 'Football',
      generic: 'Terrain',
      handball: 'Handball',
      rugby: 'Rugby',
      volleyball: 'Volleyball',
    },
    start: {
      actions: {
        openField: 'Ouvrir le terrain',
      },
      calledUpCount_one: '{{count}} convoqué',
      calledUpCount_other: '{{count}} convoqués',
      eventLabel: 'Match',
      magnet: {
        disabled: 'Disponible quand tu pars d’une formation.',
        subtitle: 'Le jeton colle au poste le plus proche. Tu peux toujours le poser où tu veux.',
        title: 'Aimanter aux postes',
      },
      options: {
        default_composition: {
          subtitle: 'Le modèle par défaut de {{teamName}}.',
          title: 'Compo type',
        },
        empty: {
          subtitle: 'Tout le monde part du banc.',
          title: 'Terrain vide',
        },
        last_match: {
          subtitle: 'La compo du dernier match, telle quelle.',
          subtitleDated: 'La compo de {{date}}, telle quelle.',
          title: 'Dernier match',
        },
      },
      preview: 'Aperçu',
      previewEmpty: 'Tout le monde part du banc.',
      progress: '{{current}}/{{total}}',
      title: 'Partir de…',
      unavailable: {
        noDefaultComposition: 'Cette équipe n’a pas encore de compo type.',
        noLastMatch: 'Aucune compo déjà publiée à reprendre.',
      },
    },
  },
  matchConvocation: {
    amend: {
      actions: {
        cancel: 'Annuler',
        republish: 'Republier',
      },
      alerts: {
        error: {
          message: 'Impossible de republier cette composition.',
          title: 'Erreur',
        },
        republished: {
          message: 'Ta composition est à jour et tes joueurs viennent d’être prévenus.',
          title: 'Composition republiée',
        },
      },
      badges: {
        entering: 'entre',
        leaving: 'sort',
      },
      empty: {
        message: 'Personne ne s’est désisté.',
        title: 'Rien à modifier pour l’instant',
      },
      moves: {
        benchToStarter: 'Banc → titulaire',
        starterToAbsent: 'Titulaire → absent',
      },
      noReplacement: 'Aucun remplaçant disponible sur le banc. Reprends la composition à la main.',
      resend: {
        body: 'Même canal {{teamName}}, même notification individuelle, même demande de '
          + 'réponse. Les joueurs qui avaient déjà répondu gardent leur réponse.',
        title: 'La convocation repart comme la première fois.',
      },
      sections: {
        changes: 'Ce qui change',
        resend: 'Renvoyer la convocation',
      },
      title: 'Compo modifiée',
      unknownPlayer: 'Joueur',
      versionChip: 'Version {{version}}',
      withdrawal: {
        hint_one: 'Sa place de titulaire est vide. Le premier remplaçant disponible est proposé.',
        hint_other: 'Leurs places de titulaires sont vides. Les premiers remplaçants '
          + 'disponibles sont proposés.',
        label: 'Désistement',
        message_one: '{{name}} s’est déclaré·e absent·e après la publication.',
        message_other: '{{count}} titulaires se sont déclarés absents après la publication.',
      },
    },
    published: {
      actions: {
        edit: 'Modifier la composition',
        resend: 'Relancer',
      },
      alerts: {
        error: {
          resend: 'Impossible de renvoyer cette convocation.',
          title: 'Erreur',
        },
        resendConfirm: {
          cancel: 'Annuler',
          confirm: 'Renvoyer',
          message: 'La convocation repart dans le canal {{teamName}}, avec une notification '
            + 'à chaque convoqué. Les réponses déjà données sont conservées.',
          title: 'Renvoyer la convocation ?',
        },
        resent: {
          message: 'Tes convoqués viennent d’être prévenus à nouveau.',
          title: 'Convocation renvoyée',
        },
      },
      counts: {
        absent_one: '{{count}} absent',
        absent_other: '{{count}} absents',
        pending_one: '{{count}} en attente',
        pending_other: '{{count}} en attente',
        present_one: '{{count}} présent',
        present_other: '{{count}} présents',
      },
      empty: 'Personne n’est encore convoqué.',
      loading: 'Chargement des réponses…',
      meta: {
        roleAndNumber: '{{role}} · N°{{number}}',
      },
      offAppNote: 'Hors app — il ne peut pas répondre',
      openCta: 'Voir la convocation et les réponses',
      recap: {
        calledUp: 'Joueurs convoqués',
        sent: 'Envoyée dans le canal {{teamName}}',
        sentAt: 'Envoyée dans le canal {{teamName}} · {{time}}',
        title: 'Convocation publiée',
      },
      responses: {
        absent: 'Absent·e',
        pending: 'Participation en attente',
        present: 'Présent·e',
      },
      roles: {
        starter: 'Titulaire',
        substitute: 'Remplaçant',
      },
      sections: {
        responses: 'Réponses',
      },
      stateChip: 'Publiée',
      title: 'Convocation',
      unknownPlayer: 'Joueur',
      withdrawal: {
        cta: 'Remplacer',
        label: 'Désistement',
        message_one: 'Un titulaire s’est déclaré absent.',
        message_other: '{{count}} titulaires se sont déclarés absents.',
      },
    },
  },
  menu: {
    chat: 'Messagerie',
    home: 'Accueil',
    myClub: 'Mon club',
    myTeams: 'Mes équipes',
    planning: 'Mon planning',
    requests: 'Demandes',
    search: 'Rechercher',
  },
  menuDock: {
    chat: 'Messages',
    home: 'Accueil',
    myClub: 'Club',
    myTeams: 'Équipes',
    planning: 'Planning',
    search: 'Recherche',
  },
  messaging: {
    noData: 'Aucune conversation trouvée.',
    preview: {
      attachment: 'Pièce jointe',
      contactShare: 'Contact partagé',
      eventShare: 'Événement partagé',
      eventShareNamed: 'Événement : {{name}}',
      fallback: 'Nouveau message',
      file: 'Fichier',
      lineupShare: 'Composition publiée',
      lineupShareNamed: 'Composition : {{team}}',
      locationShare: 'Localisation',
      photo: 'Photo',
      poll: 'Sondage',
      pollNamed: 'Sondage : {{question}}',
      proposal: 'Proposition',
      proposalMatch: 'Proposition de match',
      proposalTeam: '{{team}} propose un match',
      proposalWhen: '{{team}} propose un match — {{when}}',
      voiceNote: 'Note vocale',
    },
    title: 'Messages privés',
    unread: {
      badge: 'Non lu',
    },
  },
  modals: {
    actions: {
      search: 'Rechercher...',
      select: 'Sélectionner',
    },
    phone: {
      title: 'Sélectionner un pays',
    },
  },
  multisport: {
    accessibility: {
      addSponsor: 'Ajouter un partenaire',
      callPhone: 'Appeler le club',
      deleteSection: 'Supprimer la section',
      editClub: 'Modifier les informations du club',
      openAdminHint: 'Ouvrir le profil du dirigeant',
      openSectionHint: 'Ouvrir le détail de la section',
      sendEmail: 'Envoyer un email au club',
    },
    actions: {
      addAd: {
        subtitle: 'Publier une annonce de recherche de profil.',
        title: 'Ajouter une annonce',
      },
      addEvent: {
        subtitle: 'Créer un événement pour une section ou une équipe.',
        title: 'Ajouter un événement',
      },
      createSection: {
        title: 'Créer une section',
      },
      manageClub: {
        subtitle: 'Modifier les informations et réglages du club.',
        title: 'Gérer mon club',
      },
      requests: {
        subtitle: 'Traiter les demandes en attente de ton organisation.',
        title: 'Demandes',
      },
    },
    badge: 'OMNISPORT',
    createSection: {
      actions: {
        create: 'Créer la section',
        creating: 'Création...',
      },
      fields: {
        address: {
          label: 'Adresse / Ville *',
          placeholder: 'Rechercher une adresse',
        },
        managerPhone: {
          help: 'Ce numéro sera utilisé pour rattacher le dirigeant à la section.',
          label: 'Numéro du dirigeant (optionnel)',
          placeholder: 'Ex: 0612345678',
        },
        name: {
          label: 'Nom de la section *',
          placeholder: 'Ex: Football, Basketball',
        },
        sport: {
          label: 'Sport',
          noResults: 'Aucun sport ne correspond à ta recherche.',
          placeholder: 'Choisir un sport',
        },
      },
      info: 'Une fois créée, la section pourra accueillir équipes, événements et membres.',
      subtitle: 'Crée une section sportive pour ton club multisport.',
      title: 'Nouvelle section',
    },
    deleteSectionConfirm: 'Es-tu sûr de vouloir supprimer la section "{{name}}" ? Cette action est irréversible.',
    deleteSectionTitle: 'Supprimer la section',
    edit: {
      fields: {
        phone: {
          label: 'Téléphone',
          placeholder: 'Téléphone',
        },
      },
    },
    empty: {
      admins: 'Aucun dirigeant rattaché.',
      partners: 'Aucun partenaire ajouté.',
      sections: 'Aucune section disponible pour le moment.',
    },
    fallback: {
      noClub: 'Aucun club multisport associé à ce compte.',
    },
    formErrors: {
      addressRequired: "L'adresse est obligatoire.",
      generic: 'Une erreur est survenue lors de la création de la section.',
      sectionNameRequired: 'Le nom de la section est obligatoire.',
    },
    hero: {
      summary: 'Vue globale du club multisport et de ses sections.',
    },
    labels: {
      members: 'membres',
      teams: 'équipes',
    },
    sectionCreated: 'La section a été créée avec succès.',
    sectionCreatedMessage: 'La section "{{name}}" a été créée avec succès.',
    sectionCreatedTitle: 'Section créée',
    sectionDeleted: 'La section a été supprimée avec succès.',
    stats: {
      admins: 'Dirigeants',
      members: 'Membres',
      sections: 'Sections',
      teams: 'Équipes',
    },
    titles: {
      admins: 'Dirigeants omnisport',
      partners: 'Partenaires',
      quickActions: 'Actions rapides',
      sections: 'Mes sections',
    },
    tutorial: {
      mainDescription: 'Gère tes sections, tes membres et tes actions rapides depuis un seul écran.',
      mainTitle: 'Gestion multisport',
    },
  },
  myEventList: {
    actions: {
      closeTimeFilter: 'Valider',
    },
    fields: {
      timeFilter: {
        next: 'Mes prochains événements',
        past: 'Mes événements passés',
        selectDate: 'Sélectionner une date',
      },
      type: {
        all: 'Tous',
      },
    },
  },
  myTeamList: {

    title: 'Mes équipes',
  },
  notifications: {
    details: {
      participationDeclined: {
        actions: {
          viewEvent: "Voir l'événement",
        },
        eventFallback: 'Événement indisponible',
        labels: {
          decisionDate: 'Date de décision',
          event: 'Événement',
          reason: 'Motif',
          status: 'Statut',
        },
        reasonFallback: "Aucun motif précisé par l'organisateur.",
        screenTitle: 'Détail notification',
        statusDeclined: 'Demande refusée',
        subtitle: 'Ta demande de participation a été refusée.',
        title: 'Demande refusée',
        unknownDate: 'Date indisponible',
      },
    },
    labels: {
      participationDeclined: 'Refusée',
    },
  },
  onboarding: {
    category: {
      subtitle: 'La catégorie d\'âge dans laquelle tu joues cette saison.',
      title: 'Ta catégorie ?',
    },
    clubSearch: {
      editableLater: 'Modifiable à tout moment depuis Mon profil.',
      privateHelp: 'Ton profil n\'apparaît dans aucune recherche '
        + '— seuls tes coéquipiers te voient.',
      privateLabel: 'Profil privé',
      subtitle: 'Les clubs et entraîneurs peuvent-ils te trouver ?',
      title: 'Visibilité de ton profil',
      visibleHelp: 'Les clubs et entraîneurs peuvent te trouver '
        + 'et te contacter pour te recruter.',
      visibleLabel: 'Profil visible',
    },
    optionalStepHint: 'Cette étape n\'est pas obligatoire, mais elle reste utile pour améliorer ton expérience FoundClub.',
    physique: {
      heightLabel: 'Taille (cm)',
      privacyNotice: 'Visible uniquement si ton profil est public.',
      subtitle: 'Facultatif — ces infos aident les recruteurs.',
      title: 'Ton physique',
      weightLabel: 'Poids (kg)',
    },
  },
  onboardingAffiliation: {
    a11y: {
      askForHelpHint: 'Envoie une demande aux superadmins FoundClub.',
      backHint: 'Revient à l\'étape précédente de l\'onboarding.',
      cardHintClub: 'Ouvre la fiche du club pour confirmer l\'affiliation.',
      cardHintClubSelect: 'Sélectionne ce club pour voir ses équipes.',
      cardHintTeam: "Ouvre la fiche de l'équipe pour demander à rejoindre.",
      cardLabelClub: 'Ouvrir la fiche du club {{name}}',
      cardLabelClubSelect: 'Sélectionner le club {{name}}',
      cardLabelTeam: "Ouvrir la fiche de l'équipe {{name}}",
      continueLaterHint: 'Passe cette étape et continue l\'onboarding.',
      filterHint: 'Ouvre les filtres de recherche de club.',
      filterLabel: 'Ouvrir les filtres',
      modalCancelHint: 'Ferme la fenêtre de demande.',
      modalCommentHint: 'Ajoute des informations utiles à la recherche.',
      modalNameHintClub: 'Renseigne le nom du club que tu recherches.',
      modalNameHintTeam: "Renseigne le nom de l'équipe que tu recherches.",
      modalSendHint: 'Envoie ta demande aux superadmins.',
      nearbyHint: 'Autorise la localisation pour classer les clubs par distance.',
      notFoundHintClub: 'Envoie une demande d\'aide si ton club est introuvable.',
      notFoundHintTeam: 'Envoie une demande d\'aide si ton équipe est introuvable.',
      retryHint: 'Relance la recherche de résultats.',
      searchInputHintClub: 'Saisis le nom du club pour filtrer la liste.',
      searchInputHintTeam: "Saisis le nom de l'équipe pour filtrer la liste.",
      searchInputLabelClub: 'Champ nom du club',
      searchInputLabelTeam: "Champ nom de l'équipe",
      sportChipHint: 'Filtre la liste sur ton sport.',
      tooltipNextHint: 'Passe à l étape suivante du tutoriel.',
      tooltipPreviousHint: 'Revient à l\'étape précédente du tutoriel.',
      tooltipSkipHint: 'Quitte le tutoriel guide.',
    },
    actions: {
      askForHelp: 'Besoin d\'aide ? Nous contacter',
      changeClub: 'Changer de club',
      continueLater: 'Continuer plus tard',
      notFoundClub: 'Je ne trouve pas mon club',
      notFoundTeam: 'Je ne trouve pas mon équipe',
      skip: 'Passer',
    },
    addClub: {
      action: 'Ajouter',
      subtitle: 'Ajoute-le en 2 minutes, on s\'occupe du reste.',
      title: 'Ton club n\'est pas là ?',
    },
    addTeam: {
      subtitle: 'Signale-la, on s\'occupe du reste.',
      title: 'Ton équipe n\'est pas là ?',
    },
    chips: {
      nearby: 'Autour de moi',
    },
    common: {
      roleTargetClub: 'club',
      roleTargetTeam: 'équipe',
    },
    feedback: {
      missingInfoMessageClub: 'Renseigne le nom du club recherché.',
      missingInfoMessageTeam: "Renseigne le nom de l'équipe recherchée.",
      missingInfoTitle: 'Information manquante',
      requestError: 'Impossible d\'envoyer ta demande.',
      requestSentDescription: 'Ta demande a été envoyée aux superadmins. Tu recevras une notification.',
      requestSentTitle: 'Demande envoyée',
    },
    filtersTutorial: {
      activityDescription: 'Sélectionne un sport pour filtrer uniquement les clubs correspondants.',
      activityTitle: 'Sport',
      applyDescription: 'Applique tes filtres pour revenir à la liste avec des résultats plus précis.',
      applyTitle: 'Appliquer',
      cityDescription: 'Choisis une ville ou une adresse pour centrer la recherche des clubs.',
      cityTitle: 'Localisation',
      radiusDescription: 'Ajuste le rayon en kilomêtres autour de ta localisation.',
      radiusTitle: 'Rayon de recherche',
    },
    modal: {
      commentLabel: 'Commentaire (optionnel)',
      commentPlaceholder: 'Ex: ville, catégorie, orthographe probable...',
      description: 'Donne un maximum de contexte pour aider les superadmins.',
      nameLabelClub: 'Nom du club recherché *',
      nameLabelTeam: "Nom de l'équipe recherchée *",
      namePlaceholderClub: 'Ex: Olympique ...',
      namePlaceholderTeam: 'Ex: U17 Nationaux ...',
      send: 'Envoyer',
      titleClub: 'Je ne trouve pas mon club',
      titleTeam: 'Je ne trouve pas mon équipe',
    },
    results: {
      openClubFallback: 'Voir fiche club',
      openTeamFallback: 'Voir fiche équipe',
    },
    search: {
      filtersActive_one: '{{count}} filtre actif',
      filtersActive_other: '{{count}} filtres actifs',
      placeholderClub: 'Nom du club ou ville',
      placeholderTeam: "Nom de l'équipe",
    },
    sections: {
      nearby: 'PRÈS DE CHEZ TOI',
      results: 'RÉSULTATS',
      suggestions: 'SUGGESTIONS',
      teams: 'ÉQUIPES',
    },
    selectedClubLabel: 'Club sélectionné',
    staffManagementNotice: 'Ta demande de gestion sera envoyée aux dirigeants du club '
      + '— s\'il n\'en a pas encore, tu pourras le revendiquer et le faire certifier.',
    states: {
      emptyWithoutQueryClub: 'Aucun club à afficher pour le moment.',
      emptyWithoutQueryTeam: 'Aucune équipe à afficher pour le moment.',
      emptyWithQueryClub: 'Aucun club trouvé pour "{{query}}".',
      emptyWithQueryTeam: 'Aucune équipe trouvée pour "{{query}}".',
      errorSubtitle: 'Vérifie ta connexion puis réessaie.',
      errorTitle: 'Impossible de charger les résultats',
      loading: 'Recherche en cours...',
      retry: 'Réessayer',
    },
    subtitleClub: 'On personnalise ton accueil, ton planning et tes annonces autour de ton club.',
    subtitleClubCoach: 'Retrouve ton club pour y déclarer les équipes que tu entraînes.',
    subtitleClubSelection: 'Recherche puis sélectionne ton club pour voir ses équipes.',
    subtitleClubStaff: 'Retrouve ton club pour le gérer sur FoundClub.',
    subtitleTeam: 'Recherche ton équipe puis ouvre sa fiche pour envoyer ta demande.',
    subtitleTeamFromClub: 'Recherche ton équipe dans le club sélectionné puis ouvre sa fiche pour envoyer ta demande.',
    titleClub: 'Trouve ton club',
    titleTeam: 'Trouve ton équipe',
    tutorial: {
      stepFiltersDescription: 'On va maintenant ouvrir les filtres pour affiner ta recherche.',
      stepFiltersTitle: 'Ouvrir les filtres',
      stepNotFoundDescriptionClub: 'Si tu ne trouves pas ton club, envoie une demande guidée aux superadmins.',
      stepNotFoundDescriptionTeam: 'Si tu ne trouves pas ton équipe, envoie une demande guidée aux superadmins.',
      stepNotFoundTitleClub: 'Je ne trouve pas mon club',
      stepNotFoundTitleTeam: 'Je ne trouve pas mon équipe',
      stepResultDescriptionClub: "Ouvre la fiche du club pour utiliser le bouton C'est mon club.",
      stepResultDescriptionClubSelect: 'Sélectionne ton club pour afficher ensuite ses équipes.',
      stepResultDescriptionTeam: "Ouvre la fiche de l'équipe pour envoyer ta demande de rejoindre.",
      stepResultTitleClub: 'Sélectionner un club',
      stepResultTitleTeam: 'Sélectionner une équipe',
      stepSearchDescription: 'Tape le nom du {{roleTargetLabel}} pour filtrer la liste.',
      stepSearchTitle: 'Recherche',
    },
  },
  otp: {
    actions: {
      confirm: 'Confirmer',
    },
    fields: {
      code: {
        label: 'Code de confirmation',
        placeholder: '123456',
      },
    },
    subtitle: 'Entre le code reçu par SMS.',
    title: 'Confirme ton numéro',
  },
  permissions: {
    camera: {
      denied: 'Permission caméra refusée',
      message: 'L\'application a besoin d\'accéder à ta caméra pour prendre une photo.',
      title: 'Permission Caméra',
    },
  },
  planning: {
    fullscreen: {
      club: 'Planning club',
      clubShared: 'Planning partagé',
      cm: 'Planning omnisport',
      personal: 'Mon planning',
    },
  },
  playerCard: {
    editCardCta: 'Modifier mes infos',
    generating: 'Génération de l\'image…',
    rarityHint: 'Complète ton profil et ton parcours pour monter en rareté.',
    saveCta: 'Enregistrer l\'image',
    savedDescription: 'Ta carte a été ajoutée aux photos de ton téléphone (album FoundClub).',
    savedTitle: 'Image enregistrée',
    saveError: 'Impossible d\'enregistrer l\'image pour le moment.',
    saveErrorPermission: 'Autorise l\'accès aux photos pour enregistrer ta carte.',
    screenSubtitle: 'Partage ta carte, gagne en visibilité et fais-toi détecter.',
    screenTitle: 'Ma carte de collection',
    shareCta: 'Partager ma carte',
    // Carte (contenu)
    coachChip: 'COACH',
    field: {
      age: 'Âge',
      city: 'Ville',
      nationality: 'Nationalité',
      position: 'Poste',
      role: 'Rôle',
      sport: 'Sport',
      yearsUnit: 'ans',
    },
    historyEmpty: 'Parcours à compléter',
    historyTitle: 'PARCOURS',
    lockedLabel: 'Aperçu — accord parental requis',
    noClub: 'SANS CLUB',
    nowShort: 'Auj.',
    previewChip: 'APERÇU',
    rarity: {
      common: 'COMMUNE',
      epic: 'ÉPIQUE',
      legendary: 'LÉGENDAIRE',
      rare: 'RARE',
    },
    rarityA11y: 'Rareté',
    tagAvailable: 'DISPONIBLE',
    tagAvailableA11y: 'Disponible',
    // Formats d'export
    formatFeed: 'Feed',
    formatStory: 'Story',
    // Reveal fin d'onboarding
    revealContinue: 'Plus tard, continuer',
    revealEyebrow: 'Bienvenue',
    revealTitle: 'Voici ta carte de collection',
    // Garde-fou mineurs
    minorGuardDescription: 'Ce profil concerne un mineur. La publication de la carte nécessite l\'accord d\'un parent ou représentant légal.',
    minorGuardTitle: 'Accord parental requis',
    requestConsent: 'Demander l\'accord parental',
    // Partage (message natif)
    sentDescription: 'Ta carte a bien été partagée. Ouvrir la conversation ?',
    sentTitle: 'Carte envoyée',
    shareAvailableSuffix: 'Je cherche un club !',
    shareError: 'Impossible de générer l\'image pour le moment.',
    shareFallbackName: 'Ma carte FoundClub',
    shareIntro: 'Voici ma carte FoundClub.',
    shareLinkLabel: 'Retrouve-moi sur FoundClub',
    shareOpenWith: 'Ouvrir ta carte avec…',
    sharePermissionError: 'FoundClub n\'a pas le droit d\'enregistrer dans ton téléphone. '
      + 'Autorise-le dans les réglages, puis réessaie.',
    shareSavedGallery: 'Ta carte est enregistrée dans tes photos (album FoundClub). '
      + 'Choisis maintenant où la publier.',
    shareSaveError: 'L\'enregistrement a échoué. '
      + 'Il reste peut-être trop peu de place sur ton téléphone.',
    uploadError: 'L\'envoi de l\'image a échoué.',
    // ShareCardModal
    shareChatA11yHint: 'Envoyer ma carte dans cette conversation',
    shareChatCardHint: 'Envoi direct FoundClub',
    shareChatType: {
      club: 'Club',
      group: 'Groupe',
      multisport: 'Omnisport',
      team: 'Équipe',
      whisper: 'Privé',
    },
    shareCloseA11y: 'Fermer le partage',
    shareEyebrow: 'Diffusion',
    shareGenerating: 'Génération de l\'image…',
    shareInChat: 'Envoyer dans une conversation',
    shareInChatHint: 'Ta carte est envoyée en image.',
    shareNoChat: 'Aucune conversation disponible.',
    shareNoChatHint: 'Rejoins ou crée une conversation pour envoyer ta carte ici.',
    shareOutsideHint: 'SMS, mail ou « Enregistrer l\'image »',
    shareOutsideLabel: 'Lien externe',
    shareSubtitle: 'Choisis un canal pour diffuser ta carte de collection.',
    shareTitle: 'Partager ma carte',
    shareViaOther: 'Partager via… (SMS, Mail, Enregistrer)',
    // Carte équipe
    recruitTitle: 'RECRUTE · SÉANCES D\'ESSAI',
    rosterEmpty: 'Effectif à compléter',
    rosterField: 'Effectif',
    teamChip: 'ÉQUIPE',
  },
  // C-C — ECRAN 10 du pack composition : la vue du joueur convoqué.
  playerConvocation: {
    actions: {
      absent: 'Absent',
      present: 'Présent',
    },
    alerts: {
      error: {
        message: 'Impossible d’enregistrer ta réponse. Réessaie dans un instant.',
        title: 'Erreur',
      },
    },
    card: {
      calledUpBy: 'Convoqué par {{name}}',
      number: 'N°{{number}}',
      position: 'Poste : {{position}}',
    },
    columns: {
      kickOff: 'Coup d’envoi',
      meeting: 'RDV',
      // ⚠️ Le modèle serveur n'a AUCUN champ d'heure de rendez-vous
      // (mesuré le 2026-08-15 sur `event/schema.json`). On le dit, on ne
      // l'invente pas — le pack interdit les promesses fausses.
      notSpecified: 'Non précisé',
      place: 'Lieu',
    },
    compositionTitle: 'La composition',
    empty: {
      // AC08 — ⛔ plus de cul-de-sac : quand la charge n'apporte aucune
      // convocation, on le DIT, et le bouton retour est deja la.
      message: 'Aucune composition publiée ne te concerne sur cet événement.',
      title: 'La composition',
    },
    reserve: {
      title: 'Remplaçants',
    },
    roles: {
      starter: 'Titulaire',
      substitute: 'Remplaçant',
    },
    title: 'Tu es convoqué',
  },
  profile: {
    accountSwitcher: {
      active: 'Actif',
      addAccount: 'Ajouter un compte',
      close: 'Fermer',
      singleAccountHint: 'Ce compte est le seul connecté sur cet appareil. Tu peux en ajouter un autre ou te déconnecter.',
      switching: 'Changement…',
      title: 'Changer de compte',
    },
    actions: {
      addAccount: 'Ajouter un compte',
      adminDashboardClassic: 'Dashboard admin classique',
      confirmDeleteAvatar: 'Es-tu sûr de vouloir supprimer cette image ?',
      deleteAccount: 'Supprimer mon compte',
      edit: 'Modifier mon profil',
      findClub: 'Trouver mon club',
      findTeam: 'Trouver une équipe',
      ignore: 'Ignorer',
      logout: 'Déconnexion',
      manageAlerts: 'Gérer mes alertes',
      manageClub: 'Gérer mon club',
      manageClubJoinRequests: 'Gérer les demandes d\'affiliation au club',
      manageEvents: 'Gérer mes événements',
      manageRequests: 'Gérer mes demandes',
      manageTeamJoinRequests: 'Gérer les demandes d\'adhésion aux équipes',
      manageTeams: 'Gérer mes équipes',
      myTeams: 'Mes équipes',
      save: 'Continuer',
      superAdminLeagueDashboard: 'Dashboard League',
      switchAccount: 'Changer de compte',
      view: 'Voir mon profil',
    },
    alerts: {
      deleteAlert: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer',
        },
        // Lot L28 : le serveur retire desormais les inscriptions a venir et
        // previent le staff. Cette phrase l annonce AVANT la confirmation.
        consequences: 'Tes inscriptions aux événements à venir seront retirées et tes entraîneurs'
          + ' en seront informés. Ton historique passé est conservé. Cette action est définitive.',
        // Lot L48 : cette phrase envoyait remplir un formulaire de contact alors
        // que le bouton supprime le compte tout de suite. CLE MORTE depuis L28 :
        // `Profile.js:200` affiche `consequences`, plus personne ne lit celle-ci
        // (0 appelant, verifie). On la corrige quand meme plutot que de la
        // supprimer, pour qu elle ne mente plus si on la rebranche un jour.
        subtitle: 'Ton compte sera désactivé et tes informations personnelles effacées.'
          + ' Cette action est définitive.',
        title: 'Supprimer ton compte ?',
      },
      maxAccounts: {
        message: 'Tu ne peux pas connecter plus de {{count}} comptes sur cet appareil.',
        title: 'Limite atteinte',
      },
    },
    // AA11 (D-26) — « le joueur dans deux clubs, ca marche. Mais quand je
    // regarde dans mon profil, je ne vois que le premier club. » Ce bloc
    // n'apparait qu'a partir de DEUX clubs : avec un seul, la sous-ligne
    // d'identite le nomme deja, et une liste d'un element serait du bruit.
    clubs: {
      title: 'Mes clubs',
    },
    fields: {
      // AA11 — ces six libelles vivaient en REPLI dans le code des ecrans
      // (`ProfileEdit.js`, `SelfProfilePlayerCoach.js`). Ils sont remontes ici
      // sans changer d'un caractere : la confirmation d'enregistrement les
      // nomme, et un mot d'ecran ne peut pas vivre a deux endroits.
      avatar: {
        label: 'Photo de profil',
      },
      bestLevel: {
        label: 'Meilleur niveau',
        placeholder: 'Sélectionner un niveau',
      },
      birthdate: {
        label: 'Date de naissance',
        placeholder: 'JJ/MM/AAAA',
      },
      category: {
        label: 'Catégorie',
        placeholder: 'Sélectionner une catégorie',
      },
      city: {
        label: 'Ville',
        placeholder: 'Rechercher une ville',
      },
      email: {
        label: 'Email',
      },
      firstname: {
        label: 'Prénom',
        placeholder: 'Luc',
      },
      height: {
        label: 'Taille (m)',
        placeholder: '1,80',
      },
      isLookingForClub: {
        helper: 'Ton profil apparaît dans la recherche des clubs et des coachs.',
        label: 'Profil visible',
      },
      jerseyNumber: {
        label: 'Numéro de maillot',
        placeholder: 'Ex. 10 (vide = automatique)',
      },
      lastname: {
        label: 'Nom',
        placeholder: 'Harne',
      },
      nationality: {
        label: 'Nationalité',
        placeholder: 'Ex. Française, FRA…',
      },
      phoneNumber: {
        label: 'Numéro de téléphone',
        placeholder: '+33612345678',
      },
      position: {
        label: 'Poste',
        placeholder: 'Ailier',
      },
      preferredSport: {
        label: 'Sport de préférence',
        placeholder: 'Sélectionner un sport',
      },
      section: {
        label: 'Section',
        placeholder: 'Sélectionner une section',
      },
      sections: {
        female: 'Féminine',
        male: 'Masculine',
      },
      sportsHistory: {
        label: 'Historique sportif',
      },
      types: {
        coach: 'Entraîneur·e',
        player: 'Joueur·se',
        president: 'Dirigeant·e',
      },
      weight: {
        label: 'Poids (kg)',
        placeholder: '80',
      },
    },
    identity: {
      roles: {
        coach: 'Entraîneur',
        new: 'Membre',
        player: 'Joueur',
        president: 'Dirigeant',
        superAdmin: 'Administrateur',
      },
      roleWithClub: '{{role}} · {{club}}',
    },
    // AA11 — LA PHRASE QU'ADEL DEMANDE (« felicitations, votre (info) a ete
    // modifiee »), et elle NOMME toujours ce qui a change. Le libelle insere
    // vient de `profile.fields.*.label` ci-dessus : c'est le mot que la
    // personne vient de lire au-dessus de sa saisie, jamais un synonyme.
    // ⚠️ La tournure est volontairement IMPERSONNELLE (« la modification est
    // bien enregistree ») : « ton » ou « ta » devant un libelle oblige a
    // connaitre son genre, et « ton date de naissance » serait faux.
    // Table des champs : `services/profile/profileSaveConfirmation.js`.
    saveConfirmation: {
      eyebrow: 'PROFIL',
      many: '{{count}} informations de ton profil sont bien enregistrées.',
      one: '{{field}} : la modification est bien enregistrée.',
      title: 'C’est enregistré',
      two: '{{first}} et {{second}} : les modifications sont bien enregistrées.',
    },
    sections: {
      account: 'Compte',
      administration: 'Administration',
      profileActivity: 'Profil & activité',
    },
    // L33 — le parcours Abonnement est en trois ecrans : le hub (gerer), le
    // carrousel (choisir) et la matrice (comparer). Ces cles nomment les
    // rangees du hub et les entetes natifs des deux ecrans pousses.
    subscription: {
      actions: {
        changeOffer: 'Changer d\'offre',
        compareOffers: 'Comparer les offres',
        restore: 'Restaurer mes achats',
        viewClub: 'Voir mon club',
        viewClubHint: 'Demandes · certification',
        viewOffers: 'Voir les offres',
      },
      compareHeaderTitle: 'Comparer',
      cta: 'Voir le détail des offres',
      headerTitle: 'Abonnement',
      offersHeaderTitle: 'Changer d\'offre',
      quota: {
        labels: {
          EVENT_PUBLISH: 'Événements',
          FREE_TEAM: 'Équipes',
          MATCH_PUBLISH: 'Matchs',
          RECRUITMENT_AD_PUBLISH: 'Recrutement',
        },
        remaining_one: '{{count}} offert restant',
        remaining_other: '{{count}} offerts restants',
        used: 'offert utilisé',
      },
      states: {
        club: 'Club · actif',
        clubUnverified: 'Club · actif',
        free: 'Gratuit',
        team: 'Équipe',
      },
      status: {
        club: 'Les droits Club sont actifs sur tout ton club.',
        clubUnverified: 'Tes droits Club sont actifs. Ton club est en cours de certification par la plateforme.',
        free: 'Tu utilises l\'offre gratuite FoundClub.',
        team: 'Tes équipes couvertes profitent des droits Équipe.',
      },
      title: 'Mon abonnement',
    },
    subtitles: {
      avatar: "Ajoute une photo de profil pour que l'on puisse te reconnaître facilement.",
      birthdate: 'Renseigne ta date de naissance.',
      name: 'Renseigne ton nom et prénom.',
      section: 'Elle filtre les équipes et les annonces qui te concernent.',
      type: 'Ta fonction principale — tu pourras en ajouter d\'autres plus tard.',
    },
    titles: {
      avatar: 'Une photo de profil ?',
      birthdate: 'Quelle est ta date de naissance ?',
      edit: 'Modifier mes informations',
      name: "Comment t'appelles-tu ?",
      profile: 'Mon compte',
      section: 'Dans quelle section joues-tu ?',
      type: 'Quel est ton statut ?',
    },
    updateError: 'Impossible d\'enregistrer ton profil pour le moment. Vérifie ta connexion et réessaie.',
  },
  recruitment: {
    invite: {
      action: 'Inviter dans l\'équipe',
      needsAccount: 'Cette personne n\'a pas encore de compte FoundClub : impossible de l\'inviter.',
      sent: 'Invitation envoyée',
    },
  },
  register: {
    actions: {
      register: 'Continuer',
    },
    fields: {
      phoneNumber: {
        label: 'Numéro de téléphone',
        placeholder: '0612345678',
      },
    },
    subtitle: 'Renseigne ton numéro de téléphone.',
    title: 'Crée ton compte',
  },
  requests: {
    approvedSuccess: 'La demande est validée.',
    rejectConfirmMessage: 'Cette demande sera refusée et la personne prévenue.',
    rejectConfirmTitle: 'Refuser cette demande ?',
    rejectedSuccess: 'La demande est refusée.',
  },
  requestsHub: {
    actionError: 'Impossible de traiter la demande.',
    assignNow: 'Assigner maintenant',
    // Y04 — LA FENETRE QUI DIT CE QUI VIENT DE CHANGER, demande d'Adel du
    // 2026-08-19. Une phrase par type de demande : « acceptée » ne dit pas si
    // quelqu'un est entré dans une équipe, si un match est confirmé, ou si un
    // créneau est accordé. La table qui les choisit vit dans
    // services/requests/requestAcceptanceCelebration.js.
    // ⚠️ `{{name}}` est remplacé À LA MAIN par l'écran : le repli passé en
    // second argument de `t` n'est pas interpolé par i18next.
    celebration: {
      close: 'Super',
      club: '{{name}} rejoint le club.',
      event: 'La participation est validée.',
      featured: "L'événement passe à la une.",
      friendly: 'Le match est confirmé.',
      installation: 'La place supplémentaire est accordée.',
      interest: 'Ta réponse est partie.',
      someone: 'Un nouveau membre',
      team: "{{name}} rejoint l'équipe.",
      title: 'Félicitations',
      unknown: 'La demande est acceptée.',
    },
    clubAssignedMessage: "{{name}} a été ajouté au club. Veux-tu l'assigner à une équipe maintenant ?",
    clubAssignedTitle: 'Entraîneur ajouté',
    clubClaimAssignedMessage: '{{name}} a été ajouté comme dirigeant du club.',
    clubClaimAssignedTitle: 'Dirigeant ajouté',
    empty: 'Aucune demande en attente',
    filters: {
      all: 'Toutes',
      club: 'Club',
      event: 'Événement',
      featured: 'À la une',
      team: 'Équipe',
    },
    forbidden: 'Cet onglet est réservé aux entraîneur·e·s et aux dirigeant·e·s.',
    migratedBannerAction: "Ouvrir l'onglet Demandes",
    migratedBannerTitle: 'Ce flux a été migré vers Demandes.',
    partialError: 'Source indisponible',
    // Y04 — la bannière d'erreur n'avait AUCUN bouton : elle nommait la panne et
    // s'arrêtait là. Un 403 n'y arrive jamais (le service le laisse tomber en
    // silence), donc ce qui reste affiché est toujours réessayable.
    partialErrorRetry: 'Réessayer',
    rejectEventMessage: 'L\'événement sera annulé.',
    rejectEventTitle: 'Refuser la demande ?',
    rejectFeaturedMessage: 'Le demandeur sera notifié du refus.',
    rejectFeaturedTitle: 'Refuser la demande ?',
    title: 'Demandes',
    types: {
      club: 'Club',
      event: 'Événement',
      featured: 'À la une',
      // R02 — ces trois-la manquaient : la banniere d'erreur les nommait
      // « Demande », le libelle fourre-tout. Une section indisponible qui ne dit
      // pas laquelle ne se diagnostique pas.
      friendly: 'Match amical',
      installation: 'Installation',
      interest: 'Intérêt',
      team: 'Équipe',
      unknown: 'Demande',
    },
  },
  // L16 — chaque bouton dit CE QU'ON OBTIENT (un fichier, un format), jamais un
  // verbe abstrait. `share` porte desormais le geste principal : envoyer l'AFFICHE.
  showcase: {
    // AA08 : la croix de sortie, en haut a droite. L'ecran est `headerShown: false`
    // et n'avait aucune sortie visible en haut (constat d'Adel du 2026-08-20).
    close: 'Fermer',
    customize: 'Personnaliser le texte',
    customizeHint: 'Modifie les textes avant de télécharger. Laisse vide pour garder le texte proposé.',
    downloadError: 'Le téléchargement a échoué. Vérifie ta connexion et réessaie.',
    error: 'Le visuel n\'a pas pu être généré.',
    // X01 : le titre héros des gabarits Tournoi et Neutre. Le serveur ne PEUT PAS
    // connaître le titre d'un événement (`event.name` est réécrit en « Type - date
    // - Équipe » à chaque enregistrement) : c'est ici que l'organisateur l'écrit.
    evenement: {
      placeholderTitre: 'Notre événement',
    },
    fieldEquipe: 'Équipe',
    fieldLieu: 'Lieu',
    fieldNiveau: 'Niveau',
    fieldQrLabel: 'Texte sous le QR code',
    fieldTitre: 'Titre',
    fieldTitreAccent: 'Accroche',
    // T04 : le « encore {{seconds}} s environ » de S07 est PARTI. La mesure du
    // 2026-08-17 va de 3,1 s à 22,9 s selon la charge du serveur (renderProgress.js) :
    // aucun nombre n'était vrai, et le dépassement se déclenchait à tous les coups.
    // La phrase dit qu'on travaille, elle ne promet plus de durée.
    generating: 'Ton affiche se fabrique…',
    // 🔒 La phrase de l'attente ANORMALE — au-delà du pire cas mesuré (13 s). Elle
    // parle du temps DÉJÀ écoulé, la seule chose que le téléphone sache vraiment,
    // et elle reste vraie à la 60e seconde.
    generatingLonger: 'Ton affiche se fabrique toujours — c’est plus long que d’habitude.',
    later: 'Plus tard',
    // R05 : sur Android, « ouvrir avec » ne transporte que l'image — le texte est
    // mis dans le presse-papiers. On le DIT, sinon personne ne pense à le coller.
    messageCopied: 'Le texte est copié : colle-le avec l’image.',
    // Android : la feuille de partage de React Native jette le fichier (cf. L20).
    // Le geste devient « enregistrer, puis ouvrir avec » — les libellés le disent.
    openWith: 'Ouvrir l’affiche avec…',
    placeholderQrLabel: 'Scanne pour participer',
    placeholderQrLabelDecouverte: 'Scanne pour essayer',
    placeholderTitre: 'Viens montrer',
    placeholderTitreAccent: 'ce que tu vaux.',
    placeholderTitreAccentDecouverte: 'tu vas aimer.',
    placeholderTitreDecouverte: 'Viens essayer,',
    poster: 'Affiche A4 à imprimer',
    posterHint: 'Fichier PDF, prêt pour l’imprimante du club.',
    posterHintSave: 'Fichier PDF enregistré dans tes téléchargements, '
      + 'prêt pour l’imprimante du club.',
    // T04 : la story (9:16) et l'A4 sont d'AUTRES images que l'aperçu 4:5 — le
    // serveur DOIT les fabriquer. Sans cette phrase, l'attente ressemblait à une
    // régénération inutile de ce qu'on a déjà sous les yeux, donc à un bug.
    preparingOtherFormat: 'On prépare la version à partager — '
      + 'c’est une autre image que celle à l’écran.',
    // AA08 : le serveur de rendu a refuse de fabriquer le fichier (HTTP >= 400).
    // ⛔ Ne JAMAIS retomber ici sur « verifie ta connexion » : l'apercu vient
    // d'arriver par le meme reseau, la panne est ailleurs.
    renderError: 'L’affiche n’a pas pu être fabriquée par le serveur. '
      + 'Réessaie dans un instant.',
    reset: 'Réinitialiser',
    retry: 'Réessayer',
    save: 'Enregistrer l’affiche',
    savedDownloads: 'C’est enregistré dans tes téléchargements.',
    savedGallery: 'C’est enregistré dans ta galerie photo.',
    saveError: 'L’enregistrement a échoué. '
      + 'Il reste peut-être trop peu de place sur ton téléphone.',
    saveHint: 'Elle part dans ta galerie photo, telle que tu la vois. '
      + 'Tu choisis ensuite l’application qui l’ouvre.',
    savePermissionError: 'FoundClub n’a pas le droit d’enregistrer dans ton téléphone. '
      + 'Autorise-le dans les réglages, puis réessaie.',
    sendInChat: 'Envoyer dans une conversation',
    sendInChatHint: 'Directement dans une discussion FoundClub.',
    share: 'Envoyer l’affiche',
    shareHint: 'L’image part telle que tu la vois. Dans la fenêtre de partage, tu peux aussi l’enregistrer dans ton téléphone.',
    shareIntro: 'Viens participer à notre détection / séance d’essai !',
    // D94/C2 : le message de partage suit le TYPE de l'événement. `shareIntro`
    // ci-dessus reste le défaut du gabarit (club, annonce, lien profond sans type).
    shareIntroByType: {
      detection: 'Viens participer à notre détection / séance d’essai !',
      entrainement: 'Rendez-vous à l’entraînement !',
      match: 'Viens nous encourager pour ce match !',
      neutre: 'Voici notre prochain événement !',
      reservation: 'Voici les infos de cette réservation.',
      stage: 'Découvre notre stage !',
      tournoi: 'Viens vivre notre tournoi !',
    },
    shareLabel: 'Voir l’événement',
    story: 'Version story 9:16',
    storyHint: 'Image verticale plein écran, pour Instagram, WhatsApp ou Snap.',
    storyHintSave: 'Image verticale plein écran, enregistrée dans ta galerie, '
      + 'pour Instagram, WhatsApp ou Snap.',
    subtitle: 'Fais-le voir. Plus il est vu, plus tu remplis.',
    title: 'Ton événement est en ligne',
    variantHint: 'Choisir le style {{label}}',
  },
  squadDetails: {
    actions: {
      deleteTeam: 'Supprimer la squad',
      deleteTeamError: 'Impossible de supprimer la squad.',
      edit: 'Modifier',
      editTeam: 'Modifier la squad',
      menuDescription: 'Choisis une action.',
      menuTitle: 'Actions squad',
      openRequests: 'Voir les demandes',
      requests: 'Demandes',
      unavailableTitle: 'Action non disponible',
    },
    defaultName: 'Squad',
    delete: {
      confirmationWithName: 'Es-tu sûr de vouloir supprimer la squad "{{teamName}}" ? Cette action est irréversible.',
      title: 'Supprimer la squad',
    },
    join: {
      pending: 'Demande en attente...',
      request: 'Demander à rejoindre',
    },
    labels: {
      locationUnknown: 'Localisation non renseignée',
    },
    roster: {
      captain: 'Capitaine',
      player: 'Joueur',
      title: 'Effectif',
    },
    slots: {
      added: 'Créneau ajouté',
      addTitle: 'Ajouter un créneau',
      deleteConfirm: 'Veux-tu vraiment supprimer ce créneau ?',
      deleted: 'Créneau supprimé',
      deleteError: 'Impossible de supprimer le créneau',
      editTitle: 'Modifier le créneau',
      joinHint: 'Rejoins la squad pour participer aux créneaux.',
      multipleAdded: '{{count}} créneaux ajoutés',
      saveError: 'Impossible de sauvegarder le créneau',
      statusError: 'Impossible de modifier ton statut.',
      updated: 'Créneau modifié',
    },
  },
  // L11 — écran d'après-achat : la liste reflète la matrice serveur
  // (subscription-permission.ts) via getSubscriptionUnlockedCapabilities,
  // ne pas y ajouter une capacité que le serveur ne débloque pas.
  subscriptionSuccess: {
    firstActions: {
      club: 'Gérer mon club',
      composition: 'Préparer ma compo',
      events: 'Publier un événement ou un match',
      recruitment: 'Publier une annonce de recrutement',
    },
    firstActionTitle: 'Que veux-tu faire en premier pour profiter de ton abonnement ?',
    unlockedTitle: 'Ton offre débloque :',
    unlocks: {
      clubRoles: 'Gestion des entraîneurs et dirigeants',
      clubTeams: 'Toutes les équipes du club couvertes',
      composition: 'Composition et convocations',
      dues: 'Campagnes de cotisations',
      events: 'Événements et matchs illimités',
      facilities: 'Installations du club',
      recruitment: 'Annonces de recrutement illimitées',
      sponsors: 'Sponsors du club',
      teams: 'Équipes supplémentaires',
    },
    // Tour 7a — version courte des mêmes libellés pour la grille à 2 colonnes.
    // Raccourci d'AFFICHAGE seulement : la liste vient toujours de
    // getSubscriptionUnlockedCapabilities. Une capacité absente d'ici retombe
    // sur son libellé long ci-dessus (`teams` est dans ce cas), elle ne
    // disparaît jamais de l'écran.
    unlocksShort: {
      clubRoles: 'Rôles du club',
      clubTeams: 'Toutes les équipes du club',
      composition: 'Compo & convocations',
      dues: 'Cotisations',
      events: 'Événements illimités',
      facilities: 'Installations',
      recruitment: 'Annonces illimitées',
      sponsors: 'Sponsors',
    },
  },
  superAdminContentManager: {
    actions: {
      addId: 'Ajouter ID',
      apply: 'Appliquer',
      cancel: 'Annuler',
      close: 'Fermer',
      copyId: 'Copier ID',
      createEntry: 'Créer une entrée',
      delete: 'Supprimer',
      deleteEntry: 'Supprimer l\'entrée',
      deleting: 'Suppression...',
      edit: 'Modifier',
      exitSelection: 'Quitter sélection',
      hide: 'Masquer',
      more: 'Plus d actions',
      multiSelect: 'Sélection multiple',
      next: 'Suivant',
      previous: 'Précédent',
      processing: 'Traitement...',
      publish: 'Publier',
      refresh: 'Rafraîchir',
      remove: 'Retirer',
      save: 'Enregistrer',
      saving: 'Enregistrement...',
      search: 'Chercher',
      selectAll: 'Tout sélectionner',
      show: 'Afficher',
      unpublish: 'Dépublier',
      unselectAll: 'Tout desélectionner',
    },
    alerts: {
      bulkFailedTitle: 'Action de masse impossible',
      copyFailedTitle: 'Copié impossible',
      deleteFailedTitle: 'Suppression impossible',
      emptySelectionMessage: 'Sélectionne au moins une entrée.',
      emptySelectionTitle: 'Sélection vide',
      filePickerUnavailable: 'Le sélecteur de fichiers est indisponible sur cette build.',
      fileResolveFailed: 'Impossible de récupérer ce fichier.',
      fileSelectFailed: 'Impossible de sélectionner ce fichier.',
      openCameraFailed: 'Impossible d\'ouvrir la caméra.',
      openGalleryFailed: 'Impossible d\'ouvrir la galerie.',
      reasonRequiredMessage: 'Minimum 3 caractères.',
      reasonRequiredTitle: 'Raison requise',
      relationSearchFailedTitle: 'Recherche impossible',
      relationSearchMinChars: 'Merci de saisir au moins 1 caractère.',
      relationSearchTitle: 'Recherche relation',
      saveFailedTitle: 'Enregistrement impossible',
      takePhotoFailed: 'Impossible de prendre une photo.',
      uploadFailedTitle: 'Upload impossible',
      uploadNoFile: 'Aucun fichier n\'a été reçu par le serveur.',
      validationTitle: 'Validation',
    },
    bulkModal: {
      description: 'entrée(s) seront traitées. Une raison d\'audit est obligatoire.',
      reasonPlaceholder: 'Raison obligatoire (minimum 3 caractères)',
      titleSuffix: 'les entrées',
    },
    common: {
      genericError: 'Une erreur est survenue.',
      id: 'ID',
      reason: 'Raison',
      unknown: 'inconnue',
    },
    deleteModal: {
      description: 'Action définitive. Une raison d\'audit est obligatoire.',
      reasonPlaceholder: 'Raison obligatoire (minimum 3 caractères)',
      title: 'Supprimer l\'entrée',
    },
    detail: {
      createdAt: 'Crée le',
      noAudit: 'Aucun log disponible.',
      noKeyFields: 'Aucun champ clé détecté.',
      noRelations: 'Aucune relation ou média exploitable.',
      rawJsonCollapsed: 'Vue avancée repliée pour garder l\'écran lisible.',
      sections: {
        audit: 'Audit récent',
        keyFields: 'Champs clés',
        rawJson: 'JSON complet',
        relationsMedia: 'Relations / Médias',
        summary: 'Résumé',
      },
      shortId: 'ID court',
      updatedAt: 'Modifié le',
    },
    empty: {
      explorerDescription: 'Ajuste la recherche ou vérifie les permissions Super Admin.',
      explorerTitle: 'Aucun content-type trouvé',
      listDescription: 'Aucune donnée ne correspond aux filtres actifs.',
      listTitle: 'Aucune entrée',
    },
    explorer: {
      collectionType: 'collection type',
      draftPublish: 'draft + publish',
      results: 'Résultats',
      searchPlaceholder: 'Rechercher un content-type',
      singleType: 'single type',
      subtitle: 'Parcours tous les content-types API Strapi.',
      title: 'Explorer Content Manager',
      types: 'Types',
    },
    feedback: {
      bulkApplied: 'action(s) appliquée(s)',
      clipboardUnavailable: 'Copié indisponible sur cette build',
      entryDeleted: 'Entrée supprimée',
      idCopied: 'ID copié',
    },
    form: {
      allowedTypes: 'Types autorisés',
      documentIdToAdd: 'documentId à ajouter',
      editableFields: 'Champs éditables',
      mediaMultipleAllowed: 'Média multiple autorisé',
      mediaSingle: 'Média unique',
      no: 'Non',
      noEditableFields: 'Aucun champ détecté',
      noMediaSelected: 'Aucun média sélectionné.',
      none: 'Aucun',
      rawFallbackHint: 'Champs non totalement supportés en mode guide:',
      rawFallbackTitle: 'Fallback JSON avancé',
      reasonLabel: 'Raison (optionnelle sauf règles sensibles)',
      reasonPlaceholder: 'Ajouter un contexte d\'audit',
      relationDocumentId: 'documentId relation',
      relationTo: 'Relation vers',
      searchRelationPlaceholder: 'Rechercher une relation...',
      sections: {
        advanced: 'Avancé',
        advancedHint: 'JSON, rich text et champs complexes.',
        booleanEnum: 'Booléens / Enums',
        booleanEnumHint: 'Valeurs à choix rapide.',
        media: 'Médias',
        mediaHint: 'Ajoute images ou fichiers.',
        relations: 'Relations',
        relationsHint: 'Associe des entrées liées.',
        scalars: 'Scalaires',
        scalarsHint: 'Texte, nombres et dates.',
      },
      titleCreate: 'Créer une entrée',
      titleEdit: 'Modifier une entrée',
      type: 'Type',
      uploading: 'Upload en cours...',
      yes: 'Oui',
    },
    list: {
      page: 'Page',
      searchPlaceholder: 'Rechercher une entrée',
      selectedEntries: 'entrée(s) sélectionnée(s)',
      total: 'Total',
      updatedPrefix: 'Maj:',
    },
    media: {
      camera: 'Caméra',
      file: 'Fichier',
      gallery: 'Galerie',
    },
  },

  /* eslint-disable perfectionist/sort-objects */
  reservationFilters: {
    fields: {
      maxPrice: {
        label: 'Prix maximum par personne',
        placeholder: 'Ex: 20',
      },
      startTime: {
        label: '? partir de',
        placeholder: 'Heure de début',
      },
    },
  },

  reservation: {
    actions: {
      cancelRequest: 'Annuler la demande',
      participate: 'Réserver',
      requestFeatured: 'Demander la mise à la une',
    },
    bookFull: {
      error: 'Impossible de réserver le créneau entier.',
    },
    card: {
      missingPlayers: 'Il manque {{count}} joueur',
      missingPlayers_plural: 'Il manque {{count}} joueurs',
      pricePerPerson: '{{price}}€/pers',
    },
    featured: 'À la une :',
    featuredRequest: {
      approved: 'Approuvée',
      cancelError: 'Erreur lors de l\'annulation',
      cancelSuccess: 'Demande annulée',
      pending: 'Demande en attente',
      rejected: 'Refusée',
      requestError: 'Erreur lors de l\'envoi de la demande',
      requestSuccess: 'Demande envoyée avec succès',
      title: 'Mise en avant',
    },
    filters: {
      detections: 'Détections',
      openTrainings: 'Entraînements ouverts',
      tournaments: 'Tournois',
    },
    joinError: 'Impossible de rejoindre cette réservation.',
    mode: {
      fullGroup: 'J\'ai déjà mon groupe complet',
      invalidPlayerCount: 'Merci de entrer un nombre validé',
      playerCount: 'Combien de joueurs as-tu ?',
      recruiting: 'Il me manque des joueurs',
      selectMode: 'Merci de sélectionner un mode',
      title: 'Comment veux-tu participer ?',
      tooManyPlayers: 'Le nombre doit être inférieur au total',
    },
    noData: 'Aucune réservation trouvée.',
    openForPlayers: {
      error: 'Impossible d’ouvrir ce créneau aux joueurs.',
    },
    sosAlert: {
      error: 'Impossible d’envoyer l’alerte SOS.',
    },
    title: 'Événements :',
  },
  searchTypeSwitcher: {
    amicaux: 'Matchs amicaux',
    recruitment: 'Recrutement',
  },
  teamSlotList: {
    add: '+ Ajouter',
    checkInSoon: 'Check-in bientôt disponible.',
    comingSoon: 'Bientôt disponible',
    confirmedPlayers: 'Joueurs confirmés',
    cta: {
      confirmPresence: 'Je suis présent',
      removePresence: 'Retirer ma présence',
    },
    empty: 'Aucun créneau défini.',
    joinHint: 'Rejoindre la squad pour participer.',
    memberHelp: 'Touche pour confirmer ta présence.',
    status: {
      complete: 'Complet',
      confirmed: '{{count}}/{{required}} confirmés',
      remaining: 'Encore {{count}}',
    },
    title: 'Disponibilités (créneaux)',
  },
  teamDetails: {
    actions: {
      contactTeam: 'Contacter',
      defaultComposition: 'Composition type',
      edit: 'Modifier',
      join: "C'est mon équipe !",
      leave: "Quitter l'équipe",
      openPanel: 'Ouvrir',
      panelTitle: "Actions d'équipe",
      stats: 'Statistiques',
      teamChat: 'Équipe',
    },
    alerts: {
      deleteTrainer: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer du club',
        },
        description: 'Le compte ne sera pas supprimé, mais l\'entraîneur·e ne sera plus lié·e au club ni à aucune de ces équipes.'
          + ' Si tu souhaites le retirer seulement de cette équipe merci de passer par le bouton de modification de l\'équipe.',
        title: 'Tu es sur le point de supprimer cet·te entraîneur·e de ton club.',
      },
      invitePlayers: {
        alreadyHaveTheApp: "J'ai déjà l'application",
        downloadOnAndroid: 'Télécharger sur Android',
        downloadOnIOS: 'Télécharger sur iOS',
        message: 'Bonjour !'
          + '\nVotre équipe {{teamName}} de ton club {{clubName}} t\'attend !'
          + "\nTélécharge l'application Found Club pour finaliser la création de ton compte"
          + ' et commencer accéder et participer aux événements de ton équipe.',
        title: 'Tes coéquipiers t\'attendent !',
      },
      joinRequest: {
        actions: {
          ok: 'OK',
        },
        description: 'Ton entraîneur·e va recevoir ta demande et la traiter dès que possible.',
        title: 'Ta demande d\'adhésion a bien été envoyée',
      },
      leave: {
        actions: {
          cancel: 'Annuler',
          confirm: "Quitter l'équipe",
        },
        description: 'Tu es sur le point de quitter l\'équipe. Une fois cette action validée tu ne pourras plus participer aux entraînements et matchs.',
        title: 'Es-tu sûr·e de vouloir quitter cette équipe ?',
      },
    },
    external: {
      prompt: {
        cta: 'Ajouter le classement',
        description: "Tu peux ajouter le lien du classement de ta ligue pour retrouver directement dans l'application ton classement, ton calendrier et tes statistiques.",
        title: 'Ajoute le classement de ta ligue',
      },
    },
    invitation: {
      accept: 'Accepter',
      error: 'Impossible de répondre à cette invitation pour le moment.',
      message: 'Le staff de cette équipe t\'invite à la rejoindre. À toi de décider.',
      refuse: 'Refuser',
      title: 'Invitation',
    },
    myTitle: 'Mon équipe',
    sections: {
      nextEvents: 'Prochains événements',
      players_one: 'Joueur·se',
      players_other: 'Joueur·se·s',
      trainers_one: 'Entraîneur·e',
      trainers_other: 'Entraîneur·e·s',
    },
    stats: {
      summaryHint: 'Consulte les statistiques détaillées de ton équipe.',
    },
    tabs: {
      calendar: 'Calendrier',
      infos: 'Infos',
      standings: 'Classement',
      stats: 'Stats',
    },
    title: 'Équipe',
  },
  /* eslint-enable perfectionist/sort-objects */
  teamEdit: {
    actions: {
      save: 'Enregistrer',
    },
    fields: {
      activities: {
        label: 'Sports',
        placeholder: 'Sélectionner un sport',
      },
      category: {
        label: 'Catégorie',
        placeholder: 'Sélectionner une catégorie',
      },
      description: {
        label: 'Description',
        placeholder: 'Équipe senior évoluant en championnat régional depuis 2015.',
      },
      level: {
        label: 'Niveau',
        placeholder: 'Sélectionner un niveau',
      },
      name: {
        label: 'Nom de l\'équipe',
        placeholder: 'Les lions de Marseille',
      },
      section: {
        label: 'Section',
        placeholder: 'Sélectionner une section',
      },
      trainers: {
        label: 'Entraîneur·e·s',
        placeholder: 'Sélectionner un·e entraîneur·e',
      },
    },
    title: 'Créer une équipe',
    titleEdit: "Modifier l'équipe",
  },
  teamFilters: {
    actions: {
      apply: 'Appliquer les filtres',
      clear: 'Effacer les filtres',
    },
    fields: {
      activities: {
        label: 'Sports',
        placeholder: 'Sélectionner un sport',
      },
      category: {
        label: 'Catégorie',
        placeholder: 'Sélectionner une catégorie',
      },
      level: {
        label: 'Niveau',
        placeholder: 'Sélectionner un niveau',
      },
      section: {
        label: 'Section',
        placeholder: 'Sélectionner une section',
      },
    },
  },
  teamList: {
    actions: {
      add: 'Ajouter une équipe',
    },
    alerts: {
      maxTeamLimitReached: {
        actions: {
          cancel: 'Abandon',
          contact: 'Contacter Found Club',
        },
        description: 'Tu as atteint le nombre maximum d\'équipes autorisées dans ton club. Merci de contacter Found Club pour débloquer cette limite.',
        title: 'Limite d\'équipes atteinte',
      },
    },
    badges: {
      coach: 'COACH',
      invitation: 'INVITATION',
      pending: 'EN ATTENTE',
      player: 'JOUEUR·SE',
    },
    fields: {
      category: 'Catégorie',
      level: 'Niveau',
      members: 'Membres',
      section: 'Section',
    },
    noData: 'Aucune équipe trouvée.',
    pendingNotice: {
      claim: {
        unblocks: 'Une fois acceptée, tu deviens dirigeant·e du club et tu peux créer tes équipes.',
        waiting: 'Ta demande pour diriger ce club',
        who: 'FoundClub vérifie que tu diriges bien ce club. Tu n\'as rien à faire de ton côté.',
      },
      clubJoin: {
        unblocks: 'Une fois acceptée, tu fais partie du club.',
        waiting: 'Ta demande pour rejoindre ce club',
        who: 'Un·e dirigeant·e du club doit l\'accepter.',
      },
      teamInvite: {
        unblocks: 'Si tu acceptes, tu rejoins l\'effectif.',
        waiting: 'Cette équipe t\'invite',
        who: 'Ouvre la fiche de l\'équipe pour accepter ou refuser.',
      },
      teamJoin: {
        unblocks: 'Une fois acceptée, tu rejoins l\'effectif.',
        waiting: 'Ta demande pour rejoindre cette équipe',
        who: 'Le staff de l\'équipe doit l\'accepter.',
      },
    },
    searchPlaceholder: 'Mes équipes',
    stats: {
      members: 'Membres',
      trainers: 'Entraîneur·e·s',
    },
    title: 'Équipes de mon club',
  },
  teamMembershipRequestList: {
    actions: {
      accept: 'Accepter',
      reject: 'Refuser',
    },
    fields: {
      accepted: 'Demande acceptée',
      pending: "{{firstname}} s'est signalé comme joueur·se de l'équipe",
      rejected: 'Demande refusée',
    },
    noData: 'Aucune demande d\'adhésion en attente',
    title: 'Demandes d\'adhésion',
  },
  userDetails: {
    actions: {
      contact: 'Contacter',
      sendMessage: 'Envoyer un message',
    },
    badges: {
      lookingForClub: 'En recherche de club',
    },
    empty: {
      club: 'Aucun club renseigné',
      coachTeams: 'Aucune équipe entraînée',
      playerTeams: 'Aucune équipe joueur',
    },
    fields: {
      address: 'Adresse',
      age: 'Âge',
      bestLevel: 'Niveau',
      birthdate: 'Date de naissance',
      birthYear: 'Année de naissance',
      category: 'Catégorie',
      email: 'Email',
      height: 'Taille (m)',
      history: 'Historique sportif',
      phone: 'Téléphone',
      position: 'Poste',
      section: 'Section',
      sport: 'Sport',
      weight: 'Poids (kg)',
    },
    historySummary: {
      count: '{{count}} expérience(s)',
    },
    notSet: 'Non renseigné',
    private: 'Privé',
    sections: {
      personal: 'Infos personnelles',
      sport: 'Profil sportif',
    },
    teamGroups: {
      coach: 'Équipes entraînées',
      player: 'Équipes joueur',
    },
    title: 'Infos profil',
    titles: {
      teams: 'Équipes',
    },
  },
  welcome: {
    actions: {
      go: 'Allons-y !',
    },
    descriptions: {
      club: {
        bold: '- Rejoins un club',
        regular: 'et progresse dans ta carrière sportive.',
      },
      info: {
        bold: '- Reste informé·e',
        regular: ' des nouveautés grâce aux notifications',
      },
      register: {
        bold: '- Inscris-toi',
        regular: ' à des entraînements et détections ouverts',
      },
      search: {
        bold: '- Recherche',
        regular: ' des clubs et des événements près de chez toi.',
      },
    },
    subtitle: 'Prêt·e à trouver ton club et évoluer dans le sport ?',
    title: 'Bienvenu·e sur',
  },
};
