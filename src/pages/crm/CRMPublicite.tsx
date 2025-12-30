import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageSquare, FileText, History, Settings, Megaphone } from "lucide-react";
import { EmailTemplatesList } from "@/components/crm/publicite/EmailTemplatesList";
import { EmailComposer } from "@/components/crm/publicite/EmailComposer";
import { SmsComposer } from "@/components/crm/publicite/SmsComposer";
import { CampaignHistory } from "@/components/crm/publicite/CampaignHistory";
import { EmailAutomationSettings } from "@/components/crm/settings/EmailAutomationSettings";
import { CampaignStats } from "@/components/crm/publicite/CampaignStats";

export default function CRMPublicite() {
  const [activeTab, setActiveTab] = useState("email");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
              <Megaphone className="h-7 w-7 text-cyan-500" />
            </div>
            Centre Publicité
          </h1>
          <p className="text-muted-foreground mt-2">
            Gérez vos campagnes email et SMS, templates et automatisations
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <CampaignStats />

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid h-auto p-1">
          <TabsTrigger value="email" className="gap-2 py-2.5">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Email</span>
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-2 py-2.5">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">SMS</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2 py-2.5">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 py-2.5">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Historique</span>
          </TabsTrigger>
          <TabsTrigger value="automation" className="gap-2 py-2.5">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Auto</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="space-y-6">
          <EmailComposer />
        </TabsContent>

        <TabsContent value="sms" className="space-y-6">
          <SmsComposer />
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <EmailTemplatesList />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <CampaignHistory />
        </TabsContent>

        <TabsContent value="automation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Automatisation
              </CardTitle>
              <CardDescription>
                Configurez les envois automatiques d'emails et SMS
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailAutomationSettings />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
