import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  AlertTriangle, 
  Plus, 
  Clock, 
  CheckCircle2, 
  XCircle,
  FileSearch,
  Car,
  Heart,
  Home,
  Scale,
  Shield
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import ClaimForm from "@/components/client/ClaimForm";

interface Claim {
  id: string;
  client_id: string;
  policy_id: string | null;
  claim_type: string;
  incident_date: string;
  description: string;
  status: string;
  created_at: string;
  policy?: {
    id: string;
    product_type: string;
    company_name: string;
  };
}

const claimTypeConfig: Record<string, { label: string; icon: any; color: string }> = {
  auto: { label: "Automobile", icon: Car, color: "text-blue-600 bg-blue-100" },
  sante: { label: "Santé", icon: Heart, color: "text-red-600 bg-red-100" },
  menage: { label: "Ménage/RC", icon: Home, color: "text-amber-600 bg-amber-100" },
  juridique: { label: "Protection juridique", icon: Scale, color: "text-purple-600 bg-purple-100" },
  autre: { label: "Autre", icon: Shield, color: "text-gray-600 bg-gray-100" },
};

const statusConfig: Record<string, { label: string; icon: any; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  submitted: { label: "Soumis", icon: Clock, variant: "secondary" },
  in_review: { label: "En cours d'examen", icon: FileSearch, variant: "default" },
  approved: { label: "Approuvé", icon: CheckCircle2, variant: "default" },
  rejected: { label: "Refusé", icon: XCircle, variant: "destructive" },
  closed: { label: "Clôturé", icon: CheckCircle2, variant: "outline" },
};

export default function ClientClaims() {
  const { clientData } = useOutletContext<{ user: any; clientData: any }>();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (clientData?.id) {
      fetchClaims();
    }
  }, [clientData]);

  const fetchClaims = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('claims')
      .select(`
        *,
        policy:policies!claims_policy_id_fkey (
          id, product_type, company_name
        )
      `)
      .eq('client_id', clientData.id)
      .order('created_at', { ascending: false });
    
    if (data) setClaims(data);
    setLoading(false);
  };

  const handleClaimCreated = () => {
    setDialogOpen(false);
    fetchClaims();
  };

  const pendingClaims = claims.filter(c => ['submitted', 'in_review'].includes(c.status)).length;
  const resolvedClaims = claims.filter(c => ['approved', 'closed'].includes(c.status)).length;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Déclaration de sinistre</h1>
          <p className="text-muted-foreground">Déclarez et suivez vos sinistres</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Déclarer un sinistre
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Nouvelle déclaration de sinistre
              </DialogTitle>
            </DialogHeader>
            <ClaimForm 
              clientId={clientData.id} 
              onSuccess={handleClaimCreated}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{claims.length}</p>
              <p className="text-sm text-muted-foreground">Total sinistres</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingClaims}</p>
              <p className="text-sm text-muted-foreground">En cours</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{resolvedClaims}</p>
              <p className="text-sm text-muted-foreground">Résolus</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Claims List */}
      {claims.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">Aucun sinistre déclaré</h3>
            <p className="text-muted-foreground mb-4">
              Vous n'avez pas encore déclaré de sinistre
            </p>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Déclarer un sinistre
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => {
            const typeConfig = claimTypeConfig[claim.claim_type] || claimTypeConfig.autre;
            const status = statusConfig[claim.status] || statusConfig.submitted;
            const TypeIcon = typeConfig.icon;
            const StatusIcon = status.icon;
            
            return (
              <Card key={claim.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${typeConfig.color}`}>
                      <TypeIcon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-semibold">{typeConfig.label}</p>
                          {claim.policy && (
                            <p className="text-sm text-muted-foreground">
                              {claim.policy.company_name} - {claim.policy.product_type}
                            </p>
                          )}
                        </div>
                        <Badge variant={status.variant} className="gap-1 flex-shrink-0">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {claim.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          Date du sinistre: {format(new Date(claim.incident_date), 'dd MMM yyyy', { locale: fr })}
                        </span>
                        <span>
                          Déclaré le: {format(new Date(claim.created_at), 'dd MMM yyyy', { locale: fr })}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}