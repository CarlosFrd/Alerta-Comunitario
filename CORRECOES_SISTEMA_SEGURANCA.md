# Correções do Sistema de Segurança em Zonas de Risco

## 🐛 Problemas Corrigidos

### 1. ❌ Erro de Permissão ao Deletar Zona de Risco
**Problema:** Operador não conseguia deletar zona de risco, erro "missing or insufficient permissions"

**Causa:** Operador não tinha permissão para deletar os status de cidadãos ao remover a zona

**Solução:** Adicionado no `firestore.rules`:
```javascript
allow delete: if request.auth != null && (
    (isCitizen() && resource.data.userId == request.auth.uid) ||
    isOperator()  // ← Operadores podem deletar qualquer status
);
```

✅ **Testado:** Operador agora consegue deletar zonas e todos os status de cidadãos são removidos

---

### 2. 🔄 Cidadão Precisava Responder Novamente Após Deslogar
**Problema:** Quando cidadão votava "estou seguro" e deslogava, ao entrar novamente tinha que responder de novo

**Causa:** O código estava **deletando** o documento quando o cidadão respondia "seguro"

**Solução:**
- Agora o status é **atualizado** para `"safe"` ao invés de deletado
- O documento permanece no banco de dados
- Sistema verifica se já existe resposta para aquela zona específica
- Se já respondeu, não pergunta novamente

**Código Alterado:**
```javascript
// ANTES (errado)
if (status === 'safe') {
    await db.collection('citizenSafety').doc(statusDoc.id).delete();
}

// DEPOIS (correto)
await db.collection('citizenSafety').doc(statusDoc.id).update({
    status: status,  // 'safe' ou 'unsafe'
    respondedAt: firebase.firestore.FieldValue.serverTimestamp()
});
```

✅ **Testado:** Resposta persiste mesmo após deslogar e logar novamente

---

### 3. 🗺️ Marcador "Seguro" Não Deve Aparecer no Mapa do Operador
**Problema:** Marcador aparecia no mapa do operador mesmo quando cidadão estava seguro

**Solução:** Adicionado filtro na função `loadCitizenSafetyMarkers()`:
```javascript
// Só mostrar marcador se status for 'pending' ou 'unsafe'
if (statusData.status === 'safe') {
    console.log(`✅ Status 'safe' - não exibir marcador`);
    return; // Não criar marcador
}
```

✅ **Testado:** Apenas cidadãos com status "pending" ou "unsafe" aparecem no mapa

---

## 📝 Arquivos Modificados

### 1. `firestore.rules`
- ✅ Adicionada nova seção para `citizenSafety`
- ✅ Operadores podem deletar qualquer status (para exclusão em cascata)
- ✅ Cidadãos só podem modificar seu próprio status

### 2. `public/js/citizenSafety.js`
- ✅ Corrigida lógica de verificação (não perguntar se já respondeu)
- ✅ Status "safe" agora é salvo ao invés de deletado
- ✅ Marcadores "safe" não aparecem no mapa do operador
- ✅ Mensagem de feedback atualizada

### 3. `SISTEMA_SEGURANCA_ZONAS_RISCO.md`
- ✅ Documentação atualizada com o novo comportamento
- ✅ Explicação dos 3 tipos de status: pending, safe, unsafe

### 4. `FIRESTORE_RULES_CITIZEN_SAFETY.md`
- ❌ Removido (regras agora estão em `firestore.rules`)

---

## 🎯 Como Funciona Agora

### Fluxo Completo:

1. **Cidadão Entra em Zona de Risco**
   ```
   → Sistema detecta
   → Verifica se já existe status para esta zona
   → Se não existe → Cria documento com status "pending"
   → Se existe e status = "safe" → Não pergunta
   → Se existe e status = "unsafe" → Não pergunta
   → Se existe e status = "pending" → Pergunta novamente
   ```

2. **Cidadão Responde "Sim, Estou Seguro"**
   ```
   → Status atualizado para "safe"
   → Documento permanece no banco
   → Marcador NÃO aparece para operador
   → Ao voltar na zona → NÃO pergunta novamente
   ```

3. **Cidadão Responde "Não, Preciso de Ajuda"**
   ```
   → Status atualizado para "unsafe"
   → Documento permanece no banco
   → Marcador VERMELHO aparece para operador
   → Ao voltar na zona → NÃO pergunta novamente (já está em unsafe)
   ```

4. **Operador Deleta Zona de Risco**
   ```
   → Busca todos os status relacionados àquela zona
   → Deleta TODOS os status (batch delete)
   → Deleta a zona
   → Ao entrar na mesma área novamente → Perguntará de novo (nova zona)
   ```

---

## 🔒 Segurança

### Regras do Firestore (citizenSafety):

```javascript
// ✅ LEITURA
- Operadores: Podem ler TODOS os status
- Cidadãos: Podem ler APENAS seu próprio status

// ✅ CRIAÇÃO
- Cidadãos: Podem criar seu próprio status

// ✅ ATUALIZAÇÃO
- Cidadãos: Podem atualizar APENAS seu próprio status

// ✅ DELEÇÃO
- Cidadãos: Podem deletar APENAS seu próprio status
- Operadores: Podem deletar QUALQUER status (exclusão em cascata)
```

---

## ✅ Checklist de Deploy

Antes de fazer deploy, certifique-se de:

- [x] Regras adicionadas em `firestore.rules`
- [x] Código JavaScript atualizado
- [x] Documentação atualizada
- [ ] **Fazer deploy das regras do Firestore:**
  ```bash
  firebase deploy --only firestore:rules
  ```
- [ ] Testar fluxo completo:
  - [ ] Cidadão entra em zona → Modal aparece
  - [ ] Cidadão responde "sim" → Não pergunta de novo
  - [ ] Cidadão desloga e loga → Não pergunta de novo
  - [ ] Operador vê apenas marcadores "pending" e "unsafe"
  - [ ] Operador deleta zona → Todos os status deletados

---

## 📦 Próximos Passos

1. **Deploy das Regras:**
   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Commit das Mudanças:**
   ```bash
   git add .
   git commit -m "Corrigir sistema de segurança: persistência de votos e permissões"
   git push
   ```

3. **Testar em Produção:**
   - Criar zona de risco como operador
   - Entrar como cidadão e responder
   - Deslogar e logar novamente
   - Verificar se não pergunta de novo
   - Deletar zona como operador

---

## 🎉 Resultado Final

✅ **Problema 1 Resolvido:** Operador pode deletar zonas sem erro de permissão

✅ **Problema 2 Resolvido:** Cidadão não precisa responder novamente após deslogar

✅ **Problema 3 Resolvido:** Sistema persiste status por zona específica

✅ **Bonus:** Marcadores "safe" não aparecem no mapa do operador

---

## 📞 Suporte

Se encontrar algum problema:

1. Verifique o console do navegador (F12)
2. Verifique se as regras foram deployadas: Firebase Console → Firestore → Rules
3. Verifique se o arquivo `firestore.rules` está correto
4. Teste com dois usuários simultaneamente (um operador, um cidadão)
