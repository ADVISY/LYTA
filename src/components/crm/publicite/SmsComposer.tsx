import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Send, Users, User, FileText, Search, X, Loader2, MessageSquare, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Client {
  id: string;
  first_name: string | null;
  last_name: string | null;
  mobile: string | null;
  phone: string | null;
  company_name: string | null;
}

interface SmsTemplate {
  id: string;
  name: string;
  body_html: string;
}

export const SmsComposer = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [selectedClients, setSelectedClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [singlePhone, setSinglePhone] = useState("");
  const [singleName, setSingleName] = useState("");

  const { data: clients } = useQuery({
    queryKey: ["clients-for-sms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name, mobile, phone, company_name")
        .order("last_name");
      if (error) throw error;
      return data?.filter(c => c.mobile || c.phone) as Client[];
    },
  });

  const { data: templates } = useQuery({
    queryKey: ["sms-templates-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("id, name, body_html")
        .eq("is_active", true)
        .eq("category", "sms")
        .order("name");
      if (error) throw error;
      return data as SmsTemplate[];
    },
  });

  const filteredClients = clients?.filter((client) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    const fullName = `${client.first_name || ""} ${client.last_name || ""}`.toLowerCase();
    return (
      fullName.includes(search) ||
      client.mobile?.includes(search) ||
      client.phone?.includes(search) ||
      client.company_name?.toLowerCase().includes(search)
    );
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    if (templateId === "none") {
      return;
    }
    const template = templates?.find((t) => t.id === templateId);
    if (template) {
      setMessage(template.body_html);
    }
  };

  const toggleClient = (client: Client) => {
    setSelectedClients((prev) => {
      const exists = prev.find((c) => c.id === client.id);
      if (exists) {
        return prev.filter((c) => c.id !== client.id);
      }
      return [...prev, client];
    });
  };

  const selectAllFiltered = () => {
    if (filteredClients) {
      setSelectedClients(filteredClients);
    }
  };

  const clearSelection = () => {
    setSelectedClients([]);
  };

  const getClientDisplayName = (client: Client) => {
    if (client.first_name || client.last_name) {
      return `${client.first_name || ""} ${client.last_name || ""}`.trim();
    }
    return client.company_name || "Client";
  };

  const getClientPhone = (client: Client) => {
    return client.mobile || client.phone || "";
  };

  const handleSend = async () => {
    if (mode === "single") {
      if (!singlePhone || !message) {
        toast({ title: t('smsComposer.phoneAndMessageRequired'), variant: "destructive" });
        return;
      }
    } else {
      if (selectedClients.length === 0 || !message) {
        toast({ title: t('smsComposer.selectClientAndMessage'), variant: "destructive" });
        return;
      }
    }

    setIsSending(true);

    try {
      // Call the SMS edge function
      const recipients = mode === "single" 
        ? [{ phone: singlePhone, name: singleName || "Client" }]
        : selectedClients.map(c => ({ phone: getClientPhone(c), name: getClientDisplayName(c) }));

      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: { recipients, message },
      });

      if (error) throw error;

      toast({
        title: t('smsComposer.smsSent'),
        description: t('smsComposer.smsSentSuccess', { count: recipients.length }),
      });

      // Reset form
      setSelectedClients([]);
      setSinglePhone("");
      setSingleName("");
      if (!selectedTemplate || selectedTemplate === "none") {
        setMessage("");
      }
    } catch (error: any) {
      console.error("SMS error:", error);
      toast({
        title: t('smsComposer.smsError'),
        description: error.message || t('common.error'),
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const characterCount = message.length;
  const smsCount = Math.ceil(characterCount / 160) || 1;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Composer Panel */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              {t('smsComposer.title')}
            </CardTitle>
            <CardDescription>
              {t('smsComposer.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('smsComposer.twilioWarning')}
              </AlertDescription>
            </Alert>

            {/* Mode Toggle */}
            <div className="flex gap-2">
              <Button
                variant={mode === "single" ? "default" : "outline"}
                onClick={() => setMode("single")}
                className="flex-1"
              >
                <User className="h-4 w-4 mr-2" />
                {t('smsComposer.singleSms')}
              </Button>
              <Button
                variant={mode === "bulk" ? "default" : "outline"}
                onClick={() => setMode("bulk")}
                className="flex-1"
              >
                <Users className="h-4 w-4 mr-2" />
                {t('smsComposer.bulkSms')}
              </Button>
            </div>

            {mode === "single" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="single-phone">{t('smsComposer.phoneNumber')}</Label>
                  <Input
                    id="single-phone"
                    type="tel"
                    value={singlePhone}
                    onChange={(e) => setSinglePhone(e.target.value)}
                    placeholder={t('smsComposer.phoneNumberPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="single-name">{t('smsComposer.nameOptional')}</Label>
                  <Input
                    id="single-name"
                    value={singleName}
                    onChange={(e) => setSingleName(e.target.value)}
                    placeholder={t('smsComposer.namePlaceholder')}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{t('smsComposer.selectedRecipients')} ({selectedClients.length})</Label>
                {selectedClients.length > 0 ? (
                  <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/50 max-h-32 overflow-y-auto">
                    {selectedClients.map((client) => (
                      <Badge key={client.id} variant="secondary" className="gap-1">
                        {getClientDisplayName(client)}
                        <button
                          onClick={() => toggleClient(client)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground p-3 border rounded-lg border-dashed">
                    {t('smsComposer.usePanelToSelect')}
                  </p>
                )}
              </div>
            )}

            {/* Template Selection */}
            <div className="space-y-2">
              <Label>{t('smsComposer.templateOptional')}</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder={t('smsComposer.selectTemplate')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('smsComposer.noTemplate')}</SelectItem>
                  {templates?.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {template.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="message">{t('smsComposer.message')}</Label>
                <span className={`text-xs ${characterCount > 160 ? "text-yellow-500" : "text-muted-foreground"}`}>
                  {characterCount}/160 ({smsCount} {t('smsComposer.smsCount')})
                </span>
              </div>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('smsComposer.messagePlaceholder')}
                rows={4}
                maxLength={480}
              />
              <p className="text-xs text-muted-foreground">
                {t('smsComposer.variablesHint')}: {"{{client_name}}"}, {"{{company_name}}"}, {"{{agent_name}}"}
              </p>
            </div>

            {/* Send Button */}
            <Button
              onClick={handleSend}
              disabled={isSending || (mode === "single" ? !singlePhone : selectedClients.length === 0) || !message}
              className="w-full"
              size="lg"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('smsComposer.sending')}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {mode === "single"
                    ? t('smsComposer.sendSms')
                    : t('smsComposer.sendToRecipients', { count: selectedClients.length })}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Client Selection Panel */}
      {mode === "bulk" ? (
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('smsComposer.selectClients')}</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('smsComposer.searchClients')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-2 mb-3">
              <Button variant="outline" size="sm" onClick={selectAllFiltered} className="flex-1">
                {t('smsComposer.selectAll')}
              </Button>
              <Button variant="outline" size="sm" onClick={clearSelection} className="flex-1">
                {t('smsComposer.clear')}
              </Button>
            </div>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredClients?.map((client) => {
                  const phone = getClientPhone(client);
                  if (!phone) return null;
                  const isSelected = selectedClients.some((c) => c.id === client.id);
                  return (
                    <div
                      key={client.id}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected ? "bg-blue-500/10 border border-blue-500/20" : "hover:bg-muted"
                      }`}
                      onClick={() => toggleClient(client)}
                    >
                      <Checkbox checked={isSelected} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {getClientDisplayName(client)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {phone}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : (
        message && (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">{t('smsComposer.preview')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-xs mx-auto">
                <div className="bg-blue-500 text-white rounded-2xl rounded-br-sm p-4">
                  <p className="text-sm whitespace-pre-wrap">{message}</p>
                </div>
                <p className="text-xs text-muted-foreground text-right mt-2">
                  {characterCount} {t('smsComposer.characters')} • {smsCount} {t('smsComposer.smsCount')}
                </p>
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
};