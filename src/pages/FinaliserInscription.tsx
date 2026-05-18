import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertTriangle, Sparkles, ExternalLink } from "lucide-react";
import lytaLogo from "@/assets/lyta-logo-full.svg";

type SessionInfo = {
  session_id: string;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  checkout_status: "open" | "complete" | "expired";
  email: string | null;
  plan: { id: string; display_name: string; monthly_price: number } | null;
  trial_ends_at: string | null;
  already_provisioned: boolean;
  tenant: { id: string; slug: string; name: string; tenant_status: string; url: string } | null;
};

type ProvisionResult = {
  ok: boolean;
  already_provisioned?: boolean;
  tenant_id: string;
  slug: string;
  name?: string;
  url: string;
  login_url: string;
};

function sluggify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 40);
}

export default function FinaliserInscription() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<SessionInfo | null>(null);

  const [tenantName, setTenantName] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState<"fr" | "de" | "it" | "en">("fr");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ProvisionResult | null>(null);

  const computedSlug = useMemo(
    () => (slugTouched ? slug : sluggify(tenantName)),
    [tenantName, slug, slugTouched],
  );

  useEffect(() => {
    if (!sessionId) {
      setError("Lien invalide — paramètre session_id manquant.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke("get-checkout-session-info", {
          body: { session_id: sessionId },
        });
        if (invokeErr) throw invokeErr;
        if (!data) throw new Error("Réponse vide du serveur.");
        const i = data as SessionInfo;
        setInfo(i);
        if (i.payment_status !== "paid" && i.payment_status !== "no_payment_required") {
          setError("Paiement non confirmé sur Stripe. Si tu viens de payer, attends quelques secondes et recharge la page.");
        }
        if (i.already_provisioned && i.tenant) {
          setSuccess({
            ok: true,
            already_provisioned: true,
            tenant_id: i.tenant.id,
            slug: i.tenant.slug,
            name: i.tenant.name,
            url: i.tenant.url,
            login_url: `${i.tenant.url}/connexion`,
          });
        }
      } catch (e: any) {
        setError(e?.message || "Impossible de récupérer la session Stripe.");
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);

    if (tenantName.trim().length < 2) {
      setSubmitError("Le nom du cabinet doit faire au moins 2 caractères.");
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setSubmitError("Prénom et nom requis.");
      return;
    }
    if (!/^[a-z][a-z0-9-]{2,39}$/.test(computedSlug)) {
      setSubmitError("Slug invalide. 3-40 caractères, commence par une lettre, lettres/chiffres/tirets uniquement.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("provision-self-signup-tenant", {
        body: {
          stripe_session_id: sessionId,
          tenant_name: tenantName.trim(),
          slug: computedSlug,
          admin_first_name: firstName.trim(),
          admin_last_name: lastName.trim(),
          admin_phone: phone.trim() || undefined,
          language,
        },
      });
      if (invokeErr) throw invokeErr;
      if (!data?.ok) throw new Error(data?.message || data?.error || "Création échouée.");
      setSuccess(data as ProvisionResult);
    } catch (e: any) {
      setSubmitError(e?.message || "Erreur inattendue lors de la création.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span>Vérification de ton paiement…</span>
        </div>
      </Shell>
    );
  }

  if (error && !info) {
    return (
      <Shell>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Impossible de continuer</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Besoin d'aide ? Écris à <a className="underline" href="mailto:support@lyta.ch">support@lyta.ch</a> en mentionnant ton email Stripe.
        </p>
      </Shell>
    );
  }

  if (success) {
    return (
      <Shell>
        <div className="text-center space-y-4 py-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Cabinet créé 🎉</h2>
            <p className="text-muted-foreground mt-1">
              {success.already_provisioned
                ? "Ton cabinet existait déjà pour ce paiement."
                : "On a envoyé un email de connexion à"}{" "}
              {!success.already_provisioned && info?.email && <strong>{info.email}</strong>}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-4 text-left text-sm space-y-1">
            <div><span className="text-muted-foreground">Cabinet :</span> <strong>{success.name || tenantName}</strong></div>
            <div><span className="text-muted-foreground">URL :</span> <a className="underline text-primary" href={success.url} target="_blank" rel="noreferrer">{success.url}</a></div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Button asChild>
              <a href={success.login_url}>
                Aller à la connexion <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </div>
          {!success.already_provisioned && (
            <p className="text-xs text-muted-foreground pt-2">
              ⏳ La configuration DNS de ton sous-domaine peut prendre 1-2 minutes. Si la page ne s'affiche pas tout de suite, recharge.
            </p>
          )}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-1 mb-6">
        <div className="flex items-center gap-2 text-emerald-700 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          <span>Paiement confirmé{info?.plan && <> — plan <strong>{info.plan.display_name}</strong></>}</span>
        </div>
        <h1 className="text-2xl font-bold">Finalise la création de ton cabinet</h1>
        <p className="text-muted-foreground text-sm">
          Plus que quelques infos pour activer ton espace LYTA.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="tenantName">Nom du cabinet *</Label>
          <Input
            id="tenantName"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            placeholder="Mon Cabinet d'Assurance Sàrl"
            required
            minLength={2}
          />
        </div>

        <div>
          <Label htmlFor="slug">Sous-domaine LYTA</Label>
          <div className="flex items-center gap-2">
            <Input
              id="slug"
              value={computedSlug}
              onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
              placeholder="moncabinet"
              pattern="^[a-z][a-z0-9-]{2,39}$"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">.lyta.ch</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">3-40 caractères, lettres minuscules, chiffres et tirets.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="firstName">Prénom admin *</Label>
            <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="lastName">Nom admin *</Label>
            <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="phone">Téléphone (optionnel)</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+41 79 ..." />
          </div>
          <div>
            <Label htmlFor="language">Langue</Label>
            <Select value={language} onValueChange={(v) => setLanguage(v as any)}>
              <SelectTrigger id="language"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="it">Italiano</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {info?.email && (
          <div className="text-xs text-muted-foreground border rounded p-2 bg-muted/30">
            Email admin (depuis Stripe) : <strong>{info.email}</strong>
          </div>
        )}

        {submitError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Création en cours…</>
          ) : (
            <><Sparkles className="h-4 w-4 mr-2" /> Activer mon cabinet</>
          )}
        </Button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-xl shadow-xl">
        <CardHeader className="text-center pb-2">
          <img src={lytaLogo} alt="LYTA" className="h-12 mx-auto mb-2" />
          <CardTitle className="sr-only">Finaliser ton inscription LYTA</CardTitle>
          <CardDescription className="sr-only">Page post-paiement pour activer ton cabinet.</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
