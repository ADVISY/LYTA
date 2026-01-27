import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, 
  Send, 
  Phone, 
  Mail, 
  Clock,
  Building2,
  MapPin,
  Globe
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";

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
  const { t } = useTranslation();
  const { clientData, advisorData } = useOutletContext<{ 
    user: any; 
    clientData: any; 
    advisorData: AdvisorData | null;
  }>();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Get tenant branding info
  const branding = tenant?.branding;
  const cabinetName = branding?.display_name || tenant?.name || "Cabinet";
  const cabinetPhone = branding?.company_phone;
  const cabinetEmail = branding?.company_email;
  const cabinetAddress = branding?.company_address;
  const cabinetWebsite = branding?.company_website;
  const cabinetLogo = branding?.logo_url;

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    setSending(true);
    
    // Simulate sending message
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: t('clientMessages.messageSent'),
      description: t('clientMessages.messageSuccessDescription'),
    });
    
    setMessage("");
    setSending(false);
  };

  // Advisor helpers
  const hasAdvisor = advisorData && (advisorData.first_name || advisorData.last_name);
  
  const getAdvisorName = () => {
    if (hasAdvisor) {
      return `${advisorData!.first_name || ''} ${advisorData!.last_name || ''}`.trim();
    }
    return null;
  };

  const getAdvisorInitials = () => {
    if (hasAdvisor) {
      return `${advisorData!.first_name?.[0] || ''}${advisorData!.last_name?.[0] || ''}`.toUpperCase();
    }
    return cabinetName[0]?.toUpperCase() || "C";
  };

  const getAdvisorEmail = () => advisorData?.email || null;
  const getAdvisorPhone = () => advisorData?.mobile || advisorData?.phone || null;
  
  const formatPhoneForLink = (phone: string) => phone.replace(/\s/g, '').replace('+', '');
  
  const getWhatsAppLink = (phone: string) => {
    return `https://wa.me/${formatPhoneForLink(phone)}`;
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold">{t('clientMessages.title')}</h1>
        <p className="text-sm lg:text-base text-muted-foreground">{t('clientMessages.subtitle', { cabinet: cabinetName })}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Contact Form */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2 lg:pb-4">
              <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                <MessageCircle className="h-4 w-4 lg:h-5 lg:w-5" />
                {t('clientMessages.sendMessage')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 lg:space-y-4">
              <Textarea
                placeholder={t('clientMessages.placeholder')}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="resize-none text-base"
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={!message.trim() || sending}
                className="gap-2 w-full sm:w-auto h-11"
              >
                <Send className="h-4 w-4" />
                {sending ? t('clientMessages.sending') : t('clientMessages.send')}
              </Button>
            </CardContent>
          </Card>

          {/* Message History Placeholder */}
          <Card>
            <CardHeader className="pb-2 lg:pb-4">
              <CardTitle className="text-base lg:text-lg">{t('clientMessages.history')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6 lg:py-8 text-muted-foreground">
                <MessageCircle className="h-10 w-10 lg:h-12 lg:w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm lg:text-base">{t('clientMessages.noMessages')}</p>
                <p className="text-xs lg:text-sm">{t('clientMessages.messagesWillAppear')}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contact Info Sidebar */}
        <div className="space-y-4">
          {/* Personal Advisor Card */}
          {hasAdvisor && (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="pb-2 lg:pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base lg:text-lg">{t('clientMessages.yourAdvisor')}</CardTitle>
                  <Badge variant="secondary" className="text-[10px] lg:text-xs">{t('clientMessages.personal')}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 lg:space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 lg:h-14 lg:w-14 ring-2 ring-primary/20">
                    {advisorData?.photo_url ? (
                      <AvatarImage 
                        src={advisorData.photo_url} 
                        alt={getAdvisorName() || t('clientMessages.insuranceAdvisor')}
                        className="object-cover"
                      />
                    ) : null}
                    <AvatarFallback className="bg-primary text-primary-foreground text-base lg:text-lg font-medium">
                      {getAdvisorInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-base lg:text-lg">{getAdvisorName()}</p>
                    <p className="text-xs lg:text-sm text-muted-foreground">{t('clientMessages.insuranceAdvisor')}</p>
                  </div>
                </div>
                
                <div className="pt-2 lg:pt-3 border-t space-y-1.5 lg:space-y-2">
                  {getAdvisorEmail() && (
                    <a 
                      href={`mailto:${getAdvisorEmail()}`} 
                      className="flex items-center gap-3 p-2 lg:p-2.5 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs lg:text-sm truncate">{getAdvisorEmail()}</span>
                    </a>
                  )}
                  
                  {getAdvisorPhone() && (
                    <>
                      <a 
                        href={`tel:${formatPhoneForLink(getAdvisorPhone()!)}`} 
                        className="flex items-center gap-3 p-2 lg:p-2.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs lg:text-sm">{getAdvisorPhone()}</span>
                      </a>
                      
                      {/* WhatsApp Button */}
                      <a 
                        href={getWhatsAppLink(getAdvisorPhone()!)} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors border border-emerald-200 dark:border-emerald-800"
                      >
                        <div className="h-5 w-5 text-emerald-600">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{t('clientMessages.whatsapp')}</p>
                          <p className="text-xs text-muted-foreground">{t('clientMessages.chatNow')}</p>
                        </div>
                      </a>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cabinet Info Card */}
          <Card>
            <CardHeader className="pb-2 lg:pb-3">
              <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                <Building2 className="h-4 w-4 lg:h-5 lg:w-5" />
                {cabinetName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 lg:space-y-3">
              {cabinetLogo && (
                <div className="flex justify-center pb-2">
                  <img 
                    src={cabinetLogo} 
                    alt={cabinetName} 
                    className="h-10 lg:h-12 object-contain"
                  />
                </div>
              )}
              
              {cabinetAddress && (
                <div className="flex items-start gap-3 text-xs lg:text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{cabinetAddress}</span>
                </div>
              )}
              
              {cabinetPhone && (
                <a 
                  href={`tel:${formatPhoneForLink(cabinetPhone)}`}
                  className="flex items-center gap-3 text-xs lg:text-sm hover:text-primary transition-colors p-2 -mx-2 rounded-lg hover:bg-muted"
                >
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{cabinetPhone}</span>
                </a>
              )}
              
              {cabinetEmail && (
                <a 
                  href={`mailto:${cabinetEmail}`}
                  className="flex items-center gap-3 text-xs lg:text-sm hover:text-primary transition-colors p-2 -mx-2 rounded-lg hover:bg-muted"
                >
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{cabinetEmail}</span>
                </a>
              )}
              
              {cabinetWebsite && (
                <a 
                  href={cabinetWebsite.startsWith('http') ? cabinetWebsite : `https://${cabinetWebsite}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-xs lg:text-sm hover:text-primary transition-colors p-2 -mx-2 rounded-lg hover:bg-muted"
                >
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{cabinetWebsite}</span>
                </a>
              )}
              
              <div className="flex items-center gap-3 pt-2 border-t text-xs lg:text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t('clientMessages.openingHours')}</p>
                  <p className="text-muted-foreground">{t('clientMessages.openingHoursValue')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Urgent Help Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3 lg:p-4">
              <p className="text-xs lg:text-sm text-center">
                <span className="font-medium">{t('clientMessages.urgentHelp')}</span>
                <br />
                {getAdvisorPhone() ? (
                  <a href={`tel:${formatPhoneForLink(getAdvisorPhone()!)}`} className="text-primary hover:underline font-medium">
                    {t('clientMessages.callAdvisor', { name: getAdvisorName() || t('clientMessages.yourAdvisor') })}
                  </a>
                ) : cabinetPhone ? (
                  <a href={`tel:${formatPhoneForLink(cabinetPhone)}`} className="text-primary hover:underline font-medium">
                    {t('clientMessages.callCabinet')}
                  </a>
                ) : (
                  <span className="text-muted-foreground">{t('clientMessages.contactAdvisor')}</span>
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
