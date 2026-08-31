import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Mail, MessageCircle, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCategories } from '@/hooks/useCategories';
import { useEvolutionApi } from '@/hooks/useEvolutionApi';
import TicketCommunicationsTab from '@/components/categories/TicketCommunicationsTab';
import TicketCommunicationScheduleTab from '@/components/categories/TicketCommunicationScheduleTab';
import WhatsAppTab from '@/components/categories/WhatsAppTab';
import SubcategoryFormDialog from '@/components/categories/SubcategoryFormDialog';
import { getInitialSettingsTab } from './settingsTabs';

export default function Settings() {
  const cat = useCategories();
  const evo = useEvolutionApi(cat.loadData);
  const initialTab = getInitialSettingsTab(
    typeof window === 'undefined' ? '' : window.location.search,
  );
  const [editSubcategoryDialogOpen, setEditSubcategoryDialogOpen] = useState(false);

  useEffect(() => {
    if (cat.canAccess) {
      evo.loadInstanceName();
      evo.loadEvolutionInstances();
      evo.loadStaleTicketSettings();
      evo.loadUnansweredTickets();
    }
  }, [cat.canAccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredWhatsappTagGroups = useMemo(() =>
    cat.sortedTagGroups.filter(([tagKey, group]) => {
      if (evo.whatsappFrenteFilter === 'all') return true;
      if (evo.whatsappFrenteFilter === 'sem-frente') return tagKey === 'sem-tag';
      return group.tag?.id === evo.whatsappFrenteFilter;
    }),
  [cat.sortedTagGroups, evo.whatsappFrenteFilter]);

  const bulkTargetSubcategories = useMemo(() =>
    filteredWhatsappTagGroups.flatMap(([, group]) => group.categories.flatMap((category) => category.subcategories ?? [])),
  [filteredWhatsappTagGroups]);

  const whatsappActiveCount = useMemo(() =>
    cat.categories.flatMap((category) => category.subcategories ?? []).filter((subcategory) => subcategory.whatsappNotifyEnabled).length,
  [cat.categories]);

  if (!cat.canAccess) return null;

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5 py-5 animate-in fade-in duration-300">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#2C2D2F] text-white">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[#2C2D2F]">Configurações</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Conexões e avisos automáticos do atendimento: e-mail, Teams e WhatsApp.
            </p>
          </div>
        </div>
      </header>

      <Tabs defaultValue={initialTab} className="w-full">
        <div className="overflow-x-auto border-b border-slate-200">
          <TabsList className="h-11 w-max min-w-full justify-start rounded-none bg-transparent p-0">
            <TabsTrigger value="comunicacoes" className="h-11 gap-2 rounded-none border-b-2 border-transparent px-4 text-sm data-[state=active]:border-[#DE5532] data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              <Mail className="h-4 w-4" />
              Comunicações
            </TabsTrigger>
            <TabsTrigger value="quando-enviar" className="h-11 gap-2 rounded-none border-b-2 border-transparent px-4 text-sm data-[state=active]:border-[#DE5532] data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              <CalendarClock className="h-4 w-4" />
              Quando enviar
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="h-11 gap-2 rounded-none border-b-2 border-transparent px-4 text-sm data-[state=active]:border-[#DE5532] data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
              {whatsappActiveCount > 0 && (
                <Badge variant="success" className="ml-1 h-5 min-w-5 px-1.5 text-xs">{whatsappActiveCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="comunicacoes" className="mt-6">
          <TicketCommunicationsTab />
        </TabsContent>

        <TabsContent value="quando-enviar" className="mt-6">
          <TicketCommunicationScheduleTab />
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-6">
          <WhatsAppTab
            evolutionInstanceName={evo.evolutionInstanceName}
            setEvolutionInstanceName={evo.setEvolutionInstanceName}
            evolutionState={evo.evolutionState}
            evolutionOpsLoading={evo.evolutionOpsLoading}
            evolutionInstances={evo.evolutionInstances}
            evolutionInstancesLoading={evo.evolutionInstancesLoading}
            saveInstanceLoading={evo.saveInstanceLoading}
            createInstanceLoading={evo.createInstanceLoading}
            qrDialogOpen={evo.qrDialogOpen}
            setQrDialogOpen={evo.setQrDialogOpen}
            qrDataUrl={evo.qrDataUrl}
            onRefreshConnection={() => void evo.refreshEvolutionConnection()}
            onListInstances={() => void evo.loadEvolutionInstances()}
            onOpenQr={() => void evo.openQrDialog()}
            onSaveInstanceName={() => void evo.saveEvolutionInstanceName()}
            onCreateInstance={() => void evo.createEvolutionInstance()}
            tags={cat.tags}
            whatsappFrenteFilter={evo.whatsappFrenteFilter}
            setWhatsappFrenteFilter={evo.setWhatsappFrenteFilter}
            bulkWhatsappNotifyEnabled={evo.bulkWhatsappNotifyEnabled}
            setBulkWhatsappNotifyEnabled={evo.setBulkWhatsappNotifyEnabled}
            bulkWhatsappMessageTemplate={evo.bulkWhatsappMessageTemplate}
            setBulkWhatsappMessageTemplate={evo.setBulkWhatsappMessageTemplate}
            bulkWhatsappRecipient={evo.bulkWhatsappRecipient}
            setBulkWhatsappRecipient={evo.setBulkWhatsappRecipient}
            bulkWhatsappApplying={evo.bulkWhatsappApplying}
            bulkTargetSubcategories={bulkTargetSubcategories}
            onApplyBulk={() => void evo.applyBulkWhatsapp(bulkTargetSubcategories)}
            whatsappChats={evo.whatsappChats}
            whatsappChatsLoading={evo.whatsappChatsLoading}
            onLoadChats={() => void evo.loadWhatsappChats()}
            filteredWhatsappTagGroups={filteredWhatsappTagGroups}
            onConfigureSubcategory={(subcategory) => { cat.setEditingSubcategory(subcategory); setEditSubcategoryDialogOpen(true); }}
            staleTicketDays={evo.staleTicketDays}
            setStaleTicketDays={evo.setStaleTicketDays}
            staleTicketRecipient={evo.staleTicketRecipient}
            setStaleTicketRecipient={evo.setStaleTicketRecipient}
            staleTicketTemplate={evo.staleTicketTemplate}
            setStaleTicketTemplate={evo.setStaleTicketTemplate}
            staleTicketLoading={evo.staleTicketLoading}
            staleTicketSaving={evo.staleTicketSaving}
            onSaveStaleTicketSettings={() => void evo.saveStaleTicketSettings()}
            unansweredTickets={evo.unansweredTickets}
            unansweredTicketsLoading={evo.unansweredTicketsLoading}
            onLoadUnansweredTickets={() => void evo.loadUnansweredTickets()}
            sendingAlertTicketId={evo.sendingAlertTicketId}
            onSendAlertNow={(ticketId) => void evo.sendStaleAlertNow(ticketId)}
          />
        </TabsContent>
      </Tabs>

      {cat.editingSubcategory && (
        <SubcategoryFormDialog
          mode="edit"
          open={editSubcategoryDialogOpen}
          onOpenChange={setEditSubcategoryDialogOpen}
          data={cat.editingSubcategory}
          setData={cat.setEditingSubcategory as (value: any) => void}
          loading={cat.editSubcategoryLoading}
          onSubmit={cat.handleEditSubcategory}
          supportUsers={cat.supportUsers}
          getRoleLabel={cat.getRoleLabel}
          whatsappChats={evo.whatsappChats}
          whatsappChatsLoading={evo.whatsappChatsLoading}
          onLoadChats={() => void evo.loadWhatsappChats()}
        />
      )}
    </div>
  );
}
