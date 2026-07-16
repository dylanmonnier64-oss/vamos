// Dictionnaire FR — source unique des chaînes UI des écrans déjà construits
// (login, dashboard, stepper). Objectif : ajouter une langue = ajouter un
// fichier de même forme, pas chercher les chaînes dans le code.
//
// Hors dictionnaire (volontairement) : la marque « vamos », les mots dispersés
// du hero login (leurs accentIndices sont positionnels, couplés au design),
// « Google »/« Apple » (marques), les codes FFT (P25…). Ce sont des constantes,
// pas de la copy traduisible.
//
// Interpolation : `{placeholder}` remplacé par le helper t() (voir ./index).
// Les suffixes de pluriel ({s...}) sont passés en paramètre par le composant :
// une vraie gestion ICU des pluriels dépasse le cadre de cette fondation.

export const fr = {
  login: {
    metaTitre: 'VAMOS · Connexion',
    tagline: '· Bon retour sur le terrain ·',
    eyebrow: 'Connexion',
    titre: 'Ton terrain, ton match.',
    sousTitre: 'Entre tes identifiants ou continue avec un fournisseur.',
    email: 'E-mail',
    emailPlaceholder: 'toi@vamos.club',
    motDePasse: 'Mot de passe',
    oublie: 'Oublié ?',
    afficherMotDePasse: 'Afficher / masquer le mot de passe',
    seSouvenir: 'Se souvenir de moi',
    entrer: 'Entrer sur le terrain →',
    succes: '¡Vamos! ✓',
    erreurGenerique: 'Connexion impossible. Vérifie tes identifiants.',
    ouContinuer: 'Ou continue avec',
  },

  dashboard: {
    metaTitre: 'VAMOS · Tableau de bord',
    pasDeClub: 'Ce compte n’est rattaché à aucun club. Contacte l’administrateur VAMOS.',
    titre: 'Tournois',
    videTexte:
      'Aucun tournoi pour l’instant. Crée ton premier tournoi pour générer le tableau et lancer les matchs.',
    nouveauTournoi: '+ Nouveau tournoi',
    deconnexion: 'Déconnexion',
    deconnexionEnCours: 'Déconnexion…',
    labelDate: 'Date',
    labelCategorie: 'Catégorie',
    labelEquipes: 'Équipes',
    statutBrouillon: 'Brouillon',
    statutEnCours: 'En cours',
    statutTermine: 'Terminé',
  },

  stepper: {
    eyebrow: 'Nouveau tournoi',
    etapeInfos: 'Infos',
    etapeEquipes: 'Équipes',
    etapeRecap: 'Récap',

    // Étape 1 — infos
    nom: 'Nom du tournoi',
    nomPlaceholder: 'Tournoi P100 Printemps',
    date: 'Date',
    heure: 'Heure de début',
    categorie: 'Catégorie FFT',
    nbTerrains: 'Nombre de terrains',
    nbEquipes: 'Nombre d’équipes',
    // Format
    format: 'Format',
    formatElimination: 'Élimination (Torneo)',
    formatTeamAmericano: 'Team americano (round-robin)',
    pointsCible: 'Points par match',
    nbRoundsLabel: 'Rounds (optionnel)',
    nbRoundsHint: 'Vide = round-robin complet',

    // Étape 2 — équipes
    equipesLabel: 'Équipes (une par ligne — Joueur1 / Joueur2)',
    equipesPlaceholder: 'Marie Dupont / Julie Martin\nThomas Petit / Lucas Bernard\n...',
    equipesSaisies: '{saisi} / {total} équipe{sTotal} saisie{sSaisi}',
    equipesSaisiesOk: ' ✓',
    lignesIllisibles: ' · {n} ligne(s) illisible(s)',
    tetesDeSerie: 'Têtes de série (optionnel, max 4)',
    reinitialiser: 'Réinitialiser les paires',
    echangeAstuce:
      'Clique deux noms pour les échanger entre paires — utile pour corriger une paire mal formée sans retaper le texte.',
    rangAucun: '—',
    teteSerieRang: 'Tête de série {rang}',

    // Étape 3 — récap
    recapTitre: 'Récapitulatif',
    recapTournoi: 'Tournoi',
    recapDate: 'Date',
    recapDateValeur: '{date} à {heure}',
    recapCategorie: 'Catégorie',
    recapEquipes: 'Équipes',
    recapTerrains: 'Terrains',
    recapTetes: 'Têtes de série',
    recapAucune: 'aucune',
    recapVide: '—',
    recapNote:
      'Le tour 1 est généré automatiquement (têtes de série placées, byes si besoin). Tu pourras revoir le bracket avant de lancer le tournoi.',

    // Actions
    precedent: '← Précédent',
    suivant: 'Suivant →',
    creer: 'Créer le tournoi →',
    creation: 'Création…',

    // Erreurs
    errNom: 'Le nom du tournoi est obligatoire.',
    errDate: 'La date est obligatoire.',
    errMin2: 'Il faut au moins 2 équipes.',
    errLigne: 'Ligne illisible : "{ligne}". Format attendu : Joueur1 / Joueur2.',
    errNbEquipes:
      'Tu as annoncé {attendu} équipe{sAttendu} à l’étape 1, mais {saisi} {verbe}. Ajuste la liste ou le nombre d’équipes.',
    errVerbeSing: 'est saisie',
    errVerbePluriel: 'sont saisies',
    errGenerique: 'Une erreur est survenue.',
  },
} as const
