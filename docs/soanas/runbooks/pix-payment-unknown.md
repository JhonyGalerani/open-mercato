# Runbook: Payment unknown (adquirente aprovou, Soanas sem resposta)

**IDs:** PAY-ERR-002, TEST-PAY-001

## Symptoms

Venda em `PAYMENT_UNKNOWN`; operador inseguro se re-cobrar.

## Do

1. Não iniciar nova cobrança automática.
2. Consultar status no provider com `idempotencyKey` / operation id.
3. Conciliar manualmente se provider confirma.
4. Registrar incidente com correlation id.

## Don't

- Retry capture sem getStatus.
- Apagar a venda.

_Status: stub — detalhar na Fase 2._
