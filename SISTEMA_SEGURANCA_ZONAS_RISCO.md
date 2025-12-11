# Sistema de Verificação de Segurança em Zonas de Risco

## 📋 Visão Geral

Este sistema detecta automaticamente quando um cidadão está dentro de uma zona de risco e solicita que ele confirme se está seguro. Os operadores podem visualizar todos os cidadãos em zonas de risco e identificar quem precisa de ajuda.

---

## 🎯 Funcionalidades Implementadas

### Para Cidadãos:

1. **Detecção Automática**
   - Quando o cidadão entra em uma zona de risco, o sistema detecta automaticamente
   - Um modal aparece perguntando: **"Você está seguro?"**

2. **Duas Opções de Resposta**
   - ✅ **"Sim, estou seguro"** → Status salvo como "safe" (marcador NÃO aparece para operadores)
   - 🆘 **"Não, preciso de ajuda"** → Status salvo como "unsafe" (ponto VERMELHO visível para operadores)

3. **Status Persistente POR ZONA**
   - A resposta fica vinculada ao login do usuário **E à zona específica**
   - Se já respondeu para uma zona, não pergunta novamente naquela zona
   - Ao entrar em outra zona de risco, perguntará novamente
   - Ao fechar a aba e voltar, a resposta é mantida para cada zona
   - Se a zona for deletada e recriada no mesmo local, perguntará novamente

4. **Saída da Zona**
   - Ao sair da zona de risco, o status permanece salvo (para quando voltar)
   - A localização é atualizada continuamente enquanto estiver na zona

### Para Operadores:

1. **Visualização de Cidadãos em Risco**
   - Marcadores especiais no mapa mostram cidadãos em zonas de risco
   - **Amarelo (⚠️)**: Cidadão não respondeu ainda
   - **Vermelho (🆘)**: Cidadão precisa de ajuda
   - **Sem marcador**: Cidadão respondeu "estou seguro" (não aparece no mapa)

2. **Informações Detalhadas**
   - Clique no marcador para ver:
     - Nome do cidadão
     - Status (sem resposta / precisa de ajuda)
     - Data/hora da detecção

3. **Exclusão em Cascata**
   - Ao deletar uma zona de risco, TODOS os status de cidadãos relacionados são automaticamente removidos
   - Operadores têm permissão para deletar qualquer status de cidadão (necessário para a exclusão em cascata)

---

## 🗂️ Arquivos Criados

### JavaScript:
- **`public/js/citizenSafety.js`** - Lógica principal do sistema
  - Detecção de cidadão em zona de risco (usando Turf.js)
  - Modal de pergunta
  - Salvamento de status no Firestore
  - Carregamento de marcadores no mapa do operador

### CSS:
- **`public/css/citizenSafety.css`** - Estilos do modal e feedback
  - Modal de segurança animado
  - Botões de resposta (Sim/Não)
  - Feedback visual para o cidadão
  - Design responsivo

### Documentação:
- **`FIRESTORE_RULES_CITIZEN_SAFETY.md`** - Regras de segurança do Firestore
- **`SISTEMA_SEGURANCA_ZONAS_RISCO.md`** - Este arquivo

---

## 🔧 Integrações Realizadas

### 1. index.html (Cidadão)
- Adicionado: `citizenSafety.css`
- Adicionado: Biblioteca Turf.js
- Adicionado: `citizenSafety.js`
- Atualizado cache buster para `20251127003`

### 2. operador.html (Operador)
- Adicionado: `citizenSafety.css`
- Adicionado: Biblioteca Turf.js
- Adicionado: `citizenSafety.js`
- Atualizado cache buster para `20251127003`

### 3. citizen.js
- Integrado: Chamada para `checkCitizenInRiskZone()` ao obter localização

### 4. operator.js
- Integrado: Chamada para `loadCitizenSafetyMarkers()` ao inicializar mapa

### 5. riskZones.js
- Implementado: Exclusão em cascata na função `deleteRiskZone()`

---

## 📊 Estrutura do Firestore

### Nova Coleção: `citizenSafety`

```
citizenSafety/
  └── {documentId}
      ├── userId: "abc123"
      ├── userName: "João Silva"
      ├── zoneId: "zone456"
      ├── status: "pending" | "safe" | "unsafe"
      ├── location: { lat: -8.0476, lng: -34.8770 }
      ├── createdAt: Timestamp
      ├── lastUpdate: Timestamp
      └── respondedAt: Timestamp (opcional)
```

