import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PiggyBank, TrendingDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const cantons = [
  "Genève", "Vaud", "Valais", "Fribourg", "Neuchâtel", "Jura",
  "Berne", "Zurich", "Lucerne", "Bâle-Ville", "Bâle-Campagne",
  "Argovie", "Thurgovie", "Saint-Gall", "Grisons", "Tessin"
];

const tauxCantonaux = {
  "Genève": 0.30,
  "Vaud": 0.28,
  "Valais": 0.25,
  "Fribourg": 0.26,
  "Neuchâtel": 0.27,
  "Jura": 0.26,
  "Berne": 0.27,
  "Zurich": 0.24,
  "Lucerne": 0.23,
  "Bâle-Ville": 0.29,
  "Bâle-Campagne": 0.26,
  "Argovie": 0.24,
  "Thurgovie": 0.23,
  "Saint-Gall": 0.25,
  "Grisons": 0.22,
  "Tessin": 0.26
};

export const SimulateurImpot = () => {
  const [canton, setCanton] = useState("");
  const [situation, setSituation] = useState("");
  const [revenu, setRevenu] = useState("");
  const [cotisation, setCotisation] = useState("");
  const [resultat, setResultat] = useState<number | null>(null);

  const calculer = () => {
    if (!canton || !situation || !revenu || !cotisation) return;

    const taux = tauxCantonaux[canton as keyof typeof tauxCantonaux] || 0.25;
    const coefFamilial = situation === "marié" ? 0.85 : situation === "enfants" ? 0.80 : 1;
    const economie = Number(cotisation) * taux * coefFamilial;
    
    setResultat(Math.round(economie));
  };

  const pourcentageEconomie = resultat && cotisation ? (resultat / Number(cotisation)) * 100 : 0;

  return (
    <Card className="p-8 shadow-glow border-primary/20">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <PiggyBank className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">1️⃣ Simulateur d'impôt</h2>
          <p className="text-sm text-muted-foreground">Estimez votre économie fiscale avec le 3ᵉ pilier</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="space-y-2">
          <Label htmlFor="canton-impot">Canton de résidence</Label>
          <Select value={canton} onValueChange={setCanton}>
            <SelectTrigger id="canton-impot">
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
          <Label htmlFor="situation-impot">Situation familiale</Label>
          <Select value={situation} onValueChange={setSituation}>
            <SelectTrigger id="situation-impot">
              <SelectValue placeholder="Votre situation" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="célibataire">Célibataire</SelectItem>
              <SelectItem value="marié">Marié(e)</SelectItem>
              <SelectItem value="enfants">Avec enfants</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="revenu-impot">Revenu annuel brut (CHF)</Label>
          <Input
            id="revenu-impot"
            type="number"
            placeholder="Ex: 80000"
            value={revenu}
            onChange={(e) => setRevenu(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cotisation-impot">Cotisation annuelle 3ᵉ pilier (CHF)</Label>
          <Input
            id="cotisation-impot"
            type="number"
            placeholder="Ex: 7056"
            value={cotisation}
            onChange={(e) => setCotisation(e.target.value)}
          />
        </div>
      </div>

      <Button onClick={calculer} className="w-full mb-6" size="lg">
        <TrendingDown className="w-5 h-5 mr-2" />
        Calculer mon économie d'impôt
      </Button>

      {resultat !== null && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
          <p className="text-lg text-foreground mb-4">
            En cotisant <strong className="text-primary">CHF {Number(cotisation).toLocaleString()}</strong>, 
            vous pourriez économiser environ <strong className="text-primary">CHF {resultat.toLocaleString()}</strong> d'impôts par an.
          </p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Économie fiscale estimée</span>
              <span className="font-bold text-primary">{Math.round(pourcentageEconomie)}%</span>
            </div>
            <Progress value={pourcentageEconomie} className="h-3" />
          </div>
          <Button variant="outline" className="w-full mt-6" asChild>
            <a href="#contact">💡 Demander une étude 3ᵉ pilier personnalisée</a>
          </Button>
        </div>
      )}
    </Card>
  );
};
