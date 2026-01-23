import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  MessageCircle, 
  Send, 
  Phone, 
  Mail, 
  Clock,
  User
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AdvisorData = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  photo_url: string | null;
};

export default function ClientMessages() {
  const { clientData, advisorData } = useOutletContext<{ 
    user: any; 
    clientData: any; 
    advisorData: AdvisorData | null;
  }>();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    setSending(true);
    
    // Simulate sending message
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Message envoyé",
      description: "Votre conseiller vous répondra dans les plus brefs délais",
    });
    
    setMessage("");
    setSending(false);
  };

  const getAdvisorName = () => {
    if (advisorData?.first_name || advisorData?.last_name) {
      return `${advisorData.first_name || ''} ${advisorData.last_name || ''}`.trim();
    }
    return "Équipe Advisy";
  };

  const getAdvisorInitials = () => {
    if (advisorData?.first_name || advisorData?.last_name) {
      return `${advisorData.first_name?.[0] || ''}${advisorData.last_name?.[0] || ''}`.toUpperCase();
    }
    return "A";
  };

  const getAdvisorEmail = () => advisorData?.email || "contact@advisy.ch";
  const getAdvisorPhone = () => advisorData?.mobile || advisorData?.phone || "+41 21 922 09 60";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-muted-foreground">Contactez votre conseiller</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Form */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Envoyer un message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Écrivez votre message ici..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={!message.trim() || sending}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {sending ? "Envoi en cours..." : "Envoyer"}
              </Button>
            </CardContent>
          </Card>

          {/* Message History Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Historique des messages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Aucun message pour le moment</p>
                <p className="text-sm">Vos échanges avec votre conseiller apparaîtront ici</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contact Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Votre conseiller</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  {advisorData?.photo_url ? (
                    <AvatarImage 
                      src={advisorData.photo_url} 
                      alt={getAdvisorName()}
                      className="object-cover"
                    />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                    {getAdvisorInitials()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{getAdvisorName()}</p>
                  <p className="text-sm text-muted-foreground">Conseiller assurance</p>
                </div>
              </div>
              
              <div className="pt-4 border-t space-y-3">
                <a 
                  href={`mailto:${getAdvisorEmail()}`} 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">{getAdvisorEmail()}</p>
                  </div>
                </a>
                
                <a 
                  href={`tel:${getAdvisorPhone().replace(/\s/g, '')}`} 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Téléphone</p>
                    <p className="text-sm text-muted-foreground">{getAdvisorPhone()}</p>
                  </div>
                </a>
                
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Horaires</p>
                    <p className="text-sm text-muted-foreground">Lun-Ven: 9h-18h</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <p className="text-sm text-center">
                <span className="font-medium">Besoin d'aide urgente?</span>
                <br />
                <a href={`tel:${getAdvisorPhone().replace(/\s/g, '')}`} className="text-primary hover:underline">
                  Appelez-nous directement
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