**Valores de Status:**
- `"pending"` - Cidadão ainda não respondeu (marcador amarelo ⚠️)
- `"safe"` - Cidadão respondeu "estou seguro" (SEM marcador no mapa)
- `"unsafe"` - Cidadão respondeu "preciso de ajuda" (marcador vermelho 🆘)

---

## ⚙️ Como Funciona Tecnicamente

### 1. Detecção de Zona de Risco
```javascript
// Usa Turf.js para cálculo geométrico
const point = turf.point([lng, lat]);
const polygon = turf.polygon(geometry.coordinates);
const isInside = turf.booleanPointInPolygon(point, polygon);
```

### 2. Fluxo do Cidadão
```
1. Cidadão obtém localização (GPS)
   ↓
2. Sistema verifica se está em zona de risco (Turf.js)
   ↓
3. Se SIM → Verifica se já respondeu (Firestore)
   ↓
4. Se NÃO respondeu → Mostra modal
   ↓
5. Cidadão responde → Salva no Firestore
```

### 3. Fluxo do Operador
```
1. Operador abre painel
   ↓
2. Sistema carrega todos os status de cidadãos (Firestore)
   ↓
3. Para cada status → Cria marcador no mapa
   ↓
4. Escuta mudanças em tempo real (onSnapshot)
```

---

## 🎨 Design do Modal

O modal possui:
- **Animação suave** de entrada
- **Ícone pulsante** (⚠️) chamando atenção
- **Descrição da zona** de risco
- **Dois botões grandes**:
  - Verde: "Sim, estou seguro"
  - Vermelho: "Não, preciso de ajuda"
- **Feedback visual** após resposta
- **Responsivo** para mobile

---

## 🔒 Segurança

### Regras do Firestore (IMPORTANTE!)

**Você DEVE adicionar as regras do arquivo `FIRESTORE_RULES_CITIZEN_SAFETY.md` ao seu Firestore!**

Resumo das regras:
- ✅ Cidadãos podem criar/atualizar/deletar apenas SEU PRÓPRIO status
- ✅ Operadores podem VER todos os status
- ✅ Apenas usuários autenticados têm acesso
- ✅ Validação de role (operador vs cidadão)

---

## 🚀 Como Testar

### Teste como Cidadão:
1. Faça login como cidadão
2. Espere o mapa carregar sua localização
3. O operador deve criar uma zona de risco ao seu redor
4. Você verá o modal aparecer automaticamente
5. Escolha "Sim" ou "Não" e veja o feedback

### Teste como Operador:
1. Faça login como operador
2. Crie uma zona de risco no mapa
3. Espere um cidadão entrar na zona
4. Veja o marcador amarelo (⚠️) aparecer
5. Se o cidadão responder "Não", o marcador fica vermelho (🆘)
6. Clique no marcador para ver detalhes
7. Delete a zona e veja todos os marcadores sumirem

---

## 🐛 Solução de Problemas

### Modal não aparece:
- ✅ Verifique se o Turf.js foi carregado (console)
- ✅ Verifique se o cidadão está realmente dentro da zona
- ✅ Verifique permissão de localização do navegador

### Marcadores não aparecem no operador:
- ✅ Verifique se as regras do Firestore foram adicionadas
- ✅ Verifique se o usuário tem role='operador'
- ✅ Verifique console do navegador para erros

### Status não persiste:
- ✅ Verifique se o Firebase está configurado corretamente
- ✅ Verifique se o usuário está autenticado
- ✅ Verifique as regras do Firestore

---

## 📦 Bibliotecas Utilizadas

- **Turf.js v6** - Cálculos geométricos (detecção de ponto em polígono)
- **Leaflet** - Renderização de mapas
- **Firebase Firestore** - Banco de dados em tempo real

---

## ✨ Funcionalidades Futuras (Sugestões)

- [ ] Notificações push para operadores quando alguém pede ajuda
- [ ] Botão para operador "marcar como atendido"
- [ ] Histórico de respostas dos cidadãos
- [ ] Alertas sonoros para operadores
- [ ] Priorização de casos urgentes
- [ ] Chat direto entre operador e cidadão

---

## 👨‍💻 Desenvolvido por

Sistema implementado com foco em:
- ✅ Performance (uso de índices do Firestore)
- ✅ Segurança (regras rigorosas)
- ✅ UX (animações suaves, feedback claro)
- ✅ Tempo real (onSnapshot do Firestore)
- ✅ Persistência (vinculado ao login)
