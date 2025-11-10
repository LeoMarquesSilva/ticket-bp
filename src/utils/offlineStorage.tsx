// Tipos para as operações pendentes
type PendingOperation = {
  id: string;
  operation: string;
  data: any;
  timestamp: number;
  retries: number;
};

// Gerar um ID único
const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Chave para armazenar operações pendentes
const PENDING_OPS_KEY = 'pending_operations';

// Salvar uma operação para processamento posterior
export const saveForLater = (operation: string, data: any) => {
  try {
    // Criar uma nova operação pendente
    const pendingOp: PendingOperation = {
      id: generateId(),
      operation,
      data,
      timestamp: Date.now(),
      retries: 0
    };
    
    // Obter operações pendentes existentes
    const existingOps = getPendingOperations();
    
    // Adicionar a nova operação
    existingOps.push(pendingOp);
    
    // Salvar no localStorage
    localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(existingOps));
    
    console.log(`Operação "${operation}" salva para processamento posterior`, data);
    return pendingOp.id;
  } catch (error) {
    console.error('Erro ao salvar operação para processamento posterior:', error);
    return null;
  }
};

// Obter todas as operações pendentes
export const getPendingOperations = (): PendingOperation[] => {
  try {
    const opsString = localStorage.getItem(PENDING_OPS_KEY);
    if (!opsString) return [];
    
    return JSON.parse(opsString);
  } catch (error) {
    console.error('Erro ao obter operações pendentes:', error);
    return [];
  }
};

// Marcar uma operação como concluída
export const markOperationComplete = (operationId: string) => {
  try {
    const ops = getPendingOperations();
    const filteredOps = ops.filter(op => op.id !== operationId);
    
    localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(filteredOps));
    console.log(`Operação ${operationId} marcada como concluída`);
  } catch (error) {
    console.error('Erro ao marcar operação como concluída:', error);
  }
};

// Incrementar o contador de tentativas de uma operação
export const incrementOperationRetries = (operationId: string) => {
  try {
    const ops = getPendingOperations();
    const updatedOps = ops.map(op => {
      if (op.id === operationId) {
        return { ...op, retries: op.retries + 1 };
      }
      return op;
    });
    
    localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(updatedOps));
  } catch (error) {
    console.error('Erro ao incrementar tentativas de operação:', error);
  }
};

// Limpar todas as operações pendentes
export const clearAllPendingOperations = () => {
  try {
    localStorage.removeItem(PENDING_OPS_KEY);
    console.log('Todas as operações pendentes foram removidas');
  } catch (error) {
    console.error('Erro ao limpar operações pendentes:', error);
  }
};