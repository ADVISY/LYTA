import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin,
  Plus,
  Search,
  Edit2,
  Trash2,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface SwissPostalCode {
  id: string;
  npa: string;
  city: string;
  canton: string | null;
  language: string;
  is_primary: boolean;
}

// Major Swiss NPA data (partial - expandable)
const SWISS_NPA_SAMPLE = [
  { npa: '1000', city: 'Lausanne', canton: 'VD' },
  { npa: '1003', city: 'Lausanne', canton: 'VD' },
  { npa: '1006', city: 'Lausanne', canton: 'VD' },
  { npa: '1007', city: 'Lausanne', canton: 'VD' },
  { npa: '1010', city: 'Lausanne', canton: 'VD' },
  { npa: '1020', city: 'Renens VD', canton: 'VD' },
  { npa: '1030', city: 'Bussigny', canton: 'VD' },
  { npa: '1110', city: 'Morges', canton: 'VD' },
  { npa: '1200', city: 'Genève', canton: 'GE' },
  { npa: '1201', city: 'Genève', canton: 'GE' },
  { npa: '1202', city: 'Genève', canton: 'GE' },
  { npa: '1203', city: 'Genève', canton: 'GE' },
  { npa: '1204', city: 'Genève', canton: 'GE' },
  { npa: '1205', city: 'Genève', canton: 'GE' },
  { npa: '1206', city: 'Genève', canton: 'GE' },
  { npa: '1700', city: 'Fribourg', canton: 'FR' },
  { npa: '1800', city: 'Vevey', canton: 'VD' },
  { npa: '1950', city: 'Sion', canton: 'VS' },
  { npa: '2000', city: 'Neuchâtel', canton: 'NE' },
  { npa: '2300', city: 'La Chaux-de-Fonds', canton: 'NE' },
  { npa: '2500', city: 'Biel/Bienne', canton: 'BE' },
  { npa: '2501', city: 'Biel/Bienne', canton: 'BE' },
  { npa: '3000', city: 'Bern', canton: 'BE' },
  { npa: '3001', city: 'Bern', canton: 'BE' },
  { npa: '3004', city: 'Bern', canton: 'BE' },
  { npa: '3006', city: 'Bern', canton: 'BE' },
  { npa: '3008', city: 'Bern', canton: 'BE' },
  { npa: '3012', city: 'Bern', canton: 'BE' },
  { npa: '3400', city: 'Burgdorf', canton: 'BE' },
  { npa: '3600', city: 'Thun', canton: 'BE' },
  { npa: '4000', city: 'Basel', canton: 'BS' },
  { npa: '4001', city: 'Basel', canton: 'BS' },
  { npa: '4051', city: 'Basel', canton: 'BS' },
  { npa: '4052', city: 'Basel', canton: 'BS' },
  { npa: '4053', city: 'Basel', canton: 'BS' },
  { npa: '4500', city: 'Solothurn', canton: 'SO' },
  { npa: '4600', city: 'Olten', canton: 'SO' },
  { npa: '5000', city: 'Aarau', canton: 'AG' },
  { npa: '5400', city: 'Baden', canton: 'AG' },
  { npa: '6000', city: 'Luzern', canton: 'LU' },
  { npa: '6003', city: 'Luzern', canton: 'LU' },
  { npa: '6004', city: 'Luzern', canton: 'LU' },
  { npa: '6300', city: 'Zug', canton: 'ZG' },
  { npa: '6500', city: 'Bellinzona', canton: 'TI' },
  { npa: '6600', city: 'Locarno', canton: 'TI' },
  { npa: '6900', city: 'Lugano', canton: 'TI' },
  { npa: '6901', city: 'Lugano', canton: 'TI' },
  { npa: '7000', city: 'Chur', canton: 'GR' },
  { npa: '7500', city: 'St. Moritz', canton: 'GR' },
  { npa: '8000', city: 'Zürich', canton: 'ZH' },
  { npa: '8001', city: 'Zürich', canton: 'ZH' },
  { npa: '8002', city: 'Zürich', canton: 'ZH' },
  { npa: '8003', city: 'Zürich', canton: 'ZH' },
  { npa: '8004', city: 'Zürich', canton: 'ZH' },
  { npa: '8005', city: 'Zürich', canton: 'ZH' },
  { npa: '8006', city: 'Zürich', canton: 'ZH' },
  { npa: '8008', city: 'Zürich', canton: 'ZH' },
  { npa: '8032', city: 'Zürich', canton: 'ZH' },
  { npa: '8037', city: 'Zürich', canton: 'ZH' },
  { npa: '8038', city: 'Zürich', canton: 'ZH' },
  { npa: '8044', city: 'Zürich', canton: 'ZH' },
  { npa: '8045', city: 'Zürich', canton: 'ZH' },
  { npa: '8046', city: 'Zürich', canton: 'ZH' },
  { npa: '8047', city: 'Zürich', canton: 'ZH' },
  { npa: '8048', city: 'Zürich', canton: 'ZH' },
  { npa: '8049', city: 'Zürich', canton: 'ZH' },
  { npa: '8050', city: 'Zürich', canton: 'ZH' },
  { npa: '8051', city: 'Zürich', canton: 'ZH' },
  { npa: '8052', city: 'Zürich', canton: 'ZH' },
  { npa: '8053', city: 'Zürich', canton: 'ZH' },
  { npa: '8055', city: 'Zürich', canton: 'ZH' },
  { npa: '8057', city: 'Zürich', canton: 'ZH' },
  { npa: '8400', city: 'Winterthur', canton: 'ZH' },
  { npa: '8401', city: 'Winterthur', canton: 'ZH' },
  { npa: '8500', city: 'Frauenfeld', canton: 'TG' },
  { npa: '8600', city: 'Dübendorf', canton: 'ZH' },
  { npa: '8700', city: 'Küsnacht ZH', canton: 'ZH' },
  { npa: '8800', city: 'Thalwil', canton: 'ZH' },
  { npa: '8820', city: 'Wädenswil', canton: 'ZH' },
  { npa: '9000', city: 'St. Gallen', canton: 'SG' },
  { npa: '9001', city: 'St. Gallen', canton: 'SG' },
  { npa: '9200', city: 'Gossau SG', canton: 'SG' },
  { npa: '9400', city: 'Rorschach', canton: 'SG' },
  { npa: '9500', city: 'Wil SG', canton: 'SG' },
];

