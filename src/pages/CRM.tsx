import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  ShieldCheck, Users, LayoutDashboard, LineChart, Activity,
  Building2, MessageSquare, Bell, CreditCard, FileSignature,
  Mail, Smartphone, BarChart4, Settings, Cloud, Globe2,
  Wallet, ChevronRight, Sun, Moon, Sparkles, Cpu, LogOut, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AdminUserManagement } from "@/components/crm/AdminUserManagement";
import { useToast } from "@/hooks/use-toast";
import { ContractsSection } from "@/components/crm/ContractsSection";
import { useNavigate } from "react-router-dom";

// Helpers d'animation
const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const springy = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { type: "spring" as const, stiffness: 120, damping: 14 } },
};

function GlassHeader() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("client");

  useEffect(() => {
    if (user) {
      // Fetch user profile
      supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => setProfile(data));

      // Fetch user role
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setUserRole(data.role);
        });
    }
  }, [user]);

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    return user?.email?.[0].toUpperCase() || "U";
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-40 backdrop-blur-md bg-white/50 dark:bg-slate-900/40 border-b border-white/30 dark:border-slate-700/40"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ rotateX: -8, rotateY: 8, scale: 0.95 }}
            whileHover={{ rotateX: 0, rotateY: 0, scale: 1 }}
            transition={{ type: "spring" as const, stiffness: 120, damping: 12 }}
            className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-300 to-indigo-500 shadow-inner flex items-center justify-center text-white"
            aria-label="Advisy logo 3D"
          >
            <Sparkles className="h-5 w-5" />
          </motion.div>
          <div className="font-semibold tracking-tight text-slate-900 dark:text-slate-50">Advisy CRM 2.0</div>
          <span className="ml-2 text-xs px-2 py-1 rounded-full bg-slate-900/5 dark:bg-white/10 text-slate-500 dark:text-slate-300">
            {userRole === "admin" ? "Admin" : userRole === "partner" ? "Partner" : "Client"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            <Sun className="h-4 w-4 text-amber-500" />
            <Switch />
            <Moon className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 dark:bg-slate-800/70 border border-white/30 dark:border-slate-700/40">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-sky-300 text-white text-xs">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block">
              <div className="text-xs font-medium text-slate-900 dark:text-slate-50">
                {profile?.first_name && profile?.last_name 
                  ? `${profile.first_name} ${profile.last_name}`
                  : user?.email
                }
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={signOut}
            className="rounded-full"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <TickerStrip />
    </motion.header>
  );
}

