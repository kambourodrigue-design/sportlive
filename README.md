# ScoreAfrica

Scores de football en direct (React + Vite + Express). Fonctionne sans clé en mode démonstration.

## Lancer en local
1. Installer Node.js 20+
2. `npm install`
3. (Optionnel) copier `.env.example` en `.env` et renseigner `API_FOOTBALL_KEY`
4. `npm run dev` puis ouvrir http://localhost:3000
5. Vérifier la connexion API : http://localhost:3000/api/status

## Mise en ligne : GitHub -> Cloudflare (Workers Builds)
1. Pousser ce dossier sur un dépôt GitHub.
2. Cloudflare > Workers & Pages > Create > Import a repository (GitHub) > choisir le dépôt.
3. Build command : `npm run build` | Deploy command : `npx wrangler deploy`
4. Après le 1er déploiement : Settings > Variables and Secrets > ajouter les secrets `API_FOOTBALL_KEY` et `ANTHROPIC_API_KEY` (pronostics IA).
5. Chaque `git push` redéploie automatiquement.
Test local du Worker : créer `.dev.vars` avec `API_FOOTBALL_KEY=...` puis `npm run cf:dev`.

## Limites connues
Les scores, buts et cartons sont réels. Possession, xG, tirs et compositions restent des valeurs fictives.

## Pronostics IA et historique
- `/api/picks` : 3 matchs maximum, cache 6 h. `/api/picks/history` : résultats et taux de réussite.
- L'historique est stocké dans le KV `CACHE` : sans KV (ou en local), il est perdu au redémarrage.
- Matchs par date : `/api/fixtures/date` (plage de ±7 jours). Certains plans API-Football gratuits limitent les dates accessibles.

## Modèles IA (DeepSeek + Claude)
Secrets : `DEEPSEEK_API_KEY` et/ou `ANTHROPIC_API_KEY`. Avec les deux, DeepSeek est essayé d'abord (V4 Pro, puis V4 Flash ; `AI_PRIMARY=claude` pour inverser) et Claude prend le relais en cas d'erreur. Avec une seule clé, seul ce modèle est utilisé. Le taux de réussite est affiché par modèle dans l'historique.

## Actualités
Flux RSS gratuits de Maxifoot (`/api/news`, cache 15 min, `NEWS_CACHE_SECONDS` pour changer) : titre, court extrait et lien vers l'article d'origine. Les photos de la source ne sont pas affichées. Pour un usage commercial, vérifier les conditions auprès de Maxifoot.

## Rédaction maison (page /admin)
- Ajoute le secret `ADMIN_PASSWORD` dans Cloudflare, puis ouvre `ton-site/admin`.
- Assistant IA : tu fournis les faits, l'IA rédige sans rien inventer (`[À VÉRIFIER]` pour ce qui manque) ; la publication est bloquée tant que ces marques restent dans le texte.
- Les articles sont stockés dans le KV `CACHE`. Les articles publiés apparaissent en premier dans l'onglet Actualités, lisibles dans l'app.

## Pages et navigation
- Adresses : `/` (accueil), `/championnat/:id`, `/equipe/:id`, `/match/:id`, `/a-propos`, `/contact`, `/confidentialite`, `/conditions`, `/cookies`, `/jeu-responsable`. Le routeur est dans `src/router.tsx` ; Cloudflare renvoie `index.html` pour toutes ces adresses.
- Sports : football, basket (API-Sports) et tennis (affiché « bientôt disponible », aucun fournisseur branché).
- Championnats africains : `/api/leagues/africa` interroge l'API une fois par jour (cache 24 h) et garde les compétitions continentales (CAF, CAN...) + la première division de chaque pays. Filtre « Afrique » sur l'accueil.
- Pages championnat/équipe/match : routes `/api/league`, `/api/league/fixtures`, `/api/team`, `/api/fixture` (cache 10 min à 1 h). Certaines demandent un abonnement API-Football qui autorise la saison en cours.
- Page match façon Flashscore : onglets Résumé, Stats, Compos, Stats joueurs, Face-à-face, Classement (routes `/api/fixture/players` et `/api/h2h`). Les pages championnat et équipe partagent la même présentation (en-tête mobile, onglets).
- Historique des pronostics : chaque pronostic est vérifié après le match (score à 90 min, au plus toutes les 5 min + cron), badges Gagné/Perdu, taux global, 7 j, 30 j, forme et série. Rafraîchi toutes les 2 min côté site.
- Performance : thème appliqué avant le premier affichage (script dans index.html), championnats affichés par pages de 12, cache du jour plafonné, polices non bloquantes.
- Formulaire de contact : `/api/contact` ; les messages se lisent dans `/admin` (section « Messages de contact »).

