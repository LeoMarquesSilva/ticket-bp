import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn } from 'lucide-react';

export interface CroppedAreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
    img.src = url;
  });
}

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: CroppedAreaPixels,
  fileName: string
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d context unavailable');

  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, // source
    0, 0, pixelCrop.width, pixelCrop.height // dest
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Falha ao gerar imagem recortada'));
          return;
        }
        const croppedFile = new File([blob], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' });
        resolve(croppedFile);
      },
      'image/jpeg',
      0.92
    );
  });
}

interface AvatarCropModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageFile: File | null;
  onCropComplete: (croppedFile: File) => void;
}

const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  open,
  onOpenChange,
  imageFile,
  onCropComplete,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedAreaPixels | null>(null);
  const [loading, setLoading] = useState(false);

  // Carregar imagem quando o modal abre com um arquivo
  React.useEffect(() => {
    if (!open || !imageFile) {
      setImageSrc(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImageSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    return () => URL.revokeObjectURL(url);
  }, [open, imageFile]);

  const onCropCompleteCallback = useCallback((_: unknown, croppedAreaPixels: CroppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels || !imageFile) return;
    setLoading(true);
    try {
      const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels, imageFile.name);
      onCropComplete(croppedFile);
      onOpenChange(false);
    } catch (e) {
      console.error('Erro ao recortar imagem:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden gap-0 duration-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <ZoomIn className="h-5 w-5 text-[#F69F19]" />
            Recortar foto
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500 px-4">
          Arraste para posicionar e use o zoom para ajustar. O recorte será exibido em formato circular.
        </p>
        <div className="relative w-full h-[320px] bg-slate-100">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropCompleteCallback}
              objectFit="contain"
              style={{
                containerStyle: { borderRadius: 0 },
                cropAreaStyle: { border: '2px solid #F69F19' },
              }}
            />
          )}
        </div>
        <div className="px-4 space-y-2">
          <label className="text-xs font-medium text-slate-600">Zoom</label>
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.1}
            onValueChange={([v]) => setZoom(v ?? 1)}
            className="w-full"
          />
        </div>
        <DialogFooter className="p-4 pt-0 gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!croppedAreaPixels || loading}
            className="bg-[#F69F19] hover:bg-[#e08e12] text-white"
          >
            {loading ? 'Recortando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AvatarCropModal;
