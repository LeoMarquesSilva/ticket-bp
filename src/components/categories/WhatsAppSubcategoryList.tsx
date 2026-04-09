import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings2, MessageCircle } from 'lucide-react';
import type { Category, Subcategory, Tag as TagType } from '@/services/categoryService';

interface TagGroup {
  tag: TagType | null;
  tagLabel: string;
  categories: Category[];
}

interface Props {
  tagGroups: [string, TagGroup][];
  onConfigureSubcategory: (sub: Subcategory) => void;
}

export default function WhatsAppSubcategoryList({ tagGroups, onConfigureSubcategory }: Props) {
  const allSubcategories = tagGroups.flatMap(([, g]) => g.categories.flatMap((c) => c.subcategories ?? []));
  const activeCount = allSubcategories.filter((s) => s.whatsappNotifyEnabled).length;

  return (
    <Card className="border-green-600/20">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-green-600/10 p-2 text-green-700">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle>Status por Subcategoria</CardTitle>
              <Badge variant={activeCount > 0 ? 'success' : 'secondary'} className="text-xs">
                {activeCount} ativas
              </Badge>
            </div>
            <CardDescription>Visualize e configure a notificação WhatsApp individualmente.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {tagGroups.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma categoria/subcategoria para essa frente.</p>
        ) : (
          tagGroups.map(([tagKey, group]) => (
            <div key={tagKey} className="rounded-md border p-3">
              <div className="mb-3 flex items-center gap-2">
                {group.tag && (
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.tag.color }} />
                )}
                <Badge variant="outline">{group.tagLabel}</Badge>
                <span className="text-xs text-slate-500">{group.categories.length} categorias</span>
              </div>
              <div className="space-y-2">
                {group.categories.flatMap((category) =>
                  (category.subcategories ?? []).map((sub) => (
                    <div key={sub.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-slate-50 p-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {category.label} / {sub.label}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          Destino: {sub.whatsappRecipient?.trim() || <span className="italic">não configurado</span>}
                        </p>
                        {sub.whatsappMessageTemplate?.trim() && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md">
                            Modelo: {sub.whatsappMessageTemplate.substring(0, 60)}...
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={sub.whatsappNotifyEnabled ? 'success' : 'secondary'}>
                          {sub.whatsappNotifyEnabled ? 'Ativo' : 'Inativo'}
                        </Badge>
                        <Button type="button" size="sm" variant="outline" onClick={() => onConfigureSubcategory(sub)}>
                          <Settings2 className="mr-2 h-4 w-4" />
                          Configurar
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
