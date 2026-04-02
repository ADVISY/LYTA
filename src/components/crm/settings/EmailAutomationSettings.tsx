import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmailAutomation } from "@/hooks/useEmailAutomation";
import { Mail, Bell, Calendar, Clock, Send, UserCheck, FileSignature, PartyPopper } from "lucide-react";
import { useTranslation } from "react-i18next";

export const EmailAutomationSettings = () => {
  const { t } = useTranslation();
  const { settings, isLoading, updateSettings, isUpdating } = useEmailAutomation();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">
            {t("emailAutomation.noSettings")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleToggle = (key: keyof typeof settings, value: boolean) => {
    updateSettings({ [key]: value });
  };

  const handleNumberChange = (key: keyof typeof settings, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > 0) {
      updateSettings({ [key]: numValue });
    }
  };

  return (
    <div className="space-y-6">
      {/* Triggered emails */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            {t("emailAutomation.triggeredTitle")}
          </CardTitle>
          <CardDescription>
            {t("emailAutomation.triggeredDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="auto_welcome_email">{t("emailAutomation.welcomeEmail")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("emailAutomation.welcomeEmailDesc")}
                </p>
              </div>
            </div>
            <Switch
              id="auto_welcome_email"
              checked={settings.auto_welcome_email}
              onCheckedChange={(checked) => handleToggle("auto_welcome_email", checked)}
              disabled={isUpdating}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSignature className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="auto_contract_deposit_email">{t("emailAutomation.contractDepositEmail")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("emailAutomation.contractDepositEmailDesc")}
                </p>
              </div>
            </div>
            <Switch
              id="auto_contract_deposit_email"
              checked={settings.auto_contract_deposit_email}
              onCheckedChange={(checked) => handleToggle("auto_contract_deposit_email", checked)}
              disabled={isUpdating}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSignature className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="auto_contract_signed_email">{t("emailAutomation.contractSignedEmail")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("emailAutomation.contractSignedEmailDesc")}
                </p>
              </div>
            </div>
            <Switch
              id="auto_contract_signed_email"
              checked={settings.auto_contract_signed_email}
              onCheckedChange={(checked) => handleToggle("auto_contract_signed_email", checked)}
              disabled={isUpdating}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSignature className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="auto_mandat_signed_email">{t("emailAutomation.mandatSignedEmail")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("emailAutomation.mandatSignedEmailDesc")}
                </p>
              </div>
            </div>
            <Switch
              id="auto_mandat_signed_email"
              checked={settings.auto_mandat_signed_email}
              onCheckedChange={(checked) => handleToggle("auto_mandat_signed_email", checked)}
              disabled={isUpdating}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="auto_account_created_email">{t("emailAutomation.accountCreatedEmail")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("emailAutomation.accountCreatedEmailDesc")}
                </p>
              </div>
            </div>
            <Switch
              id="auto_account_created_email"
              checked={settings.auto_account_created_email}
              onCheckedChange={(checked) => handleToggle("auto_account_created_email", checked)}
              disabled={isUpdating}
            />
          </div>
        </CardContent>
      </Card>

      {/* Scheduled emails */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {t("emailAutomation.scheduledTitle")}
          </CardTitle>
          <CardDescription>
            {t("emailAutomation.scheduledDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div className="space-y-0.5">
                  <Label htmlFor="enable_renewal_reminder">{t("emailAutomation.renewalReminder")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("emailAutomation.renewalReminderDesc")}
                  </p>
                </div>
              </div>
              <Switch
                id="enable_renewal_reminder"
                checked={settings.enable_renewal_reminder}
                onCheckedChange={(checked) => handleToggle("enable_renewal_reminder", checked)}
                disabled={isUpdating}
              />
            </div>
            {settings.enable_renewal_reminder && (
              <div className="ml-7 flex items-center gap-2">
                <Label htmlFor="renewal_reminder_days_before" className="text-sm text-muted-foreground whitespace-nowrap">
                  {t("emailAutomation.sendDaysBefore")}
                </Label>
                <Input
                  id="renewal_reminder_days_before"
                  type="number"
                  min="1"
                  max="90"
                  className="w-20"
                  value={settings.renewal_reminder_days_before}
                  onChange={(e) => handleNumberChange("renewal_reminder_days_before", e.target.value)}
                  disabled={isUpdating}
                />
                <span className="text-sm text-muted-foreground">{t("emailAutomation.daysBeforeExpiry")}</span>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <div className="space-y-0.5">
                  <Label htmlFor="enable_follow_up_reminder">{t("emailAutomation.followUpReminder")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("emailAutomation.followUpReminderDesc")}
                  </p>
                </div>
              </div>
              <Switch
                id="enable_follow_up_reminder"
                checked={settings.enable_follow_up_reminder}
                onCheckedChange={(checked) => handleToggle("enable_follow_up_reminder", checked)}
                disabled={isUpdating}
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PartyPopper className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="enable_birthday_email">{t("emailAutomation.birthdayEmail")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("emailAutomation.birthdayEmailDesc")}
                </p>
              </div>
            </div>
            <Switch
              id="enable_birthday_email"
              checked={settings.enable_birthday_email}
              onCheckedChange={(checked) => handleToggle("enable_birthday_email", checked)}
              disabled={isUpdating}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
