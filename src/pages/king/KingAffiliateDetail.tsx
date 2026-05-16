import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  User,
  Mail,
  Percent,
  Calendar,
  Building2,
  Wallet,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAffiliateCommissions, Affiliate, AffiliateCommission } from "@/hooks/useAffiliates";
import { AffiliateInvoiceTab } from "@/components/king/AffiliateInvoiceTab";
import { DataPagination } from "@/components/ui/DataPagination";
import { format, addMonths, isBefore } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

type TenantWithCommissions = {
  id: string;
  name: string;
  slug: string;
  status: string;
  activated_at: string | null;
  affiliate_linked_at: string | null;
  affiliate_eligibility_end: string | null;
  affiliate_commission_rate: number | null;
  total_commissions: number;
  commissions_count: number;
};

export default function KingAffiliateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { commissions, loading: commissionsLoading, markAsPaid, fetchCommissions, page: commissionsPage, totalPages: commissionsTotalPages, totalCount: commissionsTotalCount, goToPage: commissionsGoToPage } = useAffiliateCommissions(id);
  
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [tenants, setTenants] = useState<TenantWithCommissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommissions, setSelectedCommissions] = useState<string[]>([]);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-CH', { 
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(amount) + ' CHF';
  };

  const fetchAffiliateData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      
      // Fetch affiliate
      const { data: affiliateData, error: affError } = await supabase
        .from('affiliates')
        .select('*')
        .eq('id', id)
        .single();
      
      if (affError) throw affError;
      setAffiliate(affiliateData);

      // Fetch tenants linked to this affiliate
      const { data: tenantsData, error: tenError } = await supabase
        .from('tenants')
        .select('id, name, slug, status, activated_at, affiliate_linked_at, affiliate_eligibility_end, affiliate_commission_rate')
        .eq('affiliate_id', id)
        .order('affiliate_linked_at', { ascending: false });
      
      if (tenError) throw tenError;

      // Fetch commissions for each tenant
      const { data: allCommissions, error: commError } = await supabase
        .from('affiliate_commissions')
        .select('tenant_id, commission_amount, status')
        .eq('affiliate_id', id);

      if (commError) throw commError;

      // Calculate per-tenant stats
      const tenantsWithStats: TenantWithCommissions[] = (tenantsData || []).map(tenant => {
        const tenantCommissions = allCommissions?.filter(c => c.tenant_id === tenant.id) || [];
        return {
          ...tenant,
          total_commissions: tenantCommissions
            .filter(c => c.status !== 'cancelled')
            .reduce((sum, c) => sum + Number(c.commission_amount), 0),
          commissions_count: tenantCommissions.filter(c => c.status !== 'cancelled').length
        };
      });

      setTenants(tenantsWithStats);
    } catch (error: any) {
      console.error('Error fetching affiliate data:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données de l'affilié",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAffiliateData();
  }, [id]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const dueCommissions = commissions.filter(c => c.status === 'due').map(c => c.id);
      setSelectedCommissions(dueCommissions);
    } else {
      setSelectedCommissions([]);
    }
  };

  const handleSelectCommission = (commissionId: string, checked: boolean) => {
    if (checked) {
      setSelectedCommissions([...selectedCommissions, commissionId]);
    } else {
      setSelectedCommissions(selectedCommissions.filter(id => id !== commissionId));
    }
  };

  const handleMarkAsPaid = async () => {
    if (selectedCommissions.length === 0) return;
    
    setIsSubmitting(true);
    try {
      await markAsPaid(selectedCommissions, new Date(paymentDate));
      setSelectedCommissions([]);
      setIsPayDialogOpen(false);
    } catch (error) {
      // Error handled in hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalDue = commissions
    .filter(c => c.status === 'due')
    .reduce((sum, c) => sum + c.commission_amount, 0);

  const totalPaid = commissions
    .filter(c => c.status === 'paid')
    .reduce((sum, c) => sum + c.commission_amount, 0);

  const selectedAmount = commissions
    .filter(c => selectedCommissions.includes(c.id))
    .reduce((sum, c) => sum + c.commission_amount, 0);

  const now = new Date();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!affiliate) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Affilié non trouvé</h3>
        <Button onClick={() => navigate('/king/affiliates')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour à la liste
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/king/affiliates')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">
            {affiliate.first_name} {affiliate.last_name}
          </h1>
          <p className="text-muted-foreground">{affiliate.email}</p>
        </div>
        <Badge variant={affiliate.status === "active" ? "default" : "secondary"} className="text-sm">
          {affiliate.status === "active" ? "Actif" : "Inactif"}
        </Badge>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Percent className="h-4 w-4" />
              <span className="text-sm">Taux de commission</span>
            </div>
            <p className="text-2xl font-bold">{affiliate.commission_rate}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Building2 className="h-4 w-4" />
              <span className="text-sm">Tenants apportés</span>
            </div>
            <p className="text-2xl font-bold">{tenants.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-sm">Commissions dues</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalDue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm">Commissions payées</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {affiliate.notes && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="text-sm font-medium mb-1">Notes internes</p>
                <p className="text-sm text-muted-foreground">{affiliate.notes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="tenants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tenants">Tenants ({tenants.length})</TabsTrigger>
          <TabsTrigger value="commissions">Commissions ({commissions.length})</TabsTrigger>
          <TabsTrigger value="invoice">Facture mensuelle</TabsTrigger>
        </TabsList>

        <TabsContent value="invoice">
          <AffiliateInvoiceTab affiliateId={id!} />
        </TabsContent>

        <TabsContent value="tenants">
          <Card>
            <CardHeader>
              <CardTitle>Tenants apportés par cet affilié</CardTitle>
              <CardDescription>
                Liste des cabinets créés avec cet affilié comme parrain
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tenants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucun tenant associé à cet affilié</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Date activation</TableHead>
                      <TableHead>Fin d'éligibilité</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Taux snapshot</TableHead>
                      <TableHead className="text-right">Commissions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((tenant) => {
                      const isEligible = tenant.affiliate_eligibility_end && 
                        isBefore(now, new Date(tenant.affiliate_eligibility_end));
                      
                      return (
                        <TableRow key={tenant.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{tenant.name}</p>
                              <p className="text-sm text-muted-foreground">{tenant.slug}.lyta.ch</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {tenant.activated_at 
                              ? format(new Date(tenant.activated_at), 'dd MMM yyyy', { locale: fr })
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            {tenant.affiliate_eligibility_end 
                              ? format(new Date(tenant.affiliate_eligibility_end), 'dd MMM yyyy', { locale: fr })
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            <Badge variant={isEligible ? "default" : "secondary"}>
                              {isEligible ? "En cours" : "Terminé"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {tenant.affiliate_commission_rate}%
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(tenant.total_commissions)}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({tenant.commissions_count})
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Historique des commissions</CardTitle>
                <CardDescription>
                  Toutes les commissions générées par les paiements des tenants
                </CardDescription>
              </div>
              {selectedCommissions.length > 0 && (
                <Button onClick={() => setIsPayDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Payer {selectedCommissions.length} commission(s)
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {commissionsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-muted border-t-primary" />
                </div>
              ) : commissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune commission enregistrée</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedCommissions.length === commissions.filter(c => c.status === 'due').length && selectedCommissions.length > 0}
                          onCheckedChange={(checked) => handleSelectAll(!!checked)}
                        />
                      </TableHead>
                      <TableHead>Date paiement</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead className="text-right">Montant payé</TableHead>
                      <TableHead className="text-right">Taux</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Payé le</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((commission) => (
                      <TableRow key={commission.id} className={cn(
                        commission.status === 'cancelled' && 'opacity-50'
                      )}>
                        <TableCell>
                          {commission.status === 'due' && (
                            <Checkbox
                              checked={selectedCommissions.includes(commission.id)}
                              onCheckedChange={(checked) => handleSelectCommission(commission.id, !!checked)}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(commission.payment_date), 'dd MMM yyyy', { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{commission.tenant?.name || '-'}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(commission.payment_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {commission.commission_rate}%
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(commission.commission_amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            commission.status === 'paid' ? 'default' :
                            commission.status === 'due' ? 'secondary' : 'destructive'
                          }>
                            {commission.status === 'paid' ? 'Payé' : 
                             commission.status === 'due' ? 'À payer' : 'Annulé'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {commission.paid_at 
                            ? format(new Date(commission.paid_at), 'dd MMM yyyy', { locale: fr })
                            : '-'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <DataPagination
                page={commissionsPage}
                totalPages={commissionsTotalPages}
                totalCount={commissionsTotalCount}
                onPageChange={commissionsGoToPage}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pay Dialog */}
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marquer les commissions comme payées</DialogTitle>
            <DialogDescription>
              Vous allez marquer {selectedCommissions.length} commission(s) comme payée(s) pour un total de {formatCurrency(selectedAmount)}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="payment_date">Date de paiement</Label>
            <Input
              id="payment_date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleMarkAsPaid}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? "Traitement..." : "Confirmer le paiement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
