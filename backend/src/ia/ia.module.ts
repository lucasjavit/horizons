import { Global, Module } from '@nestjs/common';
import { IaService } from './ia.service';
import { OrdemDaIaService } from './ordem.service';
import { SaudeDaIaService } from './saude.service';

/**
 * A cadeia de provedores de IA, sua ordem e a saude das chaves.
 *
 * `@Global()` pelo mesmo motivo do `PrismaModule`: e infraestrutura que
 * qualquer modulo pode precisar (hoje `jobs` e `settings`), e importa-lo em
 * cada um so produziria ruido. Injete os servicos direto.
 *
 * Tres servicos com responsabilidades separadas:
 * - `IaService` fala com os provedores (a cadeia, e a verificacao de uma chave)
 * - `OrdemDaIaService` guarda em que ordem eles sao tentados
 * - `SaudeDaIaService` guarda o resultado da ultima verificacao
 */
@Global()
@Module({
  providers: [IaService, OrdemDaIaService, SaudeDaIaService],
  exports: [IaService, OrdemDaIaService, SaudeDaIaService],
})
export class IaModule {}
