// Crie um sistema simples de armazenamento offline

// Salvar dados para enviar quando online novamente
export const saveForLater = (operation: string, data: any) => {
  try {
    // Obter a fila existente ou criar uma nova
    const queueString = localStorage.getItem('offline_queue') || '[]';
    const queue = JSON.parse(queueString);
    
    // Adicionar a nova operação à fila
    queue.push({
      operation,
      data,
      timestamp: Date.now()
    });
    
    // Salvar a fila atualizada
    localStorage.setItem('offline_queue', JSON.stringify(queue));
    
    return true;
  } catch (error) {
    console.error('Erro ao salvar operação offline:', error);
    return false;
  }
};

// Processar operações pendentes
export const processPendingOperations = async (handlers: Record<string, (data: any) => Promise<any>>) => {
  try {
    const queueString = localStorage.getItem('offline_queue');
    if (!queueString) return { processed: 0, failed: 0 };
    
    const queue = JSON.parse(queueString);
    if (!queue.length) return { processed: 0, failed: 0 };
    
    let processed = 0;
    let failed = 0;
    const newQueue = [];
    
    for (const item of queue) {
      const handler = handlers[item.operation];
      
      if (!handler) {
        newQueue.push(item);
        failed++;
        continue;
      }
      
      try {
        await handler(item.data);
        processed++;
      } catch (error) {
        console.error(`Falha ao processar operação offline ${item.operation}:`, error);
        newQueue.push(item);
        failed++;
      }
    }
    
    localStorage.setItem('offline_queue', JSON.stringify(newQueue));
    return { processed, failed, pending: newQueue.length };
  } catch (error) {
    console.error('Erro ao processar operações offline:', error);
    return { processed: 0, failed: 0, error };
  }
};