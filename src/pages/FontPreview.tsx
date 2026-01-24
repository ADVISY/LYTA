import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const singleFonts = [
  {
    name: "Poppins",
    family: "'Poppins', sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap",
    description: "Moderne et géométrique"
  },
  {
    name: "Plus Jakarta Sans",
    family: "'Plus Jakarta Sans', sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap",
    description: "Élégante et professionnelle"
  },
  {
    name: "DM Sans",
    family: "'DM Sans', sans-serif",
    url: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap",
    description: "Clean et minimaliste"
  },
  {
    name: "Outfit",
    family: "'Outfit', sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap",
    description: "Contemporaine avec du caractère"
  },
  {
    name: "Inter (actuelle)",
    family: "'Inter', sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap",
    description: "Police actuelle du système"
  }
];

const fontPairings = [
  {
    name: "Outfit + Inter",
    display: { name: "Outfit", family: "'Outfit', sans-serif" },
    body: { name: "Inter", family: "'Inter', sans-serif" },
    description: "Titres modernes et impactants, texte ultra-lisible",
    recommended: true
  },
  {
    name: "Poppins + DM Sans",
    display: { name: "Poppins", family: "'Poppins', sans-serif" },
    body: { name: "DM Sans", family: "'DM Sans', sans-serif" },
    description: "Géométrique et harmonieux, très professionnel"
  },
  {
    name: "Plus Jakarta Sans + Inter",
    display: { name: "Plus Jakarta Sans", family: "'Plus Jakarta Sans', sans-serif" },
    body: { name: "Inter", family: "'Inter', sans-serif" },
    description: "Élégance premium avec lisibilité maximale"
  },
  {
    name: "Outfit + DM Sans",
    display: { name: "Outfit", family: "'Outfit', sans-serif" },
    body: { name: "DM Sans", family: "'DM Sans', sans-serif" },
    description: "Caractère fort avec corps minimaliste"
  },
  {
    name: "Poppins + Inter",
    display: { name: "Poppins", family: "'Poppins', sans-serif" },
    body: { name: "Inter", family: "'Inter', sans-serif" },
    description: "Classique SaaS, fiable et moderne"
  },
  {
    name: "Plus Jakarta Sans + DM Sans",
    display: { name: "Plus Jakarta Sans", family: "'Plus Jakarta Sans', sans-serif" },
    body: { name: "DM Sans", family: "'DM Sans', sans-serif" },
    description: "Duo élégant et épuré"
  }
];

const allFontUrls = [
  "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap",
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap",
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap",
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
];

export default function FontPreview() {
  const [selectedSingle, setSelectedSingle] = useState<string | null>(null);
  const [selectedPairing, setSelectedPairing] = useState<string | null>(null);

  const renderFontDemo = (displayFont: string, bodyFont: string, isPairing = false) => (
    <div className="space-y-4">
      {/* Logo & Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-border">
        <span 
          className="text-4xl font-bold" 
          style={{ fontFamily: displayFont, color: '#D4A418' }}
        >
          LYTA
        </span>
        <span 
          className="text-2xl font-semibold text-foreground"
          style={{ fontFamily: displayFont }}
        >
          Dashboard
        </span>
      </div>
      
      {/* Navigation */}
      <div 
        className="flex gap-6 text-sm font-medium text-muted-foreground"
        style={{ fontFamily: bodyFont }}
      >
        <span className="hover:text-foreground cursor-pointer">Clients</span>
        <span className="hover:text-foreground cursor-pointer">Contrats</span>
        <span className="hover:text-foreground cursor-pointer">Commissions</span>
        <span className="hover:text-foreground cursor-pointer">Rapports</span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 pt-4">
        <div className="p-4 bg-muted rounded-lg">
          <p 
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: displayFont }}
          >
            CHF 125'450
          </p>
          <p 
            className="text-sm text-muted-foreground"
            style={{ fontFamily: bodyFont }}
          >
            Commissions du mois
          </p>
        </div>
        <div className="p-4 bg-muted rounded-lg">
          <p 
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: displayFont }}
          >
            847
          </p>
          <p 
            className="text-sm text-muted-foreground"
            style={{ fontFamily: bodyFont }}
          >
            Clients actifs
          </p>
        </div>
        <div className="p-4 bg-muted rounded-lg">
          <p 
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: displayFont }}
          >
            98.5%
          </p>
          <p 
            className="text-sm text-muted-foreground"
            style={{ fontFamily: bodyFont }}
          >
            Taux de rétention
          </p>
        </div>
      </div>

      {/* Body Text */}
      <p 
        className="text-sm text-muted-foreground pt-2"
        style={{ fontFamily: bodyFont }}
      >
        Gérez efficacement vos clients, contrats et commissions avec LYTA. 
        Une plateforme complète pour les courtiers en assurances.
      </p>

      {/* Button Example */}
      <div className="flex gap-3 pt-2">
        <button 
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
          style={{ fontFamily: bodyFont }}
        >
          Nouveau client
        </button>
        <button 
          className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground"
          style={{ fontFamily: bodyFont }}
        >
          Exporter
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-8">
      {/* Load all fonts */}
      {allFontUrls.map((url, i) => (
        <link key={i} rel="stylesheet" href={url} />
      ))}

      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Prévisualisation des Polices</h1>
          <p className="text-muted-foreground">Choisissez la typographie pour LYTA</p>
        </div>

        <Tabs defaultValue="pairings" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="pairings" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Combinaisons
            </TabsTrigger>
            <TabsTrigger value="single">Police unique</TabsTrigger>
          </TabsList>

          {/* Font Pairings Tab */}
          <TabsContent value="pairings" className="mt-6">
            <div className="grid gap-6">
              {fontPairings.map((pairing) => (
                <Card 
                  key={pairing.name}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedPairing === pairing.name ? 'ring-2 ring-primary border-primary' : ''
                  }`}
                  onClick={() => setSelectedPairing(pairing.name)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {pairing.name}
                        {pairing.recommended && (
                          <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">
                            Recommandé
                          </span>
                        )}
                        {selectedPairing === pairing.name && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </CardTitle>
                      <span className="text-sm text-muted-foreground">{pairing.description}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                      <span>Titres: <strong>{pairing.display.name}</strong></span>
                      <span>Texte: <strong>{pairing.body.name}</strong></span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {renderFontDemo(pairing.display.family, pairing.body.family, true)}
                  </CardContent>
                </Card>
              ))}
            </div>

            {selectedPairing && (
              <div className="text-center pt-6">
                <p className="text-lg font-medium text-foreground mb-4">
                  Vous avez sélectionné : <strong>{selectedPairing}</strong>
                </p>
                <Button size="lg" className="bg-primary hover:bg-primary/90">
                  Appliquer cette combinaison
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Single Font Tab */}
          <TabsContent value="single" className="mt-6">
            <div className="grid gap-6">
              {singleFonts.map((font) => (
                <Card 
                  key={font.name}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedSingle === font.name ? 'ring-2 ring-primary border-primary' : ''
                  }`}
                  onClick={() => setSelectedSingle(font.name)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {font.name}
                        {selectedSingle === font.name && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </CardTitle>
                      <span className="text-sm text-muted-foreground">{font.description}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {renderFontDemo(font.family, font.family)}
                  </CardContent>
                </Card>
              ))}
            </div>

            {selectedSingle && (
              <div className="text-center pt-6">
                <p className="text-lg font-medium text-foreground mb-4">
                  Vous avez sélectionné : <strong>{selectedSingle}</strong>
                </p>
                <Button size="lg" className="bg-primary hover:bg-primary/90">
                  Appliquer cette police
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
