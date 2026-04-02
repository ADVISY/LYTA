import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Building2, 
  Save, 
  Loader2, 
  Mail, 
  Phone,
  Globe,
  MapPin,
  FileText,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserTenant } from "@/hooks/useUserTenant";
import { toast } from "sonner";

interface CabinetInfo {
  display_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  // Functional emails
  email_sender_address: string;
  claims_notification_email: string;
  // Financial
  iban: string;
  qr_iban: string;
  vat_number: string;
}

export function CabinetInfoSettings() {
  const { t } = useTranslation();
  const { tenantId } = useUserTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [cabinetInfo, setCabinetInfo] = useState<CabinetInfo>({
    display_name: "",
    company_address: "",
    company_phone: "",
    company_email: "",
    company_website: "",
    email_sender_address: "",
    claims_notification_email: "",
    iban: "",
    qr_iban: "",
    vat_number: "",
  });
  const [originalInfo, setOriginalInfo] = useState<CabinetInfo | null>(null);

  useEffect(() => {
    if (tenantId) {
      loadCabinetInfo();
    }
  }, [tenantId]);

  const loadCabinetInfo = async () => {
    if (!tenantId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tenant_branding")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const info: CabinetInfo = {
          display_name: data.display_name || "",
          company_address: data.company_address || "",
          company_phone: data.company_phone || "",
          company_email: data.company_email || "",
          company_website: data.company_website || "",
          email_sender_address: data.email_sender_address || "",
          claims_notification_email: data.claims_notification_email || "",
          iban: data.iban || "",
          qr_iban: data.qr_iban || "",
          vat_number: data.vat_number || "",
        };
        setCabinetInfo(info);
        setOriginalInfo(info);
      }
    } catch (error) {
      console.error("Error loading cabinet info:", error);
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof CabinetInfo, value: string) => {
    setCabinetInfo(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!tenantId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("tenant_branding")
        .update({
          display_name: cabinetInfo.display_name,
          company_address: cabinetInfo.company_address,
          company_phone: cabinetInfo.company_phone,
          company_email: cabinetInfo.company_email,
          company_website: cabinetInfo.company_website,
          email_sender_address: cabinetInfo.email_sender_address,
          claims_notification_email: cabinetInfo.claims_notification_email,
          iban: cabinetInfo.iban,
          qr_iban: cabinetInfo.qr_iban,
          vat_number: cabinetInfo.vat_number,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId);

      if (error) throw error;

      setOriginalInfo(cabinetInfo);
      setHasChanges(false);
      toast.success(t("settings.saved"));
    } catch (error) {
      console.error("Error saving cabinet info:", error);
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabinet Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" />
            {t("settings.cabinetInfo")}
          </CardTitle>
          <CardDescription>
            {t("settings.cabinetInfoDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("settings.cabinetName")}</Label>
              <Input
                value={cabinetInfo.display_name}
                onChange={(e) => handleChange("display_name", e.target.value)}
                placeholder={t("settings.cabinetNamePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.cabinetPhone")}</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={cabinetInfo.company_phone}
                  onChange={(e) => handleChange("company_phone", e.target.value)}
                  placeholder="+41 XX XXX XX XX"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("settings.cabinetAddress")}</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={cabinetInfo.company_address}
                onChange={(e) => handleChange("company_address", e.target.value)}
                placeholder={t("settings.cabinetAddressPlaceholder")}
                className="pl-10"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("settings.cabinetEmail")}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={cabinetInfo.company_email}
                  onChange={(e) => handleChange("company_email", e.target.value)}
                  placeholder="contact@cabinet.ch"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("settings.cabinetWebsite")}</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={cabinetInfo.company_website}
                  onChange={(e) => handleChange("company_website", e.target.value)}
                  placeholder="https://www.cabinet.ch"
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Functional Emails */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5 text-primary" />
            {t("settings.functionalEmails")}
          </CardTitle>
          <CardDescription>
            {t("settings.functionalEmailsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t("settings.functionalEmailsWarning")}
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("settings.backofficeEmail")}</Label>
              <Input
                type="email"
                value={cabinetInfo.email_sender_address}
                onChange={(e) => handleChange("email_sender_address", e.target.value)}
                placeholder="backoffice@cabinet.ch"
              />
              <p className="text-xs text-muted-foreground">
                {t("settings.backofficeEmailDesc")}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t("settings.claimsEmail")}</Label>
              <Input
                type="email"
                value={cabinetInfo.claims_notification_email}
                onChange={(e) => handleChange("claims_notification_email", e.target.value)}
                placeholder="sinistres@cabinet.ch"
              />
              <p className="text-xs text-muted-foreground">
                {t("settings.claimsEmailDesc")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            {t("settings.financialInfo")}
          </CardTitle>
          <CardDescription>
            {t("settings.financialInfoDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>IBAN</Label>
              <Input
                value={cabinetInfo.iban}
                onChange={(e) => handleChange("iban", e.target.value)}
                placeholder="CH00 0000 0000 0000 0000 0"
              />
            </div>
            <div className="space-y-2">
              <Label>QR-IBAN</Label>
              <Input
                value={cabinetInfo.qr_iban}
                onChange={(e) => handleChange("qr_iban", e.target.value)}
                placeholder="CH00 0000 0000 0000 0000 0"
              />
            </div>
          </div>

          <div className="space-y-2 max-w-sm">
            <Label>{t("settings.vatNumber")}</Label>
            <Input
              value={cabinetInfo.vat_number}
              onChange={(e) => handleChange("vat_number", e.target.value)}
              placeholder="CHE-000.000.000"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("common.saving")}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {t("common.save")}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
