import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Plus, FileText } from "lucide-react";
import { usePolicies } from "@/hooks/usePolicies";
import { useInsuranceCompanies } from "@/hooks/useInsuranceCompanies";
import { useInsuranceProducts } from "@/hooks/useInsuranceProducts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ContractsSection({ userId }: { userId: string }) {
  const { policies, loading, createPolicy } = usePolicies();
  const { companies } = useInsuranceCompanies();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const { products } = useInsuranceProducts(selectedCompanyId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    company_id: '',
    product_id: '',
    policy_number: '',
    start_date: '',
    end_date: '',
    premium_monthly: '',
    premium_yearly: '',
    deductible: '',
    status: 'pending',
    currency: 'CHF',
    notes: ''
  });
  
  // Filter policies for this specific client
  const clientPolicies = policies.filter(p => p.client_id === userId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await createPolicy({
        client_id: userId,
        product_id: formData.product_id,
        policy_number: formData.policy_number || null,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        premium_monthly: formData.premium_monthly ? parseFloat(formData.premium_monthly) : null,
        premium_yearly: formData.premium_yearly ? parseFloat(formData.premium_yearly) : null,
        deductible: formData.deductible ? parseFloat(formData.deductible) : null,
        status: formData.status,
        currency: formData.currency,
        notes: formData.notes || null,
      });
      
      setIsModalOpen(false);
      setSelectedCompanyId('');
      setFormData({
        company_id: '',
        product_id: '',
        policy_number: '',
        start_date: '',
        end_date: '',
        premium_monthly: '',
        premium_yearly: '',
        deductible: '',
        status: 'pending',
        currency: 'CHF',
        notes: ''
      });
    } catch (error) {
      console.error('Error creating policy:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <CardTitle>Polices d'assurance</CardTitle>
              </div>
              <Button size="sm" onClick={() => setIsModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau contrat
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {clientPolicies.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Aucun contrat</p>
                <p className="text-sm">
                  Ce client n'a pas encore de police d'assurance.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {clientPolicies.map((policy) => (
                  <div
                    key={policy.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold">{policy.product?.name || 'Produit inconnu'}</h4>
                        <Badge variant={
                          policy.status === 'active' ? 'default' :
                          policy.status === 'pending' ? 'secondary' : 'outline'
                        }>
                          {policy.status === 'active' ? 'Actif' : 
                           policy.status === 'pending' ? 'En attente' : policy.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Compagnie: {policy.product?.company?.name || 'N/A'}</p>
                        {policy.policy_number && (
                          <p>N° Police: {policy.policy_number}</p>
                        )}
                        <p>Début: {format(new Date(policy.start_date), 'dd MMM yyyy', { locale: fr })}</p>
                        {policy.premium_monthly && (
                          <p className="font-medium text-foreground">
                            Prime: CHF {policy.premium_monthly}/mois
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau contrat d'assurance</DialogTitle>
            <DialogDescription>
              Créer une nouvelle police d'assurance pour ce client
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>N° de Police</Label>
              <Input
                placeholder="POL-2024-001"
                value={formData.policy_number}
                onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Compagnie d'assurance *</Label>
              <Select 
                value={formData.company_id} 
                onValueChange={(value) => {
                  setFormData({ ...formData, company_id: value, product_id: '' });
                  setSelectedCompanyId(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une compagnie" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Produit d'assurance *</Label>
              <Select 
                value={formData.product_id} 
                onValueChange={(value) => setFormData({ ...formData, product_id: value })}
                disabled={!selectedCompanyId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedCompanyId ? "Sélectionner un produit" : "Sélectionner d'abord une compagnie"} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} - {product.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de début *</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Date de fin</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prime mensuelle (CHF)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="150.00"
                  value={formData.premium_monthly}
                  onChange={(e) => setFormData({ ...formData, premium_monthly: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Prime annuelle (CHF)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="1800.00"
                  value={formData.premium_yearly}
                  onChange={(e) => setFormData({ ...formData, premium_yearly: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Franchise (CHF)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="300.00"
                value={formData.deductible}
                onChange={(e) => setFormData({ ...formData, deductible: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="expired">Expiré</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Notes additionnelles..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">
                Créer le contrat
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
