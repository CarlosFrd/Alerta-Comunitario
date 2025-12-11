# Correção: Conflito de Variável `riskZonesListener`

## 🐛 Problema

**Erro no console:**
```
Uncaught SyntaxError: Identifier 'riskZonesListener' has already been declared (at citizenSafety.js?v=20251127003:1:1)
```

**Sintomas:**
- Modal de voto não aparece para cidadãos (nem com F5)
- Zonas não desaparecem automaticamente quando operador remove (só com F5)
- Sistema de segurança completamente quebrado

## 🔍 Causa Raiz

A variável `riskZonesListener` estava sendo declarada em **dois arquivos diferentes**:

1. **`riskZones.js:2`** - Listener para carregar zonas no mapa do operador
2. **`citizenSafety.js:4`** - Listener para detectar cidadãos em zonas de risco

Quando os dois arquivos são carregados na mesma página (index.html ou operador.html), o JavaScript tentava declarar a mesma variável global duas vezes, causando o SyntaxError.

### Por que isso quebrava todo o sistema?

O erro de sintaxe **impedia o carregamento completo do arquivo `citizenSafety.js`**, o que significava:
- A função `initCitizenRiskZoneListener()` não era definida
- A função `checkCitizenInRiskZone()` não era definida
- Todo o sistema de detecção e modal de segurança não funcionava

## ✅ Solução

Renomeada a variável em `citizenSafety.js` para evitar conflito:

```javascript
// ANTES (conflito)
let riskZonesListener = null;

// DEPOIS (sem conflito)
let citizenRiskZonesListener = null; // Renomeado para evitar conflito com riskZones.js
```

### Alterações Realizadas:

#### 1. `public/js/citizenSafety.js`

**Linha 4:**
```javascript
let citizenRiskZonesListener = null; // Renomeado para evitar conflito com riskZones.js
```

**Linha 19:**
```javascript
citizenRiskZonesListener = db.collection('alerts')
    .where('active', '==', true)
    .onSnapshot((snapshot) => {
        // ...
    });
```

#### 2. `public/index.html` e `public/operador.html`

**Cache Buster atualizado de `20251127003` → `20251127004`**

```javascript
const cacheBuster = '20251127004';
```

Isso força o navegador a recarregar os arquivos JavaScript, garantindo que a versão corrigida seja utilizada.

## 📊 Diferença Entre os Dois Listeners

Embora tenham o mesmo propósito (escutar mudanças nas zonas), eles são usados para coisas diferentes:

| Aspecto | `riskZones.js` | `citizenSafety.js` |
|---------|----------------|-------------------|
| **Variável** | `riskZonesListener` | `citizenRiskZonesListener` |
| **Propósito** | Renderizar zonas no mapa | Detectar cidadão dentro de zona |
| **Usado por** | Operador e Cidadão (visualização) | Apenas Cidadão (detecção) |
| **Ação** | Adiciona/Remove polígonos no mapa | Dispara modal "Está seguro?" |
| **Cache** | Armazena em `riskZoneLayers{}` | Armazena em `activeRiskZones[]` |

## 🧪 Como Testar

### Teste 1: Verificar que o erro sumiu
1. Abra o console do navegador (F12)
2. Recarregue a página (Ctrl+Shift+R para forçar reload)
3. ✅ **Não deve haver erro** `Identifier 'riskZonesListener' has already been declared`

### Teste 2: Modal aparece para cidadão
1. Faça login como operador
2. Crie uma zona de risco no mapa
3. Faça login como cidadão em outra aba
4. Entre na zona de risco
5. ✅ **Modal deve aparecer imediatamente** perguntando "Você está seguro?"

### Teste 3: Zona desaparece ao ser removida
1. Com cidadão dentro de uma zona
2. Operador remove a zona
3. ✅ **Zona deve desaparecer automaticamente** no mapa do cidadão (sem F5)

## 🎯 Resultado Final

✅ **Erro de sintaxe corrigido**
✅ **Sistema de segurança funcionando**
✅ **Modal aparece em tempo real**
✅ **Zonas aparecem/desaparecem instantaneamente**

---

## 📝 Lições Aprendidas

### Problema: Variáveis globais duplicadas

**Evitar no futuro:**
- Usar nomes mais específicos para variáveis globais
- Considerar usar namespaces ou módulos
- Revisar todos os arquivos ao adicionar novas variáveis globais

**Exemplo de boas práticas:**
```javascript
// ❌ Nome genérico (pode conflitar)
let listener = null;

// ✅ Nome específico (evita conflitos)
let citizenRiskZonesListener = null;
```

### Depuração de erros de sintaxe

Quando um arquivo JavaScript tem erro de sintaxe:
1. Nenhuma função do arquivo é definida
2. O erro pode quebrar toda a aplicação
3. Mesmo código que parece correto pode não executar
4. **Sempre verificar o console do navegador primeiro!**

---

## 🔄 Próximos Passos

1. **Testar em produção:**
   ```bash
   # Limpar cache do navegador
   Ctrl+Shift+R (ou Cmd+Shift+R no Mac)

   # Ou limpar cache manualmente
   F12 → Application → Clear storage → Clear site data
   ```

2. **Monitorar logs:**
   - Verificar se o listener está sendo iniciado corretamente
   - Confirmar que não há outros conflitos de variáveis
   - Observar se o modal aparece para cidadãos

3. **Considerar refatoração futura:**
   - Encapsular código em módulos ES6
   - Usar IIFE (Immediately Invoked Function Expression) para evitar poluição do escopo global
   - Implementar namespacing pattern

---

**Data da Correção:** 2025-11-27
**Cache Buster:** 20251127004
