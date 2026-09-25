import {
  Briefcase,
  Building2,
  Calculator,
  ClipboardCheck,
  Database,
  FileText,
  FlaskConical,
  Landmark,
  Megaphone,
  Monitor,
  Scale,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  resolveFrenteIconName,
  type FrenteIconName,
} from '@/utils/ticketCategoryGroups';

const FRENTE_ICON_COMPONENTS: Record<FrenteIconName, LucideIcon> = {
  briefcase: Briefcase,
  'building-2': Building2,
  calculator: Calculator,
  'clipboard-check': ClipboardCheck,
  database: Database,
  'file-text': FileText,
  'flask-conical': FlaskConical,
  landmark: Landmark,
  megaphone: Megaphone,
  monitor: Monitor,
  scale: Scale,
  'shield-check': ShieldCheck,
  users: Users,
};

interface FrenteIconProps {
  icon?: string | null;
  frenteKey?: string | null;
  label?: string | null;
  className?: string;
}

export function FrenteIcon({ icon, frenteKey, label, className }: FrenteIconProps) {
  const Icon = FRENTE_ICON_COMPONENTS[resolveFrenteIconName(icon, frenteKey, label)];
  return <Icon className={className} aria-hidden="true" />;
}
