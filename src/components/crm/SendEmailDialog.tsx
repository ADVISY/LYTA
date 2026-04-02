import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Send, Loader2 } from "lucide-react";
import { useCrmEmails } from "@/hooks/useCrmEmails";

interface SendEmailDialogProps {
  clientEmail: string;
  clientName: string;
  disabled?: boolean;
}

export default function SendEmailDialog({ clientEmail, clientName, disabled }: SendEmailDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [sending, setSending] = useState(false);
  const { sendEmail } = useCrmEmails();

  const emailTemplates = [
    {
      value: "welcome",
      label: t("forms.email.templates.welcome"),
      description: t("forms.email.templates.welcomeDescription"),
      icon: "👋",
    },
    {
      value: "relation_client",
      label: t("forms.email.templates.relationClient"),
      description: t("forms.email.templates.relationClientDescription"),
      icon: "💬",
    },
    {
      value: "offre_speciale",
      label: t("forms.email.templates.specialOffer"),
      description: t("forms.email.templates.specialOfferDescription"),
      icon: "🎁",
    },
  ];

  const handleSend = async () => {
    if (!selectedTemplate || !clientEmail) return;
    
    setSending(true);
    try {
      const result = await sendEmail({
        type: selectedTemplate as any,
        clientEmail,
        clientName,
      });
      
      if (result.success) {
        setOpen(false);
        setSelectedTemplate("");
      }
    } finally {
      setSending(false);
    }
  };

  const selectedTemplateInfo = emailTemplates.find(t => t.value === selectedTemplate);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || !clientEmail}>
          <Mail className="h-4 w-4 mr-2" />
          {t("forms.email.sendEmail")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            {t("forms.email.sendEmail")}
          </DialogTitle>
          <DialogDescription>
            {t("forms.email.sendTo", { name: clientName, email: clientEmail })}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("forms.email.chooseTemplate")}</label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder={t("forms.email.selectTemplate")} />
              </SelectTrigger>
              <SelectContent>
                {emailTemplates.map((template) => (
                  <SelectItem key={template.value} value={template.value}>
                    <div className="flex items-center gap-2">
                      <span>{template.icon}</span>
                      <span>{template.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedTemplateInfo && (
            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{selectedTemplateInfo.icon}</span>
                <span className="font-medium">{selectedTemplateInfo.label}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedTemplateInfo.description}
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={!selectedTemplate || sending}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("forms.email.sending")}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {t("forms.email.send")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
