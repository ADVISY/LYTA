import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertTriangle, Sparkles, ExternalLink, Building2, Palette, User, Settings, Upload } from "lucide-react";
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

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function FinaliserInscription() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<SessionInfo | null>(null);

  // Section 1 — Entreprise
  const [tenantName, setTenantName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  // Section 2 — Couleurs
  const [primaryColor, setPrimaryColor] = useState("#3B82F6");
  const [secondaryColor, setSecondaryColor] = useState("#10B981");

  // Section 3 — Contact
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [backofficeEmail, setBackofficeEmail] = useState("");
  const [language, setLanguage] = useState<"fr" | "de" | "it" | "en">("fr");

  // Section 4 — Options
  const [extraUsers, setExtraUsers] = useState(0);

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
        if (i.email && !adminEmail) setAdminEmail(i.email);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoError(null);
    const file = e.target.files?.[0] || null;
    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Le logo dépasse 2 Mo.");
      return;
    }
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)) {
      setLogoError("Format non supporté (PNG, JPEG, WebP ou SVG uniquement).");
      return;
    }
    setLogoFile(file);
    try {
      const preview = await fileToBase64(file);
      setLogoPreview(preview);
    } catch {
      setLogoPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);

    if (tenantName.trim().length < 2) {
      setSubmitError("Le nom commercial doit faire au moins 2 caractères.");
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setSubmitError("Prénom et nom du contact principal requis.");
      return;
    }
    if (!adminEmail.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail.trim())) {
      setSubmitError("Email admin invalide.");
      return;
    }
    if (backofficeEmail.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(backofficeEmail.trim())) {
      setSubmitError("Email back-office invalide.");
      return;
    }
    if (!/^[a-z][a-z0-9-]{2,39}$/.test(computedSlug)) {
      setSubmitError("Sous-domaine invalide. 3-40 caractères, commence par une lettre, lettres/chiffres/tirets uniquement.");
      return;
    }

    setSubmitting(true);
    try {
      let logoBase64: string | undefined;
      if (logoFile && logoPreview) {
        logoBase64 = logoPreview; // data:image/...;base64,XXXX
      }

      const { data, error: invokeErr } = await supabase.functions.invoke("provision-self-signup-tenant", {
        body: {
          stripe_session_id: sessionId,
          tenant_name: tenantName.trim(),
          legal_name: legalName.trim() || undefined,
          slug: computedSlug,
          admin_first_name: firstName.trim(),
          admin_last_name: lastName.trim(),
          admin_phone: phone.trim() || undefined,
          admin_email: adminEmail.trim() || undefined,
          backoffice_email: backofficeEmail.trim() || undefined,
          language,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          extra_users: extraUsers,
          logo_base64: logoBase64,
          logo_filename: logoFile?.name,
        },
      });
      if (invokeErr) {
        let detail = invokeErr.message || "Création échouée.";
        try {
          const ctx = (invokeErr as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            detail = body?.message || body?.error || body?.details || JSON.stringify(body);
          } else if (ctx && typeof ctx.text === "function") {
            detail = await ctx.text();
          }
        } catch {
          /* keep generic */
        }
        throw new Error(detail);
      }
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
          Besoin d'aide ? Écris à <a className="underline" href="mailto:support@lyta.ch">support@lyta.ch</a>.
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
              {!success.already_provisioned && (adminEmail || info?.email) && <strong>{adminEmail || info?.email}</strong>}
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
              ⏳ La configuration DNS du sous-domaine peut prendre 1-2 minutes.
            </p>
          )}
        </div>
      </Shell>
    );
  }

  return (
    <Shell wide>
      <div className="space-y-1 mb-6">
        <div className="flex items-center gap-2 text-emerald-700 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          <span>Paiement confirmé{info?.plan && <> — plan <strong>{info.plan.display_name}</strong></>}</span>
        </div>
        <h1 className="text-2xl font-bold">Finalise la création de ton cabinet</h1>
        <p className="text-muted-foreground text-sm">
          Quelques infos pour activer ton espace LYTA.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form className="space-y-5" onSubmit={handleSubmit}>
        {/* Section 1 - Votre entreprise */}
        <Section icon={Building2} title="Votre entreprise" number={1}>
          <div>
            <Label htmlFor="tenantName">Nom commercial *</Label>
            <Input
              id="tenantName"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="Ma Société SA"
              required
              minLength={2}
            />
          </div>
          <div>
            <Label htmlFor="legalName">Raison sociale (si différente)</Label>
            <Input
              id="legalName"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Ma Société Sàrl"
            />
          </div>
          <div>
            <Label htmlFor="slug">Sous-domaine souhaité *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="slug"
                value={computedSlug}
                onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
                placeholder="masociete"
                pattern="^[a-z][a-z0-9-]{2,39}$"
                required
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">.lyta.ch</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">3-40 caractères, lettres minuscules, chiffres et tirets.</p>
          </div>
          <div>
            <Label htmlFor="logo">Logo de l'entreprise</Label>
            <div className="flex items-center gap-3">
              <label
                htmlFor="logo"
                className="cursor-pointer border-2 border-dashed border-border rounded-lg p-3 hover:border-primary transition-colors flex items-center justify-center w-20 h-20 shrink-0 bg-muted/30"
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                ) : (
                  <Upload className="h-6 w-6 text-muted-foreground" />
                )}
                <input
                  id="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="sr-only"
                  onChange={handleLogoChange}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Cliquez pour uploader (max 2&nbsp;Mo)<br />
                PNG, JPEG, WebP ou SVG
              </p>
            </div>
            {logoError && <p className="text-xs text-destructive mt-1">{logoError}</p>}
          </div>
        </Section>

        {/* Section 2 - Couleurs */}
        <Section icon={Palette} title="Couleurs de votre espace" number={2}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="primary">Couleur principale</Label>
              <div className="flex items-center gap-2">
                <input
                  id="primary"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-12 rounded border cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  pattern="^#[0-9a-fA-F]{6}$"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="secondary">Couleur secondaire</Label>
              <div className="flex items-center gap-2">
                <input
                  id="secondary"
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-10 w-12 rounded border cursor-pointer"
                />
                <Input
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  pattern="^#[0-9a-fA-F]{6}$"
                />
              </div>
            </div>
          </div>
        </Section>

        {/* Section 3 - Contact principal */}
        <Section icon={User} title="Contact principal" number={3}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName">Prénom *</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="lastName">Nom *</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="phone">Téléphone</Label>
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
          <div>
            <Label htmlFor="adminEmail">Email principal *</Label>
            <Input
              id="adminEmail"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="contact@masociete.ch"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Email de l'administrateur principal{info?.email && adminEmail === info.email && <> — pré-rempli depuis Stripe</>}
            </p>
          </div>
          <div>
            <Label htmlFor="backofficeEmail">Email back-office</Label>
            <Input
              id="backofficeEmail"
              type="email"
              value={backofficeEmail}
              onChange={(e) => setBackofficeEmail(e.target.value)}
              placeholder="backoffice@masociete.ch"
            />
            <p className="text-xs text-muted-foreground mt-1">Email pour les notifications back-office (optionnel)</p>
          </div>
        </Section>

        {/* Section 4 - Options */}
        <Section icon={Settings} title="Options" number={4}>
          <div>
            <Label htmlFor="extraUsers">Utilisateurs supplémentaires</Label>
            <Input
              id="extraUsers"
              type="number"
              min={0}
              max={50}
              value={extraUsers}
              onChange={(e) => setExtraUsers(Math.max(0, parseInt(e.target.value || "0", 10)))}
            />
            <p className="text-xs text-muted-foreground mt-1">20 CHF/mois par utilisateur supplémentaire</p>
          </div>
        </Section>

        {submitError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="whitespace-pre-wrap break-words">{submitError}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="w-full" disabled={submitting} size="lg">
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

function Section({ icon: Icon, title, number, children }: { icon: any; title: string; number: number; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
            {number}
          </span>
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-start justify-center p-4 py-8">
      <Card className={wide ? "w-full max-w-2xl shadow-xl border-0 bg-transparent" : "w-full max-w-xl shadow-xl"}>
        <CardHeader className="text-center pb-2">
          <img src={lytaLogo} alt="LYTA" className="h-12 mx-auto mb-2" />
          <CardTitle className="sr-only">Finaliser ton inscription LYTA</CardTitle>
          <CardDescription className="sr-only">Page post-paiement pour activer ton cabinet.</CardDescription>
        </CardHeader>
        <CardContent className={wide ? "px-0" : ""}>{children}</CardContent>
      </Card>
    </div>
  );
}
