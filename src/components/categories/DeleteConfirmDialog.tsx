import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  itemLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function DeleteConfirmDialog({ open, onOpenChange, title, itemLabel, onConfirm, onCancel }: Props) {
  const handleCancel = () => {
    onOpenChange(false);
    onCancel?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[500px] border-red-200/40">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-xl font-semibold text-[#2C2D2F]">
              {title}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="text-base text-slate-600 mt-4">
              Tem certeza que deseja <strong className="text-red-600 font-semibold">excluir permanentemente</strong>
              {itemLabel ? <> <strong className="text-[#2C2D2F]">{itemLabel}</strong></> : ' este item'}?
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium mb-1">ATENÇÃO: Esta ação não pode ser desfeita!</p>
                    <ul className="list-disc list-inside space-y-1 text-red-700">
                      <li>O item será removido permanentemente do sistema</li>
                      <li>Itens dependentes podem ser afetados</li>
                    </ul>
                    <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded">
                      <p className="text-orange-800 text-xs font-medium">
                        Recomendamos <strong>DESATIVAR</strong> em vez de excluir para preservar dados históricos.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 mt-6">
          <AlertDialogCancel onClick={handleCancel} className="border-slate-300 text-slate-700 hover:bg-slate-50">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600">
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir Permanentemente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