export default function SwissPostalCodesManager() {
  const { toast } = useToast();
  const [postalCodes, setPostalCodes] = useState<SwissPostalCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const fetchPostalCodes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('swiss_postal_codes' as any)
        .select('*')
        .order('npa', { ascending: true })
        .limit(500);

      if (error) throw error;
      setPostalCodes((data as any) || []);
    } catch (err: any) {
      console.error('Error fetching postal codes:', err);
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPostalCodes();
  }, []);

  const filteredCodes = postalCodes.filter(pc =>
    pc.npa.includes(search) || pc.city.toLowerCase().includes(search.toLowerCase())
  );

  const importSampleData = async () => {
    setImporting(true);
    setImportProgress(0);

    try {
      const chunkSize = 20;
      const total = SWISS_NPA_SAMPLE.length;
      
      for (let i = 0; i < total; i += chunkSize) {
        const chunk = SWISS_NPA_SAMPLE.slice(i, i + chunkSize);
        const records = chunk.map(item => ({
          npa: item.npa,
          city: item.city,
          canton: item.canton,
          language: 'fr',
          is_primary: true,
        }));

        const { error } = await supabase
          .from('swiss_postal_codes' as any)
          .upsert(records, { onConflict: 'npa,city' });

        if (error) {
          console.error('Import chunk error:', error);
        }

        setImportProgress(Math.round(((i + chunk.length) / total) * 100));
      }

      toast({
        title: "Import terminé",
        description: `${SWISS_NPA_SAMPLE.length} NPA importés`,
      });

      await fetchPostalCodes();
    } catch (err: any) {
      toast({
        title: "Erreur d'import",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce code postal ?')) return;

    try {
      const { error } = await supabase
        .from('swiss_postal_codes' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchPostalCodes();
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg">
            <MapPin className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Codes postaux suisses</h2>
            <p className="text-muted-foreground">{postalCodes.length} NPA en base</p>
          </div>
        </div>
        <Button onClick={importSampleData} disabled={importing} className="gap-2">
          {importing ? (
            <>
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Import en cours...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Importer données de base
            </>
          )}
        </Button>
      </div>

      {/* Import progress */}
      {importing && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Import en cours...</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info card */}
      {postalCodes.length === 0 && !loading && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">Aucun code postal configuré</p>
            <p className="text-muted-foreground mb-4">
              Cliquez sur "Importer données de base" pour charger les principaux NPA suisses.
              Cela permettra l'autocomplétion des adresses dans les formulaires.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      {postalCodes.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par NPA ou ville..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {postalCodes.length > 0 && (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NPA</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Canton</TableHead>
                    <TableHead>Langue</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCodes.slice(0, 100).map(pc => (
                    <TableRow key={pc.id}>
                      <TableCell>
                        <Badge variant="outline">{pc.npa}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{pc.city}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">{pc.canton || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs uppercase">{pc.language}</span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(pc.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredCodes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Aucun résultat
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredCodes.length > 100 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        ... et {filteredCodes.length - 100} autres résultats
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
