export type TicketNotifyContext = {
  assignee: string | null;
  requester: string | null;
  category: string;
};

type NotifyAccessOptions = {
  isFrenteRestricted: boolean;
  userCategoryKeys: string[];
  canViewAllTickets: boolean;
  strictFrenteOnly?: boolean;
  assignedOnly?: boolean;
};

export function shouldNotifyNewTicket(
  ctx: TicketNotifyContext & { isUnassigned: boolean },
  userId: string,
  options: NotifyAccessOptions & { isStaff: boolean }
): boolean {
  if (options.canViewAllTickets) return true;

  if (options.assignedOnly) {
    return ctx.assignee === userId;
  }

  if (options.strictFrenteOnly) {
    return options.userCategoryKeys.includes(ctx.category);
  }

  if (ctx.requester === userId || ctx.assignee === userId) return true;

  if (!ctx.isUnassigned || !options.isStaff) return false;

  if (options.isFrenteRestricted) {
    return options.userCategoryKeys.includes(ctx.category);
  }

  return true;
}

export function shouldNotifyMessage(
  ctx: TicketNotifyContext,
  userId: string,
  options: NotifyAccessOptions
): boolean {
  if (options.canViewAllTickets) return true;

  if (options.assignedOnly) {
    return ctx.assignee === userId;
  }

  if (options.strictFrenteOnly) {
    return options.userCategoryKeys.includes(ctx.category);
  }

  if (ctx.requester === userId || ctx.assignee === userId) return true;

  if (options.isFrenteRestricted && options.userCategoryKeys.includes(ctx.category)) {
    return true;
  }

  return false;
}
