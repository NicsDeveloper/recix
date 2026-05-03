/**
 * Rótulos e descrições curtas para métricas que aparecem em mais de uma tela.
 * Alinhados ao cálculo único no backend (ChargeReportingMetrics + fechamento).
 */
export const METRIC_LABELS = {
  /** Cartão “esperado” no dashboard e primeiro KPI em Cobranças (mesmo cálculo do fechamento). */
  expectedTotalTitle: 'Total esperado',
  expectedTotalSubtitle:
    'Cobranças criadas no intervalo + cobranças só ligadas a conciliações deste período (inclui pendentes; exclui canceladas) — alinhado ao fechamento.',

  /** Bloco de relatório / PDF que repete o fechamento. */
  closingExpectedLabel: 'Valor esperado',
  closingExpectedSub:
    'Mesmo total do cartão “Total esperado” no dashboard e do primeiro KPI em Cobranças.',
} as const
