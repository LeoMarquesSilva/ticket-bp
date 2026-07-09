import WhatsAppConnectionCard from './WhatsAppConnectionCard';
import WhatsAppBulkConfig from './WhatsAppBulkConfig';
import WhatsAppStaleTicketsCard from './WhatsAppStaleTicketsCard';
import WhatsAppSubcategoryList from './WhatsAppSubcategoryList';
import type { Category, Tag as TagType, Subcategory } from '@/services/categoryService';
import type { EvolutionChatOption } from '@/services/evolutionEdgeService';

interface TagGroup {
  tag: TagType | null;
  tagLabel: string;
  categories: Category[];
}

interface Props {
  // Connection
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
  // Bulk
  tags: TagType[];
  whatsappFrenteFilter: string;
  setWhatsappFrenteFilter: (v: string) => void;
  bulkWhatsappNotifyEnabled: boolean;
  setBulkWhatsappNotifyEnabled: (v: boolean) => void;
  bulkWhatsappMessageTemplate: string;
  setBulkWhatsappMessageTemplate: (v: string) => void;
  bulkWhatsappRecipient: string;
  setBulkWhatsappRecipient: (v: string) => void;
  bulkWhatsappApplying: boolean;
  bulkTargetSubcategories: Subcategory[];
  onApplyBulk: () => void;
  // Chats
  whatsappChats: EvolutionChatOption[];
  whatsappChatsLoading: boolean;
  onLoadChats: () => void;
  // List
  filteredWhatsappTagGroups: [string, TagGroup][];
  onConfigureSubcategory: (sub: Subcategory) => void;
  // Alerta de tickets parados
  staleTicketDays: string;
  setStaleTicketDays: (v: string) => void;
  staleTicketRecipient: string;
  setStaleTicketRecipient: (v: string) => void;
  staleTicketTemplate: string;
  setStaleTicketTemplate: (v: string) => void;
  staleTicketLoading: boolean;
  staleTicketSaving: boolean;
  onSaveStaleTicketSettings: () => void;
}

export default function WhatsAppTab(props: Props) {
  return (
    <div className="space-y-6">
      <WhatsAppConnectionCard
        evolutionInstanceName={props.evolutionInstanceName}
        setEvolutionInstanceName={props.setEvolutionInstanceName}
        evolutionState={props.evolutionState}
        evolutionOpsLoading={props.evolutionOpsLoading}
        evolutionInstances={props.evolutionInstances}
        evolutionInstancesLoading={props.evolutionInstancesLoading}
        saveInstanceLoading={props.saveInstanceLoading}
        createInstanceLoading={props.createInstanceLoading}
        qrDialogOpen={props.qrDialogOpen}
        setQrDialogOpen={props.setQrDialogOpen}
        qrDataUrl={props.qrDataUrl}
        onRefreshConnection={props.onRefreshConnection}
        onListInstances={props.onListInstances}
        onOpenQr={props.onOpenQr}
        onSaveInstanceName={props.onSaveInstanceName}
        onCreateInstance={props.onCreateInstance}
      />
      <WhatsAppBulkConfig
        tags={props.tags}
        whatsappFrenteFilter={props.whatsappFrenteFilter}
        setWhatsappFrenteFilter={props.setWhatsappFrenteFilter}
        bulkWhatsappNotifyEnabled={props.bulkWhatsappNotifyEnabled}
        setBulkWhatsappNotifyEnabled={props.setBulkWhatsappNotifyEnabled}
        bulkWhatsappMessageTemplate={props.bulkWhatsappMessageTemplate}
        setBulkWhatsappMessageTemplate={props.setBulkWhatsappMessageTemplate}
        bulkWhatsappRecipient={props.bulkWhatsappRecipient}
        setBulkWhatsappRecipient={props.setBulkWhatsappRecipient}
        bulkWhatsappApplying={props.bulkWhatsappApplying}
        bulkTargetSubcategories={props.bulkTargetSubcategories}
        onApplyBulk={props.onApplyBulk}
        whatsappChats={props.whatsappChats}
        whatsappChatsLoading={props.whatsappChatsLoading}
        onLoadChats={props.onLoadChats}
      />
      <WhatsAppStaleTicketsCard
        staleTicketDays={props.staleTicketDays}
        setStaleTicketDays={props.setStaleTicketDays}
        staleTicketRecipient={props.staleTicketRecipient}
        setStaleTicketRecipient={props.setStaleTicketRecipient}
        staleTicketTemplate={props.staleTicketTemplate}
        setStaleTicketTemplate={props.setStaleTicketTemplate}
        staleTicketLoading={props.staleTicketLoading}
        staleTicketSaving={props.staleTicketSaving}
        onSave={props.onSaveStaleTicketSettings}
        whatsappChats={props.whatsappChats}
        whatsappChatsLoading={props.whatsappChatsLoading}
        onLoadChats={props.onLoadChats}
      />
      <WhatsAppSubcategoryList
        tagGroups={props.filteredWhatsappTagGroups}
        onConfigureSubcategory={props.onConfigureSubcategory}
      />
    </div>
  );
}
