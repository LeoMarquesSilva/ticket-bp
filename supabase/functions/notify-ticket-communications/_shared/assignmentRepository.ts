type QueryResult = { data: unknown; error: unknown };

interface SupabaseClientLike {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<QueryResult>;
}

export type ClaimedAssignmentNotification = {
  id: string;
  ticket_id: string;
  ticket_title: string | null;
  ticket_current_assignee_id: string | null;
  assignee_id: string;
  assignee_name: string | null;
  assignee_email: string | null;
  assignee_is_active: boolean;
  assigned_by_name: string | null;
  requester_name: string | null;
  reason: 'assigned' | 'linked';
  linked_from_title: string | null;
};

export function createTicketAssignmentRepository(supabaseAdmin: unknown) {
  const client = supabaseAdmin as SupabaseClientLike;
  if (!client || typeof client.rpc !== 'function') {
    throw new TypeError('Supabase admin client is required');
  }

  return {
    async verifyToken(token: string) {
      const { data, error } = await client.rpc('helpdesk_verify_ticket_assignment_token', { p_token: token });
      if (error) throw new Error('Ticket assignment repository failed: verify_token');
      return data === true;
    },

    async claim(notificationId: string): Promise<ClaimedAssignmentNotification | null> {
      const { data, error } = await client.rpc('helpdesk_claim_ticket_assignment_notification', {
        p_notification_id: notificationId,
      });
      if (error) throw new Error('Ticket assignment repository failed: claim');
      const row = Array.isArray(data) ? data[0] : data;
      return row && typeof row === 'object' ? row as ClaimedAssignmentNotification : null;
    },

    async complete(notificationId: string, status: 'sent' | 'failed' | 'skipped', error: string | null) {
      const result = await client.rpc('helpdesk_complete_ticket_assignment_notification', {
        p_notification_id: notificationId,
        p_status: status,
        p_error: error,
      });
      if (result.error) throw new Error('Ticket assignment repository failed: complete');
      return result.data === true;
    },
  };
}
