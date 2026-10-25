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

## Comptes et section Pronostics IA
- Onglet « Pronos IA » et bouton « Se connecter » : l'accès aux pronostics exige un compte (e-mail + mot de passe, 8 caractères minimum).
- API : `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`. `/api/picks` et `/api/picks/history` répondent 401 sans session.
- Sécurité : mots de passe hachés (PBKDF2-SHA256 + sel), session dans un cookie HttpOnly de 30 jours, blocage 15 min après 5 échecs, 10 créations de compte par heure et par IP.
- Les comptes sont stockés dans le KV `CACHE` (sans expiration). Sans KV (local), ils sont perdus au redémarrage.
