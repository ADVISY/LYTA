import { useState } from "react";
import { motion } from "framer-motion";
import { 
  FileText, Search, Upload, FolderPlus, 
  Download, Share2, Edit, Eye, File
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mockDocuments, MockDocument } from "@/lib/mockData";

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function PartnerDocuments() {
  const [documents] = useState<MockDocument[]>(mockDocuments);
  const [searchTerm, setSearchTerm] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [selectedDoc, setSelectedDoc] = useState<MockDocument | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const { toast } = useToast();

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesKind = kindFilter === "all" || doc.kind === kindFilter;
    return matchesSearch && matchesKind;
  });

  const uniqueKinds = Array.from(new Set(mockDocuments.map(d => d.kind)));

  const getKindColor = (kind: string) => {
    const colors: { [key: string]: string } = {
      'Contrat signé': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'Attestation': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'CGV': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      'Proposition': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      'Résiliation': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      'Guide': 'bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-400'
    };
    return colors[kind] || 'bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-400';
  };

  const handleViewDocument = (doc: MockDocument) => {
    setSelectedDoc(doc);
    setIsViewerOpen(true);
  };

  const handleDownload = (doc: MockDocument) => {
    toast({ 
      title: "Téléchargement lancé", 
      description: `${doc.name} est en cours de téléchargement (mock)` 
    });
  };

  const handleUpload = () => {
    toast({ 
      title: "Upload", 
      description: "Fonctionnalité d'upload en développement" 
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 dark:from-slate-950 dark:to-slate-900 p-6">
      <motion.div 
        variants={fadeIn} 
        initial="hidden" 
        animate="show"
        className="max-w-7xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <FileText className="h-7 w-7" />
              Centre de Documents
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              {filteredDocuments.length} document{filteredDocuments.length > 1 ? 's' : ''} disponible{filteredDocuments.length > 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => toast({ title: "Créer dossier", description: "Fonctionnalité en développement" })}
              className="rounded-xl"
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              Nouveau dossier
            </Button>
            <Button 
              onClick={handleUpload}
              className="rounded-xl"
            >
              <Upload className="h-4 w-4 mr-2" />
              Uploader
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Rechercher un document..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 rounded-xl"
                />
              </div>
              <Select value={kindFilter} onValueChange={setKindFilter}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Tous les types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {uniqueKinds.map(kind => (
                    <SelectItem key={kind} value={kind}>
                      {kind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Documents Grid */}
        {filteredDocuments.length === 0 ? (
          <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur">
            <CardContent className="p-12">
              <div className="text-center">
                <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-2">Aucun document trouvé</p>
                <p className="text-sm text-slate-400">
                  Uploadez votre premier document ou modifiez vos filtres
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDocuments.map((doc) => (
              <motion.div
                key={doc.id}
                variants={fadeIn}
                whileHover={{ y: -4, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                  <CardContent className="p-0">
                    {/* Document Icon/Preview */}
                    <div 
                      className="h-40 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center"
                      onClick={() => handleViewDocument(doc)}
                    >
                      <File className="h-16 w-16 text-slate-400" />
                    </div>
                    
                    {/* Document Info */}
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 
                          className="font-semibold text-sm text-slate-900 dark:text-slate-50 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                          onClick={() => handleViewDocument(doc)}
                          title={doc.name}
                        >
                          {doc.name}
                        </h3>
                        <div className="flex items-center justify-between mt-2">
                          <Badge className={`text-xs ${getKindColor(doc.kind)}`}>
                            {doc.kind}
                          </Badge>
                          <span className="text-xs text-slate-500">{doc.size}</span>
                        </div>
                      </div>
                      
                      <div className="text-xs text-slate-500">
                        {new Date(doc.date).toLocaleDateString('fr-CH')}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="flex-1 rounded-xl text-xs"
                          onClick={() => handleViewDocument(doc)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Voir
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="flex-1 rounded-xl text-xs"
                          onClick={() => handleDownload(doc)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          DL
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="rounded-xl p-2"
                          onClick={() => toast({ title: "Partager", description: "Fonctionnalité en développement" })}
                        >
                          <Share2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* PDF Viewer Modal */}
        <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
          <DialogContent className="max-w-4xl h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {selectedDoc?.name}
              </DialogTitle>
              <DialogDescription>
                {selectedDoc?.kind} - {selectedDoc?.size}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto">
              {/* Mock PDF Viewer */}
              <div className="h-full bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center p-12">
                <div className="text-center space-y-4">
                  <File className="h-24 w-24 text-slate-300 mx-auto" />
                  <div>
                    <p className="text-slate-600 dark:text-slate-400 font-medium">
                      Aperçu du document
                    </p>
                    <p className="text-sm text-slate-500 mt-2">
                      Visualisation PDF (mock) - Intégration future avec viewer PDF
                    </p>
                  </div>
                  <div className="flex gap-2 justify-center pt-4">
                    <Button 
                      variant="outline"
                      onClick={() => selectedDoc && handleDownload(selectedDoc)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Télécharger
                    </Button>
                    <Button
                      onClick={() => toast({ title: "Partager", description: "Fonctionnalité en développement" })}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Partager
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
}
