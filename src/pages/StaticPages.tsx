import React, { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Link } from '../router';

interface PageDef {
  title: string;
  description: string;
  body: React.ReactNode;
}

const UPDATED = '25 octobre 2026';

const H: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-7 mb-2">{children}</h2>
);
const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 mb-3">{children}</p>
);
const UL: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="list-disc pl-5 space-y-1.5 mb-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
    {items.map((it, i) => (
      <li key={i}>{it}</li>
    ))}
  </ul>
);
const A: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <Link to={to} className="font-semibold text-accent-600 dark:text-cyan-300 hover:underline">
    {children}
  </Link>
);

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500/60';

const ContactForm: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.success) {
        setState('sent');
        setName('');
        setEmail('');
        setMessage('');
      } else {
        setError(json.error || "Impossible d'envoyer le message.");
        setState('error');
      }
    } catch {
      setError('Connexion au serveur impossible. Réessaie dans un instant.');
      setState('error');
    }
  };

  if (state === 'sent') {
    return (
      <p role="status" className="rounded-xl px-4 py-3 text-sm font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
        Merci ! Ton message a bien été envoyé. Nous te répondrons par e-mail dès que possible.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 max-w-xl" noValidate>
      <label className="block">
        <span className="sr-only">Nom</span>
        <input className={inputClass} placeholder="Ton nom" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoComplete="name" />
      </label>
      <label className="block">
        <span className="sr-only">Adresse e-mail</span>
        <input className={inputClass} type="email" placeholder="Ton adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </label>
      <label className="block">
        <span className="sr-only">Message</span>
        <textarea className={`${inputClass} min-h-[140px] resize-y`} placeholder="Ton message (10 caractères minimum)" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} required />
      </label>
      {state === 'error' && (
        <p role="alert" className="rounded-xl px-3 py-2 text-xs font-semibold bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={state === 'sending' || !name || !email || message.length < 10}
        className="px-5 py-3 rounded-xl bg-accent-600 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
      >
        {state === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Envoyer le message
      </button>
    </form>
  );
};

export const PAGES: Record<string, PageDef> = {
  'a-propos': {
    title: 'À propos',
    description: 'ScoreAfrica : résultats sportifs en direct, championnats africains, classements et pronostics IA.',
    body: (
      <>
        <P>
          ScoreAfrica est un site de résultats sportifs en direct pensé pour le public africain : football, basket et tennis, avec une place centrale pour les championnats et les compétitions du continent.
        </P>
        <H>Ce que tu trouves sur ScoreAfrica</H>
        <UL
          items={[
            'Les scores en direct et les matchs du jour, actualisés toutes les 2 minutes.',
            "Les compétitions africaines : Coupe d'Afrique des Nations, Ligues des Champions et Coupe de la Confédération CAF, et les championnats nationaux.",
            'Des pages dédiées à chaque championnat (matchs, classement, buteurs), chaque équipe et chaque match.',
            'Des alertes de buts et un suivi de tes matchs favoris.',
            <>Des <A to="/">pronostics générés par IA</A>, réservés aux membres inscrits gratuitement.</>,
            "Les actualités du football.",
          ]}
        />
        <H>D'où viennent les données ?</H>
        <P>
          Les scores, classements et statistiques proviennent du fournisseur de données sportives API-Football (API-Sports). Les actualités renvoient vers les sites des médias d'origine. Le tennis sera proposé prochainement.
        </P>
        <H>Une question ou une suggestion ?</H>
        <P>
          Écris-nous depuis la page <A to="/contact">Contact</A>.
        </P>
      </>
    ),
  },
  contact: {
    title: 'Contact',
    description: "Contacter l'équipe ScoreAfrica : question, suggestion, signalement d'erreur ou demande sur tes données.",
    body: (
      <>
        <P>
          Une question, une erreur de score à signaler, une suggestion, ou une demande concernant ton compte et tes données personnelles ? Remplis ce formulaire, nous te répondrons par e-mail.
        </P>
        <ContactForm />
      </>
    ),
  },
  confidentialite: {
    title: 'Politique de confidentialité',
    description: 'Comment ScoreAfrica collecte, utilise et protège tes données personnelles.',
    body: (
      <>
        <P>Dernière mise à jour : {UPDATED}. Cette page explique quelles données ScoreAfrica collecte, pourquoi, et quels sont tes droits.</P>
        <H>Données que nous collectons</H>
        <UL
          items={[
            "Compte : adresse e-mail, prénom ou pseudo, et mot de passe. Le mot de passe est chiffré (haché avec sel) et n'est jamais stocké en clair.",
            'Messages de contact : nom, e-mail et contenu du message que tu nous envoies.',
            "Sécurité : ton adresse IP est utilisée de façon temporaire (sous forme d'empreinte) pour limiter les tentatives de connexion abusives et les envois en masse.",
            'Préférences sur ton appareil : thème, favoris et réglages des alertes sont enregistrés dans ton navigateur. Ils ne sont pas envoyés à nos serveurs, sauf si tu actives les alertes de but (voir ci-dessous).',
            "Alertes de but (facultatives) : si tu les actives, nous enregistrons l'adresse technique de notification de ton appareil et la liste des matchs que tu suis, uniquement pour t'envoyer les alertes. Tu peux les désactiver à tout moment dans les réglages des alertes, ce qui supprime ces données.",
            "Mesure d'audience : pour savoir combien de personnes utilisent le site, nous comptons les pages vues avec le pays, le type d'appareil et le site d'origine. Aucun cookie n'est utilisé et aucune adresse IP n'est conservée : le visiteur est représenté par une empreinte anonyme qui change chaque jour. Si ton navigateur envoie « Ne pas me suivre », rien n'est compté.",
          ]}
        />
        <H>Pourquoi nous les utilisons</H>
        <UL
          items={[
            "Créer et sécuriser ton compte, et donner accès aux pronostics IA.",
            'Répondre à tes messages.',
            'Protéger le site contre les abus.',
            "T'envoyer les alertes de but que tu as demandées.",
            'Mesurer et améliorer la fréquentation du site (statistiques anonymes).',
          ]}
        />
        <P>Nous ne vendons pas tes données personnelles.</P>
        <H>Services tiers</H>
        <UL
          items={[
            "Hébergement et réseau : Cloudflare.",
            'Données sportives : API-Football (API-Sports). Les logos des équipes et compétitions sont chargés depuis leurs serveurs.',
            'Polices de caractères : Google Fonts.',
            "Publicité : le site peut afficher des annonces fournies par des régies publicitaires (par exemple Google AdSense). Ces partenaires peuvent utiliser des cookies pour afficher des annonces adaptées. Voir la page Cookies.",
          ]}
        />
        <H>Durée de conservation</H>
        <P>
          Ton compte est conservé tant que tu ne demandes pas sa suppression. Les messages de contact sont conservés le temps nécessaire pour y répondre.
        </P>
        <H>Tes droits</H>
        <P>
          Tu peux demander l'accès à tes données, leur correction ou la suppression de ton compte à tout moment via la page <A to="/contact">Contact</A>. Pense à indiquer l'adresse e-mail de ton compte.
        </P>
        <H>Mineurs</H>
        <P>Le site, et en particulier les pronostics, est réservé aux personnes majeures.</P>
        <H>Modifications</H>
        <P>Nous pouvons mettre à jour cette politique. La date de dernière mise à jour figure en haut de cette page.</P>
      </>
    ),
  },
  conditions: {
    title: "Conditions d'utilisation",
    description: "Règles d'utilisation du site ScoreAfrica.",
    body: (
      <>
        <P>Dernière mise à jour : {UPDATED}. En utilisant ScoreAfrica, tu acceptes les conditions suivantes.</P>
        <H>Service fourni</H>
        <P>
          ScoreAfrica fournit des informations sportives à titre indicatif. Malgré tout le soin apporté, les scores, classements et statistiques peuvent contenir des erreurs ou des retards. Le site est fourni « en l'état », sans garantie de disponibilité continue.
        </P>
        <H>Pronostics</H>
        <P>
          Les pronostics sont générés par des modèles d'intelligence artificielle. Ils sont purement indicatifs, ne constituent pas un conseil financier ou de paris, et ne garantissent aucun résultat ni aucun gain. ScoreAfrica n'est pas un opérateur de paris et n'accepte aucune mise. Toute décision de jeu relève de ta seule responsabilité. Voir <A to="/jeu-responsable">Jeu responsable</A>.
        </P>
        <H>Compte</H>
        <UL
          items={[
            'Tu dois être majeur pour créer un compte.',
            'Tu es responsable de la confidentialité de ton mot de passe et de l\'activité de ton compte.',
            'Une seule personne par compte ; les informations fournies doivent être exactes.',
            'Nous pouvons suspendre un compte en cas d\'abus ou de tentative de piratage.',
          ]}
        />
        <H>Utilisation acceptable</H>
        <P>
          Il est interdit d'extraire massivement les données du site, de perturber son fonctionnement, de tenter d'accéder à des comptes ou à des parties non autorisées, ou d'utiliser le service de façon illégale.
        </P>
        <H>Propriété intellectuelle</H>
        <P>
          Le design et les textes du site appartiennent à ScoreAfrica. Les noms, logos et données des équipes, compétitions et fournisseurs appartiennent à leurs propriétaires respectifs.
        </P>
        <H>Responsabilité</H>
        <P>
          Dans la limite permise par la loi, ScoreAfrica ne peut être tenu responsable des pertes ou dommages liés à l'utilisation du site ou à la confiance accordée aux informations et pronostics publiés.
        </P>
        <H>Contact</H>
        <P>
          Pour toute question sur ces conditions : <A to="/contact">Contact</A>.
        </P>
      </>
    ),
  },
  cookies: {
    title: 'Politique de cookies',
    description: 'Les cookies et stockages locaux utilisés par ScoreAfrica.',
    body: (
      <>
        <P>Dernière mise à jour : {UPDATED}. Cette page décrit les cookies et stockages locaux utilisés par le site.</P>
        <H>Strictement nécessaires</H>
        <UL
          items={[
            <><strong>fsn_session</strong> : cookie de connexion à ton compte, sécurisé (HttpOnly), valable 30 jours ou jusqu'à ta déconnexion.</>,
          ]}
        />
        <H>Préférences (stockage local du navigateur)</H>
        <UL
          items={[
            'Thème clair ou sombre.',
            'Matchs et championnats favoris, réglages des alertes et historique des alertes.',
            'Copie temporaire de données (matchs, championnats africains, pronostics) pour accélérer l\'affichage.',
          ]}
        />
        <H>Mesure d'audience</H>
        <UL
          items={[
            "Les statistiques de visites n'utilisent aucun cookie et aucun identifiant stocké sur ton appareil.",
          ]}
        />
        <P>Ces informations restent sur ton appareil. Tu peux les effacer à tout moment depuis les réglages de ton navigateur.</P>
        <H>Publicité</H>
        <P>
          Lorsque des annonces sont affichées, les régies publicitaires partenaires (par exemple Google AdSense) peuvent déposer leurs propres cookies pour mesurer l'audience et personnaliser les annonces. Tu peux gérer ces cookies dans les réglages de ton navigateur ou, pour Google, depuis ses paramètres d'annonces.
        </P>
        <H>Bloquer les cookies</H>
        <P>
          Tu peux bloquer les cookies dans ton navigateur. Dans ce cas, la connexion à ton compte et l'accès aux pronostics ne fonctionneront pas.
        </P>
      </>
    ),
  },
  'jeu-responsable': {
    title: 'Jeu responsable',
    description: 'Conseils pour garder le contrôle si tu paries sur le sport, et aide en cas de difficulté.',
    body: (
      <>
        <P>
          ScoreAfrica publie des résultats et des pronostics indicatifs. Nous ne sommes pas un site de paris. Si tu choisis de parier ailleurs, fais-le avec prudence.
        </P>
        <H>Les bons réflexes</H>
        <UL
          items={[
            'Les paris sont réservés aux personnes majeures.',
            'Un pronostic, même issu d\'une IA, ne garantit jamais le résultat.',
            "Ne parie que l'argent que tu peux te permettre de perdre, jamais celui du loyer, de la nourriture ou des factures.",
            'Fixe-toi une limite de dépense et de temps avant de jouer, et respecte-la.',
            'Ne cherche pas à te « refaire » après une perte.',
            "Évite de parier sous le coup de l'émotion, de la fatigue ou de l'alcool.",
          ]}
        />
        <H>Signes d'alerte</H>
        <UL
          items={[
            'Tu paries plus que prévu ou tu empruntes pour jouer.',
            'Le jeu te met en colère, t\'angoisse, ou prend le dessus sur ta famille et ton travail.',
            'Tu mens à ton entourage sur ce que tu dépenses.',
          ]}
        />
        <P>
          Si tu te reconnais dans ces signes, parles-en à une personne de confiance et contacte un professionnel de santé ou une association d'aide aux joueurs de ton pays. Tu peux aussi demander à l'opérateur chez qui tu joues de t'auto-exclure ou de limiter tes mises.
        </P>
      </>
    ),
  },
};

export const StaticPage: React.FC<{ slug: string }> = ({ slug }) => {
  const page = PAGES[slug];
  if (!page) return null;
  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <nav aria-label="Fil d'Ariane" className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        <Link to="/" className="hover:underline">Accueil</Link> <span aria-hidden="true">/</span> {page.title}
      </nav>
      <div className="fs-card rounded-3xl border p-5 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-4">{page.title}</h1>
        {page.body}
      </div>
    </article>
  );
};
