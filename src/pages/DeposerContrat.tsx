import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCelebration } from "@/hooks/useCelebration";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileCheck, Loader2, Search, User, Building2, Check } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import advisyLogo from "@/assets/advisy-logo.svg";

type Company = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  category: string;
  company_id: string;
};

type Client = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
};

const categoryLabels: Record<string, string> = {
  health: "Santé",
  auto: "Auto",
  home: "Ménage/RC",
  life: "Vie/Prévoyance",
  legal: "Protection juridique",
  property: "Ménage/RC",
  other: "Autre",
};

export default function DeposerContrat() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { celebrate } = useCelebration();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Data
  const [clients, setClients] = useState<Client[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Search
  const [clientSearch, setClientSearch] = useState("");

  // Form data
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [premiumMonthly, setPremiumMonthly] = useState("");
  const [notes, setNotes] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      sessionStorage.setItem('loginTarget', 'team');
      navigate("/connexion");
    }
  }, [user, authLoading, navigate]);

  // Load initial data
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    const [clientsRes, companiesRes, productsRes] = await Promise.all([
      supabase.from("clients").select("id, first_name, last_name, company_name, email").order("last_name"),
      supabase.from("insurance_companies").select("id, name").order("name"),
      supabase.from("insurance_products").select("id, name, category, company_id").order("name"),
    ]);

    if (clientsRes.data) setClients(clientsRes.data);
    if (companiesRes.data) setCompanies(companiesRes.data);
    if (productsRes.data) setProducts(productsRes.data);
    setLoading(false);
  };

  const filteredClients = clients.filter((client) => {
    if (!clientSearch) return true;
    const search = clientSearch.toLowerCase();
    const fullName = `${client.first_name || ""} ${client.last_name || ""}`.toLowerCase();
    const companyName = (client.company_name || "").toLowerCase();
    const email = (client.email || "").toLowerCase();
    return fullName.includes(search) || companyName.includes(search) || email.includes(search);
  });

  const filteredProducts = products.filter((p) => p.company_id === selectedCompanyId);

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const getClientName = (client: Client) => {
    if (client.company_name) return client.company_name;
    return `${client.first_name || ""} ${client.last_name || ""}`.trim() || "Sans nom";
  };

  const handleSubmit = async () => {
    if (!selectedClientId || !selectedProductId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un client et un produit",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const premium = parseFloat(premiumMonthly) || 0;

      const { error } = await supabase.from("policies").insert({
        client_id: selectedClientId,
        product_id: selectedProductId,
        start_date: startDate,
        premium_monthly: premium,
        premium_yearly: premium * 12,
        status: "active",
        notes: notes || null,
        company_name: selectedCompany?.name || null,
        product_type: selectedProduct?.category || null,
      });

      if (error) throw error;

      celebrate("contract_added");

      toast({
        title: "Contrat déposé !",
        description: `Contrat créé avec succès pour ${getClientName(selectedClient!)}`,
      });

      // Reset form
      setStep(1);
      setSelectedClientId("");
      setSelectedCompanyId("");
      setSelectedProductId("");
      setPremiumMonthly("");
      setNotes("");
      setClientSearch("");
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le contrat",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/connexion")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={advisyLogo} alt="Advisy" className="h-8" />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" onClick={() => navigate("/crm")}>
              Accéder au CRM
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Déposer un contrat</h1>
          <p className="text-muted-foreground mt-2">Soumettez rapidement un nouveau contrat en 3 étapes</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? <Check className="h-5 w-5" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-12 h-1 mx-1 rounded ${
                    step > s ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Select Client */}
        {step === 1 && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Sélectionner le client
              </CardTitle>
              <CardDescription>Choisissez le client pour ce contrat</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un client..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2">
                {filteredClients.slice(0, 50).map((client) => (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClientId(client.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${
                      selectedClientId === client.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted"
                    }`}
                  >
                    <p className="font-medium">{getClientName(client)}</p>
                    {client.email && (
                      <p className="text-sm text-muted-foreground">{client.email}</p>
                    )}
                  </button>
                ))}
                {filteredClients.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">Aucun client trouvé</p>
                )}
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={() => setStep(2)} disabled={!selectedClientId}>
                  Continuer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Select Product */}
        {step === 2 && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Sélectionner le produit
              </CardTitle>
              <CardDescription>
                Client : <strong>{selectedClient && getClientName(selectedClient)}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Compagnie d'assurance</Label>
                <Select value={selectedCompanyId} onValueChange={(v) => {
                  setSelectedCompanyId(v);
                  setSelectedProductId("");
                }}>
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

              {selectedCompanyId && (
                <div className="space-y-2">
                  <Label>Produit</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un produit" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({categoryLabels[product.category] || product.category})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Retour
                </Button>
                <Button onClick={() => setStep(3)} disabled={!selectedProductId}>
                  Continuer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Contract Details */}
        {step === 3 && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Détails du contrat
              </CardTitle>
              <CardDescription>
                {selectedClient && getClientName(selectedClient)} • {selectedCompany?.name} • {selectedProduct?.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date de début</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prime mensuelle (CHF)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={premiumMonthly}
                    onChange={(e) => setPremiumMonthly(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes (optionnel)</Label>
                <Textarea
                  placeholder="Informations supplémentaires..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Retour
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <FileCheck className="h-4 w-4 mr-2" />
                      Déposer le contrat
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
