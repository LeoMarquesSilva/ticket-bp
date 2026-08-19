interface FinishTicketOperationHandlers {
  operation: () => Promise<boolean>;
  onSuccess: () => void;
  onError: (error: unknown) => void;
}

export async function runFinishTicketOperation({
  operation,
  onSuccess,
  onError,
}: FinishTicketOperationHandlers): Promise<void> {
  let completed: boolean;

  try {
    completed = await operation();
  } catch (error) {
    onError(error);
    return;
  }

  if (completed) onSuccess();
}
