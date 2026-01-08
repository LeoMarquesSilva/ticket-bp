import React, { useState, useEffect } from 'react';
import { X, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PastedImagePreviewProps {
  file: File;
  onRemove: () => void;
}

const PastedImagePreview: React.FC<PastedImagePreviewProps> = ({ file, onRemove }) => {
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    // Criar URL de prévia
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Limpar URL quando o componente desmontar
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="relative group bg-white rounded-lg border-2 border-blue-200 p-2 flex items-center gap-2 max-w-xs">
      {/* Prévia da imagem */}
      <div className="flex-shrink-0">
        {previewUrl ? (
          <img 
            src={previewUrl} 
            alt={file.name}
            className="w-12 h-12 object-cover rounded border"
            onError={() => setPreviewUrl('')}
          />
        ) : (
          <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
            <Image className="h-6 w-6 text-gray-400" />
          </div>
        )}
      </div>
      
      {/* Informações do arquivo */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-blue-700 truncate">
          {file.name}
        </div>
        <div className="text-xs text-blue-500">
          {formatFileSize(file.size)}
        </div>
      </div>
      
      {/* Botão de remover */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="flex-shrink-0 h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 opacity-70 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
};

export default PastedImagePreview;