## Comptes et section Pronostics IA
- Onglet « Pronos IA » et bouton « Se connecter » : l'accès aux pronostics exige un compte (e-mail + mot de passe, 8 caractères minimum).
- API : `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`. `/api/picks` et `/api/picks/history` répondent 401 sans session.
- Sécurité : mots de passe hachés (PBKDF2-SHA256 + sel), session dans un cookie HttpOnly de 30 jours, blocage 15 min après 5 échecs, 10 créations de compte par heure et par IP.
- Les comptes sont stockés dans le KV `CACHE` (sans expiration). Sans KV (local), ils sont perdus au redémarrage.

## Référencement (SEO)
- Le Worker réécrit les balises (titre, description, aperçu de partage, adresse canonique, données structurées) de chaque page : accueil, match, équipe, championnat, article de la rédaction, pages légales. WhatsApp et Facebook affichent ainsi un aperçu propre.
- `/sitemap.xml` et `/robots.txt` sont générés automatiquement avec l'adresse du site (le domaine personnalisé sera pris en compte tout seul).
- Les actualités reprises d'un flux externe sont en `noindex` : seuls tes articles (page /admin) sont proposés à Google.
- Une fois le domaine branché : ajouter le site dans Google Search Console et envoyer `https://ton-domaine/sitemap.xml`.
- Pages articles : `/actualites/own-<id>/<titre>`.

## Alertes de but (Web Push)
- Chaque visiteur peut activer « Alertes de but, même site fermé » (onglet Favoris ou réglages des alertes). Seuls les matchs réels favoris (`apif-…`) sont suivis.
- Une tâche planifiée (`*/2 * * * *`, dans `wrangler.jsonc`) lit les matchs en direct (même cache que le site) et envoie une notification par but. Elle ne fait aucun appel API s'il n'y a pas de match favori en cours (fenêtre : 10 min avant le coup d'envoi à 3 h 30 après).
- Les clés VAPID sont créées automatiquement au premier usage et gardées dans le KV : rien à configurer. Les abonnements sont aussi dans le KV (4000 maximum).
- iPhone : il faut ajouter le site à l'écran d'accueil. Les notifications arrivent avec 0 à 4 minutes de retard (cache + cron).

## Statistiques de visites
- Collecte anonyme et sans cookie (`POST /api/hit`) : pages vues, visiteurs du jour (empreinte qui change chaque jour), pays, appareil, provenance. Rien n'est compté pour les robots, `/admin`, ni si le navigateur envoie « Ne pas me suivre ».
- Tableau de bord en haut de la page `/admin` (7, 30 ou 90 jours). Les données sont conservées environ 3 mois.
- Pour rester sous la limite d'écritures du KV gratuit (1000 par jour), les visites sont regroupées : une écriture au plus toutes les 2 minutes par instance (`STATS_FLUSH_SECONDS` pour changer). Sur un fort trafic, passer au plan payant de Workers.

## Partage
- Composant `src/components/ShareButton.tsx` : sur mobile, feuille de partage du téléphone ; sur ordinateur, menu WhatsApp / Facebook / X / Telegram / copier le lien.
- Présent sur : en-tête mobile des pages détail, page match (score), championnat, équipe, articles (sous le titre et en fin d'article), cartes d'actualités, pronostics IA, lignes de match (au survol, matchs réels) et pied de page (partage du site).

## Quota API (page /admin)
- Carte « Quota API-Football » en haut de `/admin` : requêtes utilisées / limite du jour, barre verte, orange (≥ 70 %) puis rouge (≥ 90 %), compte à rebours avant la remise à zéro (00h00 UTC). Rafraîchie toutes les minutes.
- Route `GET /api/admin/quota` (protégée) : interroge `/status` d'API-Football, qui ne consomme pas de requête du quota.

## Abonnement aux pronostics IA (lien de paiement + activation manuelle)
- Essai gratuit de 5 jours (à la création du compte ; pour un compte existant, à sa première connexion), puis abonnement. Le client paie via ton lien de paiement, clique sur « J'ai payé » (demande visible dans l'admin), puis tu actives son compte.
- Réglages dans `/admin` > Abonnés > « Lien de paiement et tarif » : lien https, prix (FCFA) et durée (jours). Sans lien enregistré, personne n'est bloqué (comportement d'avant). Variables facultatives : `PAYMENT_LINK`, `PREMIUM_PRICE`, `PREMIUM_DAYS` (valeurs de départ) et `TRIAL_DAYS` (5 par défaut).
- Section Abonnés : compteurs (abonnés / essai / expirés), paiements à vérifier, activation par e-mail (+ N jours, qui s'ajoutent à l'abonnement en cours), +7 jours / +durée standard sur chaque compte, retrait d'accès, recherche et filtres.
- La liste vient d'un index mis à jour à l'inscription, à la connexion et à chaque action admin : un compte jamais reconnecté depuis la mise en ligne n'apparaît pas encore, mais « Activer un abonnement » fonctionne avec son e-mail.
- API admin : `GET /api/admin/subscribers`, `POST /api/admin/subscribers/grant | revoke | dismiss`, `POST /api/admin/pay-settings`. Côté visiteur : `POST /api/pay/claim`. `/api/picks` et `/api/picks/history` répondent 402 quand l'essai est fini et sans abonnement (blocage côté serveur).

