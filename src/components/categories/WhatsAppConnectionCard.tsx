import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageCircle, QrCode, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { isEvolutionConnected } from '@/hooks/useEvolutionApi';

interface Props {
  evolutionInstanceName: string;
  setEvolutionInstanceName: (v: string) => void;
  evolutionState: string | null;
  evolutionOpsLoading: boolean;
  evolutionInstances: Array<{ name: string; state: string | null }>;
  evolutionInstancesLoading: boolean;
  saveInstanceLoading: boolean;
  createInstanceLoading: boolean;
  qrDialogOpen: boolean;
  setQrDialogOpen: (v: boolean) => void;
  qrDataUrl: string | null;
  onRefreshConnection: () => void;
  onListInstances: () => void;
  onOpenQr: () => void;
  onSaveInstanceName: () => void;
  onCreateInstance: () => void;
}

export default function WhatsAppConnectionCard({
  evolutionInstanceName, setEvolutionInstanceName,
  evolutionState, evolutionOpsLoading,
  evolutionInstances, evolutionInstancesLoading,
  saveInstanceLoading, createInstanceLoading,
  qrDialogOpen, setQrDialogOpen, qrDataUrl,
  onRefreshConnection, onListInstances, onOpenQr,
  onSaveInstanceName, onCreateInstance,
}: Props) {
  const connected = isEvolutionConnected(evolutionState);

  return (
    <>
      <Card className="border-green-600/30 bg-gradient-to-br from-green-50/80 to-white">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-green-600/10 p-2.5 text-green-700">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Conexão WhatsApp
                  {evolutionState && (
                    <Badge variant={connected ? 'success' : 'secondary'} className="ml-1 gap-1">
                      {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                      {evolutionState}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="max-w-2xl mt-1">
                  Conecte um número via QR Code e gerencie a instância Evolution API.
                  A chave da API fica apenas nos secrets da Edge Function.
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onListInstances} disabled={evolutionInstancesLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${evolutionInstancesLoading ? 'animate-spin' : ''}`} />
                Listar instâncias
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onRefreshConnection} disabled={evolutionOpsLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${evolutionOpsLoading ? 'animate-spin' : ''}`} />
                Verificar conexão
              </Button>
              <Button type="button" size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={onOpenQr} disabled={evolutionOpsLoading}>
                <QrCode className="mr-2 h-4 w-4" />
                Conectar via QR
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:max-w-md">
            <Label htmlFor="evo-instance">Nome da instância</Label>
            {evolutionInstances.length > 0 && (
              <Select
                value={evolutionInstanceName || 'manual'}
                onValueChange={(value) => { if (value !== 'manual') setEvolutionInstanceName(value); }}
              >
                <SelectTrigger id="evo-instance">
                  <SelectValue placeholder="Selecione ou digite manualmente" />
                </SelectTrigger>
                <SelectContent>
                  {evolutionInstances.map((instance) => (
                    <SelectItem key={instance.name} value={instance.name}>
                      {instance.name}{instance.state ? ` (${instance.state})` : ''}
                    </SelectItem>
                  ))}
                  <SelectItem value="manual">Digitar manualmente...</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Input
              value={evolutionInstanceName}
              onChange={(e) => setEvolutionInstanceName(e.target.value)}
              placeholder="ex: helpdesk-prod"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={onSaveInstanceName} disabled={saveInstanceLoading}>
                {saveInstanceLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Salvar nome'}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onCreateInstance} disabled={createInstanceLoading}>
                {createInstanceLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Criar instância na Evolution'}
              </Button>
            </div>
          </div>

          {/* Detected instances */}
          <div className="rounded-md border border-green-200 bg-green-50/60 p-3">
            <p className="text-xs font-medium text-green-900">Instâncias detectadas na Evolution</p>
            {evolutionInstancesLoading ? (
              <p className="mt-1 text-xs text-green-800">Carregando instâncias...</p>
            ) : evolutionInstances.length === 0 ? (
              <p className="mt-1 text-xs text-green-800">Nenhuma instância retornada. Clique em "Listar instâncias".</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {evolutionInstances.map((instance) => (
                  <Badge
                    key={instance.name}
                    variant={isEvolutionConnected(instance.state) ? 'success' : 'secondary'}
                    className="cursor-pointer"
                    onClick={() => setEvolutionInstanceName(instance.name)}
                  >
                    {instance.name}{instance.state ? ` · ${instance.state}` : ''}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* QR Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no celular, aparelhos conectados, e escaneie o código. O sistema verifica automaticamente e fecha ao conectar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code WhatsApp" className="rounded-lg border bg-white p-2" />
            ) : (
              <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
