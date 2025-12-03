import { useCallback, useRef } from 'react';

interface PasteImageOptions {
  onImagePaste: (file: File) => void;
  onError?: (error: string) => void;
  maxSize?: number; // em bytes
  allowedTypes?: string[];
}

export const usePasteImage = ({
  onImagePaste,
  onError,
  maxSize = 10 * 1024 * 1024, // 10MB por padrão
  allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
}: PasteImageOptions) => {
  const isHandlingPaste = useRef(false);

  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    // Evitar processamento duplo
    if (isHandlingPaste.current) {
      return;
    }
    
    const clipboardData = event.clipboardData;
    if (!clipboardData) {
      return;
    }

    // Verificar se há arquivos na área de transferência
    const items = Array.from(clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));

    if (imageItems.length === 0) {
      return;
    }

    // Prevenir comportamento padrão apenas se houver imagens
    event.preventDefault();
    isHandlingPaste.current = true;

    try {
      for (const item of imageItems) {
        if (!allowedTypes.includes(item.type)) {
          onError?.(`Tipo de arquivo não suportado: ${item.type}`);
          continue;
        }

        const file = item.getAsFile();
        if (!file) {
          continue;
        }

        // Verificar tamanho do arquivo
        if (file.size > maxSize) {
          const maxSizeMB = Math.round(maxSize / (1024 * 1024));
          onError?.(`Arquivo muito grande. Tamanho máximo: ${maxSizeMB}MB`);
          continue;
        }

        // Criar um nome para o arquivo colado
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extension = file.type.split('/')[1] || 'png';
        const fileName = `imagem-colada-${timestamp}.${extension}`;

        // Criar um novo arquivo com nome personalizado
        const renamedFile = new File([file], fileName, {
          type: file.type,
          lastModified: file.lastModified
        });

        onImagePaste(renamedFile);
      }
    } catch (error) {
      console.error('Erro ao processar imagem colada:', error);
      onError?.('Erro ao processar imagem colada');
    } finally {
      // Resetar flag após um pequeno delay
      setTimeout(() => {
        isHandlingPaste.current = false;
      }, 100);
    }
  }, [onImagePaste, onError, maxSize, allowedTypes]);

  const attachPasteListener = useCallback((element: HTMLElement | null) => {
    if (!element) {
      return;
    }

    element.addEventListener('paste', handlePaste);
    
    return () => {
      element.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  return { attachPasteListener };
};