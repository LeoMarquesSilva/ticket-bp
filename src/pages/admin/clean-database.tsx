import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const CleanDatabase = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{success: boolean, message: string} | null>(null);
  const [confirmText, setConfirmText] = useState('');
  
  // Mostrar estado de carregamento da autenticação
  if (authLoading) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card className="p-6 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#101F2E] mb-4" />
          <h2 className="text-lg font-medium">Verificando autenticação...</h2>
          <p className="text-sm text-slate-500 mt-2">Aguarde enquanto verificamos suas credenciais.</p>
        </Card>
      </div>
    );
  }
  
  // Verificar se o usuário é administrador
  if (!user) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card className="p-6 bg-amber-50 border-amber-200">
          <div className="flex items-center gap-3 text-amber-700">
            <AlertCircle className="h-6 w-6" />
            <h1 className="text-xl font-semibold">Não autenticado</h1>
          </div>
          <p className="mt-2 text-amber-600">
            Você precisa estar logado para acessar esta página. Por favor, faça login e tente novamente.
          </p>
          <Button 
            className="mt-4 bg-amber-600 hover:bg-amber-700"
            onClick={() => window.location.href = '/login'}
          >
            Ir para o Login
          </Button>
        </Card>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card className="p-6 bg-red-50 border-red-200">
          <div className="flex items-center gap-3 text-red-700">
            <AlertCircle className="h-6 w-6" />
            <h1 className="text-xl font-semibold">Acesso Negado</h1>
          </div>
          <p className="mt-2 text-red-600">
            Você não tem permissão para acessar esta página. Esta página é restrita a administradores.
            <br />
            <span className="font-medium">Seu papel atual: {user.role}</span>
          </p>
          <Button 
            className="mt-4 bg-red-600 hover:bg-red-700"
            onClick={() => window.location.href = '/'}
          >
            Voltar para a Página Inicial
          </Button>
        </Card>
      </div>
    );
  }
  
  const handleCleanDatabase = async () => {
    if (confirmText !== 'LIMPAR TUDO') {
      toast.error('Por favor, digite o texto de confirmação corretamente');
      return;
    }
    
    setLoading(true);
    setResult(null);
    
    try {
      // 1. Primeiro, excluir todas as mensagens (porque elas têm chave estrangeira para tickets)
      console.log('Excluindo mensagens...');
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .neq('id', '0');
      
      if (messagesError) {
        console.error('Erro ao excluir mensagens:', messagesError);
        throw messagesError;
      }
      
      console.log('Mensagens excluídas com sucesso');
      
      // 2. Excluir todos os tickets
      console.log('Excluindo tickets...');
      const { error: ticketsError } = await supabase
        .from('tickets')
        .delete()
        .neq('id', '0');
      
      if (ticketsError) {
        console.error('Erro ao excluir tickets:', ticketsError);
        throw ticketsError;
      }
      
      console.log('Tickets excluídos com sucesso');
      
      // 3. Limpar arquivos de anexos no storage
      console.log('Limpando arquivos de anexos...');
      try {
        const { data: folders, error: foldersError } = await supabase
          .storage
          .from('attachments')
          .list('tickets');
        
        if (foldersError) {
          console.warn('Aviso ao listar pastas:', foldersError);
        } else if (folders && folders.length > 0) {
          console.log(`Encontradas ${folders.length} pastas de tickets para limpar`);
          
          for (const folder of folders) {
            if (folder.name) {
              // Listar arquivos na pasta
              const { data: files, error: filesError } = await supabase
                .storage
                .from('attachments')
                .list(`tickets/${folder.name}`);
              
              if (filesError) {
                console.warn(`Aviso ao listar arquivos da pasta ${folder.name}:`, filesError);
                continue;
              }
              
              if (files && files.length > 0) {
                console.log(`Excluindo ${files.length} arquivos da pasta ${folder.name}`);
                const filePaths = files.map(file => `tickets/${folder.name}/${file.name}`);
                
                // Excluir arquivos
                const { error: deleteError } = await supabase
                  .storage
                  .from('attachments')
                  .remove(filePaths);
                
                if (deleteError) {
                  console.warn(`Aviso ao excluir arquivos da pasta ${folder.name}:`, deleteError);
                }
              }
            }
          }
        } else {
          console.log('Nenhuma pasta de ticket encontrada no storage');
        }
      } catch (storageError) {
        console.error('Erro ao limpar arquivos:', storageError);
        // Não interromper o processo se houver erro no storage
      }
      
      setResult({
        success: true,
        message: 'Banco de dados limpo com sucesso! Todos os tickets e mensagens foram excluídos.'
      });
      
      toast.success('Banco de dados limpo com sucesso!');
      
    } catch (error: any) {
      console.error('Erro ao limpar banco de dados:', error);
      
      setResult({
        success: false,
        message: `Erro ao limpar banco de dados: ${error.message || 'Erro desconhecido'}`
      });
      
      toast.error('Erro ao limpar banco de dados');
    } finally {
      setLoading(false);
      setConfirmText('');
    }
  };
  
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Card className="p-6 border-red-200">
        <h1 className="text-2xl font-bold text-red-700 mb-4">Limpar Banco de Dados</h1>
        
        <div className="bg-red-50 p-4 rounded-md mb-6">
          <div className="flex items-center gap-2 text-red-700 mb-2">
            <AlertCircle className="h-5 w-5" />
            <h2 className="font-semibold">ATENÇÃO: Ação Irreversível</h2>
          </div>
          <p className="text-red-600 text-sm">
            Esta ação irá excluir <strong>permanentemente</strong> todos os tickets e mensagens do sistema.
            Esta operação não pode ser desfeita. Todos os dados serão perdidos.
          </p>
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">
            Para confirmar, digite "LIMPAR TUDO" no campo abaixo:
          </label>
          <input 
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder="Digite LIMPAR TUDO para confirmar"
          />
        </div>
        
        <Button
          variant="destructive"
          size="lg"
          disabled={loading || confirmText !== 'LIMPAR TUDO'}
          onClick={handleCleanDatabase}
          className="w-full"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Limpando...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar Todo o Banco de Dados
            </>
          )}
        </Button>
        
        {result && (
          <div className={`mt-6 p-4 rounded-md ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <p className="font-medium">{result.message}</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default CleanDatabase;