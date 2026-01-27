import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar,
  Shield,
  Save,
  Lock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function ClientProfile() {
  const { t } = useTranslation();
  const { user, clientData } = useOutletContext<{ user: any; clientData: any }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    mobile: "",
    address: "",
    city: "",
    zip_code: "",
  });

  useEffect(() => {
    if (clientData) {
      setFormData({
        first_name: clientData.first_name || "",
        last_name: clientData.last_name || "",
        email: clientData.email || user?.email || "",
        mobile: clientData.mobile || "",
        address: clientData.address || "",
        city: clientData.city || "",
        zip_code: clientData.zip_code || "",
      });
    }
  }, [clientData, user]);

  const handleSave = async () => {
    if (!clientData?.id) return;
    
    setLoading(true);
    
    const { error } = await supabase
      .from('clients')
      .update({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        mobile: formData.mobile,
        address: formData.address,
        city: formData.city,
        zip_code: formData.zip_code,
      })
      .eq('id', clientData.id);
    
    if (error) {
      toast({
        title: t('common.error'),
        description: t('clientProfile.updateError'),
        variant: "destructive"
      });
    } else {
      toast({
        title: t('clientProfile.updateSuccess'),
        description: t('clientProfile.updateSuccessDescription'),
      });
    }
    
    setLoading(false);
  };

  const getInitials = () => {
    return `${formData.first_name?.[0] || ''}${formData.last_name?.[0] || ''}`.toUpperCase() || 'C';
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{t('clientProfile.title')}</h1>
        <p className="text-muted-foreground">{t('clientProfile.subtitle')}</p>
      </div>

      {/* Profile Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-medium">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold">
                {formData.first_name} {formData.last_name}
              </h2>
              <p className="text-muted-foreground">{user?.email}</p>
              {clientData?.created_at && (
                <p className="text-sm text-muted-foreground mt-1">
                  {t('clientProfile.clientSince')} {format(new Date(clientData.created_at), 'MMMM yyyy', { locale: fr })}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('clientProfile.personalInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">{t('clientProfile.firstName')}</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">{t('clientProfile.lastName')}</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('clientProfile.email')}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">{t('clientProfile.phone')}</Label>
              <Input
                id="mobile"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {t('clientProfile.address')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">{t('clientProfile.street')}</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="zip_code">{t('clientProfile.zipCode')}</Label>
              <Input
                id="zip_code"
                value={formData.zip_code}
                onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">{t('clientProfile.city')}</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t('clientProfile.security')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="gap-2">
            <Shield className="h-4 w-4" />
            {t('clientProfile.changePassword')}
          </Button>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading} className="gap-2">
          <Save className="h-4 w-4" />
          {loading ? t('common.saving') : t('clientProfile.saveChanges')}
        </Button>
      </div>
    </div>
  );
}
