import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Wallet, Calculator } from "lucide-react";

const cantons = [
  "Genève", "Vaud", "Valais", "Fribourg", "Neuchâtel", "Jura",
  "Berne", "Zurich", "Lucerne", "Bâle-Ville", "Bâle-Campagne",
  "Argovie", "Thurgovie", "Saint-Gall", "Grisons", "Tessin"
];

export const SimulateurSalaire = () => {
  const [canton, setCanton] = useState("");
  const [age, setAge] = useState("");
  const [situation, setSituation] = useState("");
  const [salaireBrut, setSalaireBrut] = useState("");
  const [statut, setStatut] = useState("");
  const [resultat, setResultat] = useState<any>(null);

  const calculer = () => {
    if (!canton || !age || !situation || !salaireBrut || !statut) return;

    const brut = Number(salaireBrut);
    
    // Cotisations sociales (approximatives)
    const avs = brut * 0.0525; // AVS/AI/APG 5.25%
    const ac = brut * 0.022; // Assurance chômage 2.2%
    const lpp = Number(age) >= 25 ? brut * 0.08 : 0; // LPP ~8% si > 25 ans
    
    // Impôts estimés (base simple)
    const tauxImpot = statut === "frontalier" ? 0.08 : 0.12;
    const impots = brut * tauxImpot;
    
    const totalDeductions = avs + ac + lpp + impots;
    const salaireNet = brut - totalDeductions;
    
    setResultat({
      net: Math.round(salaireNet),
      avs: Math.round(avs),
      ac: Math.round(ac),
      lpp: Math.round(lpp),
      impots: Math.round(impots),
      pourcentages: {
        avs: (avs / brut) * 100,
        ac: (ac / brut) * 100,
        lpp: (lpp / brut) * 100,
        impots: (impots / brut) * 100,
        net: (salaireNet / brut) * 100
      }
    });
  };

  return (
    <Card className="p-8 shadow-glow border-primary/20">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Wallet className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">2️⃣ Simulateur de salaire</h2>
          <p className="text-sm text-muted-foreground">Calculez votre salaire net à partir du brut</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="space-y-2">
          <Label htmlFor="canton-salaire">Canton de travail</Label>
          <Select value={canton} onValueChange={setCanton}>
            <SelectTrigger id="canton-salaire">
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
          <Label htmlFor="age-salaire">Âge</Label>
          <Input
            id="age-salaire"
            type="number"
            placeholder="Ex: 35"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="situation-salaire">Situation familiale</Label>
          <Select value={situation} onValueChange={setSituation}>
            <SelectTrigger id="situation-salaire">
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
          <Label htmlFor="statut-salaire">Statut</Label>
          <Select value={statut} onValueChange={setStatut}>
            <SelectTrigger id="statut-salaire">
              <SelectValue placeholder="Votre statut" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="résident">Résident suisse</SelectItem>
              <SelectItem value="frontalier">Frontalier</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="salaire-brut">Salaire brut mensuel (CHF)</Label>
          <Input
            id="salaire-brut"
            type="number"
            placeholder="Ex: 6000"
            value={salaireBrut}
            onChange={(e) => setSalaireBrut(e.target.value)}
          />
        </div>
      </div>

      <Button onClick={calculer} className="w-full mb-6" size="lg">
        <Calculator className="w-5 h-5 mr-2" />
        Calculer mon salaire net
      </Button>

      {resultat && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground mb-2">Salaire net estimé</p>
            <p className="text-4xl font-bold text-primary">CHF {resultat.net.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground mt-1">par mois</p>
          </div>

          <div className="space-y-4 mb-6">
            <h3 className="font-semibold text-foreground mb-3">Répartition des déductions</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">AVS / AI / APG</span>
                <div className="text-right">
                  <span className="font-semibold">CHF {resultat.avs.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground ml-2">({resultat.pourcentages.avs.toFixed(1)}%)</span>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${resultat.pourcentages.avs}%` }} />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm">Assurance chômage</span>
                <div className="text-right">
                  <span className="font-semibold">CHF {resultat.ac.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground ml-2">({resultat.pourcentages.ac.toFixed(1)}%)</span>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${resultat.pourcentages.ac}%` }} />
              </div>

              {resultat.lpp > 0 && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">LPP (2ᵉ pilier)</span>
                    <div className="text-right">
                      <span className="font-semibold">CHF {resultat.lpp.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground ml-2">({resultat.pourcentages.lpp.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${resultat.pourcentages.lpp}%` }} />
                  </div>
                </>
              )}

              <div className="flex justify-between items-center">
                <span className="text-sm">Impôts estimés</span>
                <div className="text-right">
                  <span className="font-semibold">CHF {resultat.impots.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground ml-2">({resultat.pourcentages.impots.toFixed(1)}%)</span>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${resultat.pourcentages.impots}%` }} />
              </div>
            </div>
          </div>

          <Button variant="outline" className="w-full" asChild>
            <a href="#contact">💼 Obtenir une optimisation fiscale et salariale gratuite</a>
          </Button>
        </div>
      )}
    </Card>
  );
};
