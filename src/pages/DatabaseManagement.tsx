import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, Database, Loader2, Trash2, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

// Interface para a tabela retornada pela função RPC
interface TableInfo {
  table_name: string;
}

export default function DatabaseManagement() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);

  // Função para carregar os nomes das tabelas disponíveis
  useEffect(() => {
    const fetchTables = async () => {
      setIsLoadingTables(true);
      try {
        // Consulta SQL para listar todas as tabelas no esquema public
        const { data, error } = await supabase.rpc('get_tables');
        
        if (error) {
          console.error("Erro ao buscar tabelas:", error);
          setError(`Erro ao buscar tabelas: ${error.message}`);
        } else if (data) {
          setTables(data);
          console.log("Tabelas disponíveis:", data);
        }
      } catch (err) {
        console.error("Erro ao buscar tabelas:", err);
        setError(err instanceof Error ? err.message : "Erro desconhecido ao buscar tabelas");
      } finally {
        setIsLoadingTables(false);
      }
    };

    fetchTables();
  }, []);

  const handleClearDatabase = async () => {
    setIsDeleting(true);
    setError(null);
    setDeleteSuccess(false);
    
    try {
      // Agora que sabemos os nomes exatos das tabelas, vamos usá-los diretamente
      const ticketsTable = 'app_c009c0e4f1_tickets';
      const messagesTable = 'app_c009c0e4f1_chat_messages';
      
      console.log("Limpando tabela de tickets:", ticketsTable);
      console.log("Limpando tabela de mensagens:", messagesTable);

      // 1. Excluir mensagens usando SQL direto
      const { error: messagesError } = await supabase.rpc('truncate_table', {
        table_name: messagesTable
      });
      
      if (messagesError) throw new Error(`Erro ao excluir mensagens: ${messagesError.message}`);
      
      // 2. Excluir tickets usando SQL direto
      const { error: ticketsError } = await supabase.rpc('truncate_table', {
        table_name: ticketsTable
      });
      
      if (ticketsError) throw new Error(`Erro ao excluir tickets: ${ticketsError.message}`);
      
      // 3. Excluir arquivos anexados do storage
      try {
        // Primeiro, obtemos a lista de todos os arquivos no bucket de anexos
        const { data: storageFiles, error: storageListError } = await supabase
          .storage
          .from('attachments')
          .list('tickets', {
            limit: 1000,
            offset: 0,
          });
        
        if (storageListError) {
          console.warn(`Erro ao listar arquivos: ${storageListError.message}`);
        } else if (storageFiles && storageFiles.length > 0) {
          const filePaths = storageFiles.map(file => `tickets/${file.name}`);
          const { error: deleteFilesError } = await supabase
            .storage
            .from('attachments')
            .remove(filePaths);
          
          if (deleteFilesError) {
            console.warn(`Erro ao excluir arquivos: ${deleteFilesError.message}`);
          }
        }
      } catch (storageErr) {
        console.warn("Erro ao processar arquivos de storage:", storageErr);
        // Não interrompe o fluxo principal se houver erro no storage
      }
      
      setDeleteSuccess(true);
      toast.success("Banco de dados limpo com sucesso!");
    } catch (err) {
      console.error("Erro ao limpar banco de dados:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido ao limpar banco de dados");
      toast.error("Erro ao limpar banco de dados");
    } finally {
      setIsDeleting(false);
      setConfirmDialogOpen(false);
      setConfirmText('');
    }
  };

  const openConfirmDialog = () => {
    setConfirmDialogOpen(true);
    setConfirmText('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gerenciamento de Banco de Dados</h1>
          <p className="text-muted-foreground">
            Gerencie os dados do sistema de tickets
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <span>Limpeza de Dados</span>
          </CardTitle>
          <CardDescription>
            Esta operação irá excluir todos os tickets, mensagens e arquivos anexados do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTables ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Carregando estrutura do banco de dados...</span>
            </div>
          ) : tables.length > 0 ? (
            <Alert variant="default" className="mb-4 bg-blue-50 text-blue-800 border border-blue-200">
              <Info className="h-4 w-4" />
              <AlertTitle>Tabelas Encontradas</AlertTitle>
              <AlertDescription>
                <p>Foram encontradas {tables.length} tabelas no banco de dados.</p>
                <p className="text-xs mt-1">Tabelas disponíveis: {tables.map(t => t.table_name).join(', ')}</p>
              </AlertDescription>
            </Alert>
          ) : null}

          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Atenção!</AlertTitle>
            <AlertDescription>
              Esta é uma operação irreversível. Todos os dados serão permanentemente excluídos.
              Recomendamos fazer um backup antes de prosseguir.
            </AlertDescription>
          </Alert>

          {deleteSuccess && (
            <Alert variant="default" className="mb-4 bg-green-50 text-green-800 border border-green-200">
              <Check className="h-4 w-4" />
              <AlertTitle>Sucesso!</AlertTitle>
              <AlertDescription>
                O banco de dados foi limpo com sucesso. Todos os tickets, mensagens e arquivos foram removidos.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <Button 
            variant="destructive" 
            onClick={openConfirmDialog}
            disabled={isDeleting || isLoadingTables}
            className="gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Limpando...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>Limpar Banco de Dados</span>
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmação de Limpeza</DialogTitle>
            <DialogDescription>
              Esta ação irá excluir permanentemente todos os tickets, mensagens e arquivos do sistema.
              Digite "CONFIRMAR" para prosseguir.
            </DialogDescription>
          </DialogHeader>
          
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Digite CONFIRMAR"
            className="mt-2"
          />
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleClearDatabase}
              disabled={confirmText !== "CONFIRMAR" || isDeleting}
              className="gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Limpando...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  <span>Confirmar Limpeza</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}