function TickerStrip() {
  const items = [
    { icon: <Bell className="h-4 w-4" />, text: "3 notifications : 1 commission versée, 2 renouvellements aujourd'hui" },
    { icon: <MessageSquare className="h-4 w-4" />, text: "Nouveau message de votre conseiller : Documents validés" },
    { icon: <Activity className="h-4 w-4" />, text: "KPI : +12% de CA ce mois vs N-1" },
  ];
  return (
    <div className="overflow-hidden border-t border-white/30 dark:border-slate-700/40">
      <motion.div
        initial={{ x: 0 }}
        animate={{ x: [0, -600] }}
        transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
        className="flex gap-8 py-2 px-4 text-sm text-slate-600 dark:text-slate-300"
      >
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 whitespace-nowrap">
            {it.icon}
            <span>{it.text}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function SidebarNav() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const links = [
    { label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
    { label: "Gestion Contrats", icon: <FileSignature className="h-4 w-4" />, action: () => navigate('/partner/contracts') },
    { label: "Documents", icon: <FileText className="h-4 w-4" />, action: () => navigate('/partner/documents') },
    { label: "Commissions", icon: <CreditCard className="h-4 w-4" />, action: () => navigate('/partner/commissions') },
    { label: "Vue Contrats", icon: <ShieldCheck className="h-4 w-4" />, action: () => document.getElementById('contracts-section')?.scrollIntoView({ behavior: 'smooth' }) },
    { label: "Espace Client", icon: <ShieldCheck className="h-4 w-4" />, action: () => document.getElementById('client-section')?.scrollIntoView({ behavior: 'smooth' }) },
    { label: "Espace Partner", icon: <Users className="h-4 w-4" />, action: () => document.getElementById('partner-section')?.scrollIntoView({ behavior: 'smooth' }) },
    { label: "CRM Admin", icon: <Settings className="h-4 w-4" />, action: () => document.getElementById('admin-section')?.scrollIntoView({ behavior: 'smooth' }) },
    { label: "Analytics", icon: <BarChart4 className="h-4 w-4" />, action: () => toast({ title: "Analytics", description: "Tableaux de bord avancés en développement" }) },
    { label: "Chat", icon: <MessageSquare className="h-4 w-4" />, action: () => toast({ title: "Chat", description: "Messagerie temps réel en développement" }) },
  ];
  return (
    <aside className="sticky top-20 h-[calc(100vh-5rem)] w-64 hidden lg:flex flex-col gap-2 p-3">
      {links.map((l) => (
        <motion.button
          key={l.label}
          variants={springy}
          initial="hidden"
          animate="show"
          whileHover={{ scale: 1.02, boxShadow: "0 8px 24px rgba(59,130,246,0.15)" }}
          onClick={l.action}
          className="group rounded-2xl px-3 py-2 bg-white/70 dark:bg-slate-900/50 backdrop-blur border border-white/30 dark:border-slate-700/40 text-left flex items-center gap-3 cursor-pointer"
        >
          <div className="text-slate-700 dark:text-slate-200">{l.icon}</div>
          <span className="text-sm text-slate-700 dark:text-slate-200">{l.label}</span>
          <ChevronRight className="ml-auto h-4 w-4 text-slate-400 group-hover:text-slate-600" />
        </motion.button>
      ))}
    </aside>
  );
}

function StatCards() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    activeContracts: 0,
    monthlyPremiums: 0,
    totalCommissions: 0,
    cancelRate: 0
  });

  useEffect(() => {
    if (user) {
      // Fetch contracts count and total premiums
      supabase
        .from("contracts")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .then(({ data }) => {
          if (data) {
            const activeCount = data.length;
            const monthlyTotal = data.reduce((sum, contract) => 
              sum + Number(contract.monthly_premium), 0
            );
            setStats(prev => ({
              ...prev,
              activeContracts: activeCount,
              monthlyPremiums: monthlyTotal
            }));
          }
        });
    }
  }, [user]);

  const statsData = [
    { title: "Contrats actifs", value: stats.activeContracts.toString(), icon: <ShieldCheck className="h-5 w-5" /> },
    { title: "Primes (mois)", value: `CHF ${stats.monthlyPremiums.toFixed(2)}`, icon: <CreditCard className="h-5 w-5" /> },
    { title: "Épargne annuelle", value: `CHF ${(stats.monthlyPremiums * 12).toFixed(2)}`, icon: <Wallet className="h-5 w-5" /> },
    { title: "Statut", value: "Actif", icon: <Activity className="h-5 w-5" /> },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {statsData.map((s) => (
        <motion.div key={s.title} variants={fadeIn} initial="hidden" animate="show">
          <Card className="rounded-2xl border-white/30 dark:border-slate-700/40 bg-white/70 dark:bg-slate-900/50 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-300">{s.title}</CardTitle>
              <div className="text-slate-700 dark:text-slate-200">{s.icon}</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{s.value}</div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function ChartPlaceholder({ title }: { title: string }) {
  return (
    <motion.div variants={springy} initial="hidden" animate="show">
      <Card className="rounded-2xl border-white/30 dark:border-slate-700/40 bg-white/70 dark:bg-slate-900/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-slate-700 dark:text-slate-200 text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-1 h-40 items-end">
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ height: 10, y: 40 }}
                animate={{ height: 20 + Math.random() * 120, y: 0 }}
                transition={{ delay: i * 0.05, type: "spring", stiffness: 110, damping: 14 }}
                className="rounded-t-md bg-gradient-to-b from-indigo-400 to-sky-300 shadow-inner"
                style={{ boxShadow: "inset 0 1px 6px rgba(255,255,255,0.4)" }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ClientPanelDemo() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      supabase
        .from("contracts")
        .select("*")
        .eq("user_id", user.id)
        .then(({ data, error }) => {
          if (!error && data) {
            setContracts(data);
          }
          setLoading(false);
        });
    }
  }, [user]);

  const getContractIcon = (type: string) => {
    switch (type) {
      case 'auto': return '🚗';
      case 'menage': return '🏠';
      case 'sante': return '🏥';
      case 'vie': return '❤️';
      case '3e_pilier': return '💰';
      case 'juridique': return '⚖️';
      case 'hypotheque': return '🏦';
      default: return '📄';
    }
  };

  const getContractLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      'auto': 'Auto',
      'menage': 'Ménage',
      'sante': 'Santé',
      'vie': 'Vie',
      '3e_pilier': '3e Pilier',
      'juridique': 'Protection Juridique',
      'hypotheque': 'Hypothèque'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur">
        <CardContent className="p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <motion.div variants={springy} initial="hidden" animate="show" className="xl:col-span-2">
        <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <ShieldCheck className="h-5 w-5" /> Mes polices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contracts.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                Aucun contrat trouvé. Créez votre premier contrat ci-dessous.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {contracts.map((contract) => (
                  <motion.div
                    key={contract.id}
                    whileHover={{ y: -2, scale: 1.01 }}
                    className="rounded-2xl p-4 border border-white/30 dark:border-slate-700/40 bg-gradient-to-br from-white/70 to-white/40 dark:from-slate-900/60 dark:to-slate-900/40 backdrop-blur"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getContractIcon(contract.contract_type)}</span>
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {getContractLabel(contract.contract_type)}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">{contract.company}</div>
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
                      CHF {contract.monthly_premium}.-/mois
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <FileSignature className="h-4 w-4" />
                      <span>N° {contract.policy_number || 'N/A'}</span>
                      <span className={`ml-auto px-2 py-0.5 rounded-full ${
                        contract.status === 'active' ? 'bg-green-100 text-green-700' :
                        contract.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {contract.status}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Button 
                className="rounded-xl"
                onClick={() => toast({ title: "Nouveau contrat", description: "Fonctionnalité en développement" })}
              >
                Nouveau contrat
              </Button>
              <Button 
                variant="outline" 
                className="rounded-xl"
                onClick={() => toast({ title: "Résiliation", description: "Signature électronique en développement" })}
              >
                Résiliation (e-sign)
              </Button>
              <Button 
                variant="ghost" 
                className="rounded-xl"
                onClick={() => toast({ title: "Dépenses", description: "Analyse globale en développement" })}
              >
                Voir dépenses globales
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      <motion.div variants={springy} initial="hidden" animate="show">
        <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <MessageSquare className="h-5 w-5" /> Chat conseiller
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 overflow-y-auto space-y-2 pr-2 text-sm">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">Bonjour, puis-je résilier mon contrat auto ?</div>
              <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-900/40 ml-8">Oui, je vous envoie le lien de signature électronique.</div>
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">Merci !</div>
            </div>
            <div className="mt-3 flex gap-2">
              <Input placeholder="Écrire un message..." />
              <Button 
                className="rounded-xl"
                onClick={() => toast({ title: "Chat", description: "Chat temps réel en développement" })}
              >
                Envoyer
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function PartnerPanelDemo() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <ChartPlaceholder title="Commissions par mois (Agent)" />
      <ChartPlaceholder title="Conversions & résiliations" />
      <motion.div variants={springy} initial="hidden" animate="show">
        <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Wallet className="h-5 w-5" /> Module commissions (démo)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {["Jan", "Fév", "Mar", "Avr"].map((m, i) => (
                <div key={m} className="flex items-center gap-3">
                  <div className="w-10 text-xs text-slate-500">{m}</div>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${40 + i * 15}%` }}
                    className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                  />
                  <div className="ml-auto text-xs text-slate-600 dark:text-slate-300">CHF {3_000 + i * 850}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function AdminPanelDemo() {
  const integrations = [
    { label: "SendGrid/Brevo", icon: <Mail className="h-4 w-4" /> },
    { label: "Twilio (SMS)", icon: <Smartphone className="h-4 w-4" /> },
    { label: "Yousign/DocuSign", icon: <FileSignature className="h-4 w-4" /> },
    { label: "Bexio/Crésus", icon: <Building2 className="h-4 w-4" /> },
    { label: "Stripe / QR Bill", icon: <CreditCard className="h-4 w-4" /> },
    { label: "Zapier / Make", icon: <Cpu className="h-4 w-4" /> },
  ];
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <motion.div variants={springy} initial="hidden" animate="show" className="xl:col-span-2">
        <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Settings className="h-5 w-5" /> Paramétrage & Sécurité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl p-3 border border-white/30 dark:border-slate-700/40">
                <div className="text-sm font-medium">Rôles & permissions</div>
                <div className="mt-2 text-xs text-slate-500">Admin • Partner • Client • Viewer</div>
              </div>
              <div className="rounded-xl p-3 border border-white/30 dark:border-slate-700/40">
                <div className="text-sm font-medium">Authentification</div>
                <div className="mt-2 text-xs text-slate-500">OAuth2/JWT + 2FA</div>
              </div>
              <div className="rounded-xl p-3 border border-white/30 dark:border-slate-700/40">
                <div className="text-sm font-medium">Stockage & Backups</div>
                <div className="mt-2 text-xs text-slate-500">AWS S3 / Infomaniak • Backups chiffrés</div>
              </div>
              <div className="rounded-xl p-3 border border-white/30 dark:border-slate-700/40">
                <div className="text-sm font-medium">Audit logs</div>
                <div className="mt-2 text-xs text-slate-500">Traçabilité des actions sensibles</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      <motion.div variants={springy} initial="hidden" animate="show">
        <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Cloud className="h-5 w-5" /> Intégrations (maquette)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {integrations.map((it) => (
                <div key={it.label} className="flex items-center gap-2">
                  {it.icon}
                  <span>{it.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function Roadmap() {
  const phases = [
    { title: "Phase 1 : Prototype fonctionnel", items: [
      "Design UX/UI (Figma + animations Framer Motion)",
      "Schéma base de données",
      "API + Auth",
      "Espaces Client/Partner/Admin (squelettes)"
    ]},
    { title: "Phase 2 : CRM & modules", items: [
      "Contrats/Clients/Partenaires (CRUD)",
      "Statuts + commissions",
      "Chat temps réel + notifications",
      "Génération PDF + e-sign"
    ]},
    { title: "Phase 3 : Front interactif & 3D", items: [
      "Transitions 3D/Sliders/Motion",
      "Dashboard animé + widgets drag & drop",
      "Ticker d'informations",
      "Dark/Light auto"
    ]},
    { title: "Phase 4 : Automatisation & IA", items: [
      "Email/SMS automatiques",
      "Analyse des polices (reco)",
      "Chatbot conseiller",
      "Prédictif (churn, optimisation primes)"
    ]},
    { title: "Phase 5 : Sécu & scalabilité", items: [
      "Chiffrement, backups, durcissement",
      "Perf & budgets cloud",
      "Mise en prod CH",
      "Monitoring & reporting"
    ]},
  ];
  return (
    <motion.div variants={springy} initial="hidden" animate="show">
      <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Globe2 className="h-5 w-5" /> Roadmap projet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {phases.map((p) => (
              <div key={p.title} className="rounded-xl border border-white/30 dark:border-slate-700/40 p-3">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{p.title}</div>
                <ul className="mt-2 text-xs list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                  {p.items.map((it) => <li key={it}>{it}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function CRM() {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<string>("client");

  useEffect(() => {
    if (user) {
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setUserRole(data.role);
        });
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 dark:from-slate-950 dark:to-slate-900">
      <GlassHeader />
      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-6">
        <SidebarNav />

        <div className="space-y-6">
          {/* Dashboard - Tous les rôles */}
          <section className="space-y-4">
            <motion.h1 variants={fadeIn} initial="hidden" animate="show" className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6" /> Tableau de bord
            </motion.h1>
            <StatCards />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartPlaceholder title="Montant total des primes (mois)" />
              <ChartPlaceholder title="Répartition par type d'assurance" />
            </div>
          </section>

          {/* Section Contrats - Vue CRM professionnelle */}
          <section id="contracts-section" className="space-y-4">
            {user && <ContractsSection userId={user.id} />}
          </section>

          {/* Espace Client - visible pour clients et admins */}
          {(userRole === "client" || userRole === "admin") && (
            <section className="space-y-4" id="client-section">
              <motion.h2 variants={fadeIn} initial="hidden" animate="show" className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" /> Mes Contrats
              </motion.h2>
              <ClientPanelDemo />
            </section>
          )}

          {/* Espace Partner - visible pour partners et admins */}
          {(userRole === "partner" || userRole === "admin") && (
            <section className="space-y-4" id="partner-section">
              <motion.h2 variants={fadeIn} initial="hidden" animate="show" className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
                <Users className="h-5 w-5" /> Espace Partner
              </motion.h2>
              <PartnerPanelDemo />
            </section>
          )}

          {/* CRM Admin - visible uniquement pour admins */}
          {userRole === "admin" && (
            <>
              <section className="space-y-4" id="admin-section">
                <motion.h2 variants={fadeIn} initial="hidden" animate="show" className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
                  <Users className="h-5 w-5" /> Gestion Utilisateurs
                </motion.h2>
                <AdminUserManagement />
              </section>

              <section className="space-y-4">
                <motion.h2 variants={fadeIn} initial="hidden" animate="show" className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
                  <Settings className="h-5 w-5" /> Administration CRM
                </motion.h2>
                <AdminPanelDemo />
              </section>

              <section className="space-y-4">
                <motion.h2 variants={fadeIn} initial="hidden" animate="show" className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
                  <LineChart className="h-5 w-5" /> Roadmap Projet
                </motion.h2>
                <Roadmap />
              </section>
            </>
          )}
        </div>
      </main>
      <footer className="py-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Advisy – CRM
      </footer>
    </div>
  );
}
