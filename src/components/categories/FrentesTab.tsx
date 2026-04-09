import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Pencil, Trash2, Power, CheckCircle2, RefreshCw } from 'lucide-react';
import type { Tag as TagType } from '@/services/categoryService';

interface Props {
  loading: boolean;
  tags: TagType[];
  onCreateFrente: () => void;
  onEditFrente: (tag: TagType) => void;
  onDeleteFrente: (tag: TagType) => void;
  onToggleStatus: (tag: TagType) => void;
}

export default function FrentesTab({ loading, tags, onCreateFrente, onEditFrente, onDeleteFrente, onToggleStatus }: Props) {
  return (
    <div className="space-y-6">
      <Card className="border-[#F69F19]/20">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Frentes de Atuação</CardTitle>
              <CardDescription>
                Frentes organizam as categorias (ex: Controladoria Jurídica, Inteligência de Dados). O usuário escolhe a frente ao criar um ticket.
              </CardDescription>
            </div>
            <Button onClick={onCreateFrente} className="bg-[#F69F19] hover:bg-[#F69F19]/90 text-[#2C2D2F]" size="sm">
              <PlusCircle className="h-4 w-4 mr-2" />
              Nova Frente de Atuação
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><RefreshCw className="h-6 w-6 animate-spin text-[#F69F19]" /></div>
          ) : tags.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">Nenhuma frente de atuação cadastrada. Crie uma para organizar as categorias.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tags.sort((a, b) => (a.order || 0) - (b.order || 0)).map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 bg-white hover:shadow-sm transition-shadow"
                >
                  <div className="w-5 h-5 rounded-full shrink-0 ring-2 ring-offset-1" style={{ backgroundColor: tag.color, ringColor: tag.color }} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-[#2C2D2F] block truncate">{tag.label}</span>
                    <span className="text-xs text-slate-400">{tag.key}</span>
                  </div>
                  {!tag.isActive && <Badge variant="secondary" className="text-xs shrink-0">Inativa</Badge>}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      title={tag.isActive ? 'Inativar' : 'Ativar'}
                      onClick={() => onToggleStatus(tag)}
                    >
                      {tag.isActive
                        ? <Power className="h-3.5 w-3.5 text-amber-600" />
                        : <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      }
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => onEditFrente(tag)}>
                      <Pencil className="h-3.5 w-3.5 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700" title="Excluir" onClick={() => onDeleteFrente(tag)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
