# Regras de Segurança do Firebase Firestore

## Como Aplicar as Regras

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Selecione seu projeto: **alerta-comunitario-9b024**
3. Vá para **Firestore Database**
4. Clique na aba **Rules**
5. Copie e cole as regras abaixo
6. Clique em **Publish**

---

## Regras de Segurança Completas

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ===== REGRAS GERAIS =====

    // Função auxiliar para verificar se é cidadão
    function isCitizen() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'cidadao';
    }

    // Função auxiliar para verificar se é operador
    function isOperator() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'operador';
    }

    // ===== COLEÇÃO: users =====

    match /users/{userId} {
      // Ler: Cada usuário pode ler seu próprio perfil e operadores podem ler todos
      allow read: if request.auth.uid == userId || isOperator();

      // Criar: Qualquer usuário autenticado pode criar seu próprio perfil
      allow create: if request.auth.uid == userId &&
                       request.resource.data.uid == userId &&
                       request.resource.data.role in ['cidadao', 'operador'];

      // Atualizar: Usuário pode atualizar seu próprio perfil
      allow update: if request.auth.uid == userId &&
                       request.resource.data.uid == userId;

      // Deletar: Não permitir
      allow delete: if false;
    }

    // ===== COLEÇÃO: reports =====

    match /reports/{reportId} {
      // Ler: Todos os usuários autenticados podem ler todos os reports
      allow read: if request.auth != null;

      // Criar: Apenas cidadãos podem criar reports e devem usar seu próprio userId
      allow create: if request.auth != null &&
                       isCitizen() &&
                       request.resource.data.userId == request.auth.uid &&
                       request.resource.data.status == 'aberto' &&
                       request.resource.data.createdAt == request.time;

      // Atualizar:
      //   - Cidadãos podem atualizar apenas seus próprios reports (status não pode ir para 'resolvido')
      //   - Operadores podem atualizar qualquer report
      allow update: if request.auth != null && (
                       (isCitizen() && resource.data.userId == request.auth.uid &&
                        request.resource.data.status != 'resolvido') ||
                       isOperator()
                    );

      // Deletar: Apenas operadores podem deletar reports (ao finalizar)
      allow delete: if request.auth != null && isOperator();
    }

    // ===== COLEÇÃO: alerts (Zonas de Risco) =====

    match /alerts/{alertId} {
      // Ler: Todos os usuários autenticados podem ler
      allow read: if request.auth != null;

      // Criar: Apenas operadores podem criar zonas de risco
      allow create: if request.auth != null &&
                       isOperator() &&
                       request.resource.data.createdBy == request.auth.uid &&
                       request.resource.data.createdAt == request.time;

      // Atualizar: Apenas operadores que criaram podem atualizar
      allow update: if request.auth != null &&
                       isOperator() &&
                       resource.data.createdBy == request.auth.uid;

      // Deletar: Apenas operadores que criaram podem deletar
      allow delete: if request.auth != null &&
                       isOperator() &&
                       resource.data.createdBy == request.auth.uid;
    }

    // ===== DENY POR PADRÃO =====

    // Negar acesso padrão
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## Resumo das Regras

### Coleção `users`
- ✅ Cidadãos podem ler seu próprio perfil
- ✅ Operadores podem ler todos os perfis
- ✅ Usuários podem criar seu próprio perfil
- ✅ Usuários podem atualizar seu próprio perfil
- ❌ Ninguém pode deletar perfil

### Coleção `reports`
- ✅ Todos os usuários autenticados podem ler reports
- ✅ Apenas cidadãos podem criar reports (próprios reports)
- ✅ Cidadãos podem atualizar seus reports (menos o status final 'resolvido')
- ✅ Operadores podem atualizar qualquer report
- ✅ Apenas operadores podem deletar reports (ao finalizar)

### Coleção `alerts` (Zonas de Risco)
- ✅ Todos os usuários autenticados podem ler zonas
- ✅ Apenas operadores podem criar zonas
- ✅ Operadores podem atualizar suas próprias zonas
- ✅ Operadores podem deletar suas próprias zonas

---

## Alterações Importantes

1. **Estrutura de Reports**: Cada report agora pertence a um único cidadão (campo `userId` direto), sem agrupamento automático

2. **Validação de Relatório Ativo**: A verificação de report ativo é feita no código do cliente (client-side) antes de criar um novo report

3. **Deleção ao Finalizar**: Quando operador clica em "Finalizar", o report é deletado (não apenas marcado como resolvido)

4. **Proteção de Dados**: Cidadãos não podem modificar o status para "resolvido" - apenas operadores podem deletar

5. **Auditoria**: Reports mantêm campos `updatedAt` e `updatedBy` para rastrear quem fez as alterações

6. **Clustering Visual**: O operador visualiza clustering automático baseado em zoom (Leaflet MarkerCluster), mas cada report permanece separado no banco de dados

7. **Seleção Múltipla**: Operadores podem selecionar múltiplos reports (Ctrl+Click) e atualizar status em lote

---

## Testes Recomendados

Após aplicar as regras, teste:

1. **Cidadão cria report**: Deve funcionar
2. **Cidadão tenta criar outro report**: Deve bloquear
3. **Operador finaliza report**: Report deve ser deletado do Firestore
4. **Verificar mapa**: Report deve desaparecer tanto para cidadão quanto para operador
5. **Cidadão tenta modificar status do próprio report**: Deve bloquear

---

## Notas Importantes

⚠️ **As regras acima pressupõem que a validação no lado do cliente já foi implementada** (verificação de report ativo antes de criar novo).

Se precisar ser ainda mais restritivo, você pode adicionar limites de taxa (rate limiting) nas regras avançadas do Firebase.
