// Crie um componente de loading mais informativo
import React from 'react';
import { RefreshCw } from 'lucide-react';

interface LoadingProps {
  message?: string;
  timeout?: number; // em milissegundos
}

export const Loading: React.FC<LoadingProps> = ({ 
  message = 'Carregando...', 
  timeout = 30000 // 30 segundos
}) => {
  const [showTimeout, setShowTimeout] = React.useState(false);
  
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowTimeout(true);
    }, timeout);
    
    return () => clearTimeout(timer);
  }, [timeout]);
  
  return (
    <div className="flex flex-col items-center justify-center p-4">
      <RefreshCw className="h-8 w-8 animate-spin text-[#D5B170] mb-2" />
      <p className="text-slate-600">{message}</p>
      
      {showTimeout && (
        <div className="mt-4 text-sm text-amber-600">
          <p>Está demorando mais que o esperado.</p>
          <p>Isso pode ocorrer devido a:</p>
          <ul className="list-disc pl-5 mt-1">
            <li>Conexão lenta com a internet</li>
            <li>Servidor em processo de inicialização</li>
            <li>Alta demanda no momento</li>
          </ul>
          <p className="mt-2">Tente recarregar a página se o problema persistir.</p>
        </div>
      )}
    </div>
  );
};