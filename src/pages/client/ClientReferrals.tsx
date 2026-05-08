import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Gift,
  CheckCircle2,
  Send,
  Users,
  Loader2,
  Coins,
  Heart,
} from "lucide-react";

const RELATIONS: Array<{ value: string; label: string }> = [
  { value: "ami", label: "Ami(e)" },
  { value: "famille", label: "Famille" },
  { value: "frere", label: "Frère" },
  { value: "soeur", label: "Sœur" },
  { value: "parent", label: "Parent" },
  { value: "conjoint", label: "Conjoint(e)" },
  { value: "collegue", label: "Collègue" },
  { value: "voisin", label: "Voisin(e)" },
  { value: "autre", label: "Autre" },
];

const RELATION_LABEL: Record<string, string> = RELATIONS.reduce(
  (acc, r) => ({ ...acc, [r.value]: r.label }),
  {}
);

type Submitted = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  status: string | null;
  created_at: string;
  tags: string[] | null;
};

export default function ClientReferrals() {
  const { toast } = useToast();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [relation, setRelation] = useState<string>("ami");
  const [message, setMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const [history, setHistory] = useState<Submitted[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadReferrer = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (client?.id) setReferrerId(client.id);
  }, []);

  const loadHistory = useCallback(async () => {
    if (!referrerId) return;
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("id, first_name, last_name, status, created_at, tags")
      .eq("external_ref", `referral:${referrerId}`)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      setHistory(data as Submitted[]);
    }
    setHistoryLoading(false);
  }, [referrerId]);

  useEffect(() => {
    loadReferrer();
  }, [loadReferrer]);

  useEffect(() => {
    loadHistory();
  }, [referrerId, loadHistory]);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setRelation("ami");
    setMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!firstName.trim() || !lastName.trim()) {
      toast({ title: "Champs manquants", description: "Prénom et nom sont obligatoires.", variant: "destructive" });
      return;
    }
    if (!phone.trim()) {
      toast({ title: "Téléphone requis", description: "Indiquez un numéro pour que votre conseiller puisse contacter votre proche.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-referral", {
        body: {
          first_name: firstName,
          last_name: lastName,
          phone,
          email: email || null,
          relation,
          message: message || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Recommandation envoyée 🎉",
        description: "Votre conseiller a été notifié et vous recontactera rapidement.",
      });
      resetForm();
      loadHistory();
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err?.message || "Impossible d'envoyer la recommandation.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: string | null) => {
    const map: Record<string, { label: string; className: string }> = {
      prospect: { label: "En cours", className: "bg-blue-100 text-blue-700" },
      actif: { label: "Devenu client 🎉", className: "bg-emerald-100 text-emerald-700" },
      résilié: { label: "Sans suite", className: "bg-slate-100 text-slate-700" },
      dormant: { label: "En attente", className: "bg-amber-100 text-amber-700" },
    };
    const cfg = map[status ?? "prospect"] ?? map.prospect;
    return <Badge className={cfg.className}>{cfg.label}</Badge>;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Hero marketing */}
      <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-primary/90 via-primary to-primary/80 text-primary-foreground">
        <CardContent className="p-8 md:p-10 relative">
          <div className="absolute top-4 right-4 opacity-20">
            <Sparkles className="h-32 w-32" />
          </div>
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-foreground/20 text-sm font-medium mb-4">
              <Gift className="h-4 w-4" />
              Programme de parrainage
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight">
              Recommande tes proches.<br />
              <span className="text-primary-foreground/90">Reçois une super commission.</span>
            </h1>
            <p className="text-primary-foreground/90 max-w-xl">
              Un proche cherche un conseil sur son assurance ? Recommande-le en 30 secondes.
              Ton conseiller le contacte, et toi tu es récompensé(e) à chaque dossier signé.
            </p>
            <div className="flex flex-wrap gap-4 mt-6">
              <div className="flex items-center gap-2 text-sm">
                <Heart className="h-4 w-4" />
                Simple et rapide
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Coins className="h-4 w-4" />
                Récompense à chaque signature
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                100% confidentiel
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulaire */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6 md:p-8">
          <h2 className="text-xl font-semibold mb-1">Qui veux-tu nous présenter ?</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Remplis le formulaire — ton conseiller prendra contact directement.
          </p>

          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom *</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Marie"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom *</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Dupont"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone *</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+41 79 123 45 67"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (optionnel)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="marie.dupont@exemple.ch"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="relation">Comment connais-tu cette personne ?</Label>
              <Select value={relation} onValueChange={setRelation}>
                <SelectTrigger id="relation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="message">Un mot pour ton conseiller ? (optionnel)</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ex : elle change bientôt de canton, intéressée par une assurance auto."
                rows={3}
                maxLength={1000}
              />
            </div>
            <div className="md:col-span-2 flex justify-end pt-2">
              <Button type="submit" disabled={submitting} size="lg" className="min-w-[200px]">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Envoi…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Envoyer la recommandation
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Historique */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Tes recommandations</h3>
            </div>
            <span className="text-sm text-muted-foreground">{history.length} au total</span>
          </div>

          {historyLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 mx-auto animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Aucune recommandation pour l'instant. Lance-toi !
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((h) => {
                const relationTag = (h.tags ?? []).find((t) => t.startsWith("Relation: "));
                const relationKey = relationTag?.replace("Relation: ", "") ?? "";
                const relationLabel = RELATION_LABEL[relationKey] ?? relationKey;
                return (
                  <div key={h.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                    <div>
                      <div className="font-medium">
                        {h.first_name} {h.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {relationLabel && <span>{relationLabel} · </span>}
                        {new Date(h.created_at).toLocaleDateString("fr-CH")}
                      </div>
                    </div>
                    {statusBadge(h.status)}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
