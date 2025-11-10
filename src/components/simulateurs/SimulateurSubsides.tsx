import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { HeartHandshake, Check, X } from "lucide-react";

const cantons = [
  "Genève", "Vaud", "Valais", "Fribourg", "Neuchâtel", "Jura",
  "Berne", "Zurich", "Lucerne", "Bâle-Ville", "Bâle-Campagne",
  "Argovie", "Thurgovie", "Saint-Gall", "Grisons", "Tessin"
];

export const SimulateurSubsides = () => {
  const [canton, setCanton] = useState("");
  const [adultes, setAdultes] = useState("");
  const [enfants, setEnfants] = useState("");
  const [revenu, setRevenu] = useState("");
  const [prime, setPrime] = useState("");
  const [resultat, setResultat] = useState<any>(null);

  const calculer = () => {
    if (!canton || !adultes || !enfants || !revenu) return;

    const revenuTotal = Number(revenu);
    const nbAdultes = Number(adultes);
    const nbEnfants = Number(enfants);
    const taillefoyer = nbAdultes + nbEnfants;
    
    // Limite de revenu indicative (varie par canton)
    const limiteRevenu = 50000 + (taillefoyer * 10000);
    
    if (revenuTotal > limiteRevenu) {
      setResultat({
        eligible: false,
        message: "D'après vos données, vous ne semblez pas éligible à un subside. Cependant, nos conseillers peuvent vous aider à réduire vos primes via d'autres solutions."
      });
    } else {
      // Calcul estimatif du subside
      const tauxSubside = Math.max(0.1, Math.min(0.6, 1 - (revenuTotal / limiteRevenu)));
      const primeEstimee = Number(prime) || 400;
      const subsideMin = Math.round(primeEstimee * tauxSubside * 0.7);
      const subsideMax = Math.round(primeEstimee * tauxSubside);
      
      setResultat({
        eligible: true,
        subsideMin,
        subsideMax,
        message: `Selon vos informations, vous pourriez être éligible à un subside estimé entre CHF ${subsideMin} et CHF ${subsideMax} par mois.`
      });
    }
  };

  return (
    <Card className="p-8 shadow-glow border-primary/20">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <HeartHandshake className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">3️⃣ Simulateur de subsides</h2>
          <p className="text-sm text-muted-foreground">Vérifiez votre éligibilité aux aides pour vos primes santé</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="space-y-2">
          <Label htmlFor="canton-subsides">Canton de résidence</Label>
          <Select value={canton} onValueChange={setCanton}>
            <SelectTrigger id="canton-subsides">
              <SelectValue placeholder="Sélectionnez votre canton" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              {cantons.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="adultes-subsides">Nombre d'adultes dans le foyer</Label>
          <Input
            id="adultes-subsides"
            type="number"
            placeholder="Ex: 2"
            min="1"
            value={adultes}
            onChange={(e) => setAdultes(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="enfants-subsides">Nombre d'enfants à charge</Label>
          <Input
            id="enfants-subsides"
            type="number"
            placeholder="Ex: 0"
            min="0"
            value={enfants}
            onChange={(e) => setEnfants(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="revenu-subsides">Revenu annuel du ménage (CHF)</Label>
          <Input
            id="revenu-subsides"
            type="number"
            placeholder="Ex: 45000"
            value={revenu}
            onChange={(e) => setRevenu(e.target.value)}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="prime-subsides">Prime moyenne d'assurance (CHF/mois - optionnel)</Label>
          <Input
            id="prime-subsides"
            type="number"
            placeholder="Ex: 400"
            value={prime}
            onChange={(e) => setPrime(e.target.value)}
          />
        </div>
      </div>

      <Button onClick={calculer} className="w-full mb-6" size="lg">
        <HeartHandshake className="w-5 h-5 mr-2" />
        Vérifier mon éligibilité
      </Button>

      {resultat && (
        <div className={`border rounded-xl p-6 ${
          resultat.eligible 
            ? 'bg-primary/5 border-primary/20' 
            : 'bg-muted/50 border-border'
        }`}>
          <div className="flex items-start gap-4 mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
              resultat.eligible 
                ? 'bg-primary/10' 
                : 'bg-muted'
            }`}>
              {resultat.eligible ? (
                <Check className="w-6 h-6 text-primary" />
              ) : (
                <X className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <h3 className={`font-semibold mb-2 ${
                resultat.eligible ? 'text-primary' : 'text-foreground'
              }`}>
                {resultat.eligible ? 'Éligibilité probable' : 'Non éligible'}
              </h3>
              <p className="text-foreground">{resultat.message}</p>
            </div>
          </div>

          {resultat.eligible && resultat.subsideMin && resultat.subsideMax && (
            <div className="bg-background/50 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Subside estimé par mois</span>
                <span className="text-2xl font-bold text-primary">
                  CHF {resultat.subsideMin} - {resultat.subsideMax}
                </span>
              </div>
            </div>
          )}

          <Button variant="outline" className="w-full" asChild>
            <a href="#contact">🏥 Demander une analyse de primes gratuite</a>
          </Button>
        </div>
      )}
    </Card>
  );
};
