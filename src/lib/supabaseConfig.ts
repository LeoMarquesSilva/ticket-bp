// Configuração para reduzir a frequência de health checks do Supabase
export const supabaseOptions = {
  realtime: {
    params: {
      eventsPerSecond: 1, // Limitar a 1 evento por segundo
      healthCheckIntervalMs: 60000, // Verificar saúde a cada 60 segundos em vez do padrão (mais frequente)
    },
  },
};