import { useState } from "react";
import { motion } from "framer-motion";
import { 
  FileText, Search, Upload, FolderPlus, 
  Download, Eye, Trash2
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
import { useDocuments } from "@/hooks/useDocuments";

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function AllDocuments() {
  const { documents, loading, deleteDocument } = useDocuments();
  const [searchTerm, setSearchTerm] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [ownerTypeFilter, setOwnerTypeFilter] = useState<string>("all");
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const { toast } = useToast();

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.file_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesKind = kindFilter === "all" || doc.doc_kind === kindFilter;
    const matchesOwnerType = ownerTypeFilter === "all" || doc.owner_type === ownerTypeFilter;
    return matchesSearch && matchesKind && matchesOwnerType;
  });

  const uniqueKinds = Array.from(new Set(documents.map(d => d.doc_kind).filter(Boolean)));
  const uniqueOwnerTypes = Array.from(new Set(documents.map(d => d.owner_type).filter(Boolean)));

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

  const getOwnerTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      'client': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'policy': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'partner': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    };
    return colors[type] || 'bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-400';
  };

  const getOwnerTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      'client': 'Client',
      'policy': 'Police',
      'partner': 'Partenaire'
    };
    return labels[type] || type;
  };

  const handleViewDocument = (doc: any) => {
    setSelectedDoc(doc);
    setIsViewerOpen(true);
  };

  const handleDownload = (doc: any) => {
    toast({ 
      title: "Téléchargement lancé", 
      description: `${doc.file_name} est en cours de téléchargement` 
    });
  };

  const handleDelete = async (doc: any) => {
    if (confirm('Supprimer ce document ?')) {
      await deleteDocument(doc.id);
    }
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const k = 1024;
    if (bytes < k) return bytes + ' B';
    if (bytes < k * k) return (bytes / k).toFixed(1) + ' KB';
    return (bytes / (k * k)).toFixed(1) + ' MB';
  };

  const handleUpload = () => {
    toast({ 
      title: "Upload", 
      description: "Fonctionnalité d'upload en développement" 
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <motion.div variants={fadeIn} initial="hidden" animate="show">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Tous les Documents</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gestion globale de tous les documents du système
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleUpload}>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
            <Button onClick={() => toast({ title: "Nouveau dossier" })}>
              <FolderPlus className="mr-2 h-4 w-4" />
              Nouveau dossier
            </Button>
          </div>
        </div>

        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un document..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={ownerTypeFilter} onValueChange={setOwnerTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Type propriétaire" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {uniqueOwnerTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {getOwnerTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={kindFilter} onValueChange={setKindFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Type de document" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les documents</SelectItem>
                  {uniqueKinds.map(kind => (
                    <SelectItem key={kind} value={kind}>{kind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                {filteredDocuments.length} document{filteredDocuments.length > 1 ? 's' : ''}
              </p>
            </div>
          </CardContent>
        </Card>

        {filteredDocuments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucun document trouvé</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((doc) => (
              <Card key={doc.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-sm mb-2 line-clamp-1">
                        {doc.file_name}
                      </h3>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {doc.doc_kind && (
                          <Badge className={getKindColor(doc.doc_kind)} variant="secondary">
                            {doc.doc_kind}
                          </Badge>
                        )}
                        <Badge className={getOwnerTypeColor(doc.owner_type)} variant="secondary">
                          {getOwnerTypeLabel(doc.owner_type)}
                        </Badge>
                      </div>
                    </div>
                    <FileText className="h-8 w-8 text-primary ml-2" />
                  </div>
                  
                  <div className="text-xs text-muted-foreground mb-3 space-y-1">
                    <p>Taille: {formatBytes(doc.size_bytes)}</p>
                    <p>Ajouté: {new Date(doc.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewDocument(doc)}
                      className="flex-1"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Voir
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(doc)}
                      className="flex-1"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Télécharger
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(doc)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
          <DialogContent className="max-w-4xl h-[80vh]">
            <DialogHeader>
              <DialogTitle>{selectedDoc?.file_name}</DialogTitle>
              <DialogDescription>
                Aperçu du document
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg">
              <div className="text-center p-8">
                <FileText className="h-24 w-24 mx-auto text-slate-400 mb-4" />
                <p className="text-slate-600 dark:text-slate-400">
                  Aperçu non disponible
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => selectedDoc && handleDownload(selectedDoc)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger le document
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
}