## Moteur de pronostics (cotes + valeur)
- Fichier `worker/picksModel.ts` (sans dépendance, testable seul). Pour chaque match, la probabilité de chaque pari (1, N, 2, double chance, plus/moins de buts, les deux marquent) est calculée en fusionnant : la probabilité implicite des bookmakers (marge retirée, médiane), les pourcentages d'API-Football et un modèle de Poisson sur les buts moyens (domicile/extérieur). Le poids du marché est le plus élevé.
- Elle est comparée à la MEILLEURE cote trouvée chez les bookmakers : valeur = probabilité × cote − 1. Seuls les paris qui passent les seuils sont envoyés à l'IA (DeepSeek, puis Claude en secours) qui joue le rôle de validateur : blessés, forme, enjeu, classement, face-à-face. Elle ne peut choisir que parmi ces paris, et sa confiance ne peut pas dépasser la probabilité calculée.
- Deux niveaux : « Sûr » (confiance ≥ 80 %, cote ≥ 1,25, valeur ≥ 2 %, 2 au plus) et « Valeur » (confiance ≥ 65 %, cote ≥ 1,60, valeur ≥ 4 %, 2 au plus). Le niveau est affiché sur chaque pronostic et l'historique donne le taux de réussite et le rendement de chacun.
- Seuils (variables Cloudflare) : `PICKS_MIN_CONFIDENCE` (80), `PICKS_MIN_ODDS` (1.25), `PICKS_MIN_EDGE` (2, en %) pour « Sûr » ; `PICKS_VALUE_MIN_CONFIDENCE` (65), `PICKS_VALUE_MIN_ODDS` (1.60), `PICKS_VALUE_MIN_EDGE` (4, en %) pour « Valeur ». Plus ils sont stricts, moins il y a de pronostics.
- Coût API par analyse : environ 1 à 2 (matchs du jour) + 10 (prédictions) + 6 (cotes) + 4 (blessés) + classements en cache. Sous 40 requêtes restantes, cotes et blessés sont sautés. Le plan gratuit (100/jour) est juste : un plan payant d'API-Football est recommandé.
- L'historique enregistre la cote de chaque pronostic ; après 5 pronostics vérifiés avec cote, le « rendement à mise égale » s'affiche. C'est la vraie mesure de la qualité, plus que le taux de réussite.
