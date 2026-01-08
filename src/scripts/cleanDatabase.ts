import { supabase } from '@/lib/supabase';

async function cleanDatabase() {
  console.log('Iniciando limpeza do banco de dados...');
  
  try {
    // 1. Primeiro, excluir todas as mensagens (porque elas têm chave estrangeira para tickets)
    console.log('Excluindo mensagens...');
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .neq('id', '0'); // Isso exclui todas as mensagens
    
    if (messagesError) {
      throw messagesError;
    }
    console.log('✅ Mensagens excluídas com sucesso');
    
    // 2. Excluir todos os tickets
    console.log('Excluindo tickets...');
    const { error: ticketsError } = await supabase
      .from('tickets')
      .delete()
      .neq('id', '0'); // Isso exclui todos os tickets
    
    if (ticketsError) {
      throw ticketsError;
    }
    console.log('✅ Tickets excluídos com sucesso');
    
    // 3. Opcional: Limpar arquivos de anexos no storage
    console.log('Limpando arquivos de anexos...');
    const { data: folders, error: listError } = await supabase
      .storage
      .from('attachments')
      .list('tickets');
    
    if (listError) {
      console.warn('Aviso ao listar pastas de anexos:', listError.message);
    } else if (folders && folders.length > 0) {
      // Para cada pasta de ticket, excluir os arquivos
      for (const folder of folders) {
        const path = `tickets/${folder.name}`;
        const { error: deleteError } = await supabase
          .storage
          .from('attachments')
          .remove([path]);
        
        if (deleteError) {
          console.warn(`Aviso ao excluir pasta ${path}:`, deleteError.message);
        }
      }
      console.log('✅ Arquivos de anexos limpos com sucesso');
    } else {
      console.log('Nenhum arquivo de anexo encontrado para excluir');
    }
    
    console.log('🎉 Limpeza do banco de dados concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante a limpeza do banco de dados:', error);
  }
}

// Executar a função de limpeza
cleanDatabase();