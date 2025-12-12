# 🚨 Sistema de Alerta Comunitário

<div align="center">

**Plataforma de monitoramento e resposta rápida a emergências urbanas**

[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

</div>

---

## 📋 Sobre o Projeto

O **Sistema de Alerta Comunitário** é uma aplicação web em tempo real que conecta cidadãos e operadores públicos para gerenciar situações de emergência urbana. A plataforma permite que cidadãos reportem incidentes, visualizem zonas de risco ativas e respondam a alertas de segurança, enquanto operadores monitoram, validam e coordenam as respostas.

### 🎯 Principais Funcionalidades

#### Para Cidadãos
- 📍 **Relatos Georreferenciados**: Envie relatos de emergências com localização automática
- 🗺️ **Visualização em Tempo Real**: Veja ocorrências e zonas de risco no mapa interativo
- ⚠️ **Alertas de Segurança**: Receba notificações quando entrar em zonas de risco
- 🆘 **Sistema "Estou Seguro?"**: Responda a verificações de segurança em áreas críticas
- 🔒 **Limite de Relatos Ativos**: Apenas um relato ativo por vez para evitar spam

#### Para Operadores
- 👥 **Painel de Monitoramento**: Visualize todos os relatos e cidadãos em tempo real
- 🎨 **Criação de Zonas de Risco**: Desenhe áreas de perigo no mapa
- 📊 **Gestão de Ocorrências**: Altere status dos relatos (aberto → confirmado → atendimento → resolvido)
- 🚨 **Monitoramento de Cidadãos**: Veja quem está em zonas de risco e quem precisa de ajuda
- 📍 **Geolocalização de Vítimas**: Identifique cidadãos que solicitaram ajuda

---

## 🛠️ Tecnologias Utilizadas

### Frontend
- **HTML5/CSS3**: Interface responsiva e moderna
- **JavaScript ES6+**: Lógica da aplicação
- **Leaflet.js**: Mapas interativos e geolocalização
- **Turf.js**: Análise geoespacial (verificação de pontos em polígonos)
- **Leaflet.draw**: Ferramentas de desenho para zonas de risco

### Backend
- **Firebase Authentication**: Sistema de autenticação seguro
- **Cloud Firestore**: Banco de dados NoSQL em tempo real
- **Firebase Hosting**: Hospedagem da aplicação

### APIs
- **OpenStreetMap**: Camadas de mapas
- **Geolocation API**: Localização do usuário

---

## 📁 Estrutura do Projeto

```
projeto/
├── public/
│   ├── index.html              # Página principal (cidadão)
│   ├── operador.html           # Painel do operador
│   ├── css/
│   │   ├── styles.css          # Estilos principais
│   │   └── operator.css        # Estilos do painel do operador
│   └── js/
│       ├── config.js           # Configuração do Firebase (não versionado)
│       ├── auth.js             # Autenticação e controle de acesso
│       ├── citizen.js          # Funcionalidades do cidadão
│       ├── citizenSafety.js    # Sistema "Estou Seguro?"
│       ├── operator.js         # Funcionalidades do operador
│       ├── riskZones.js        # Gestão de zonas de risco
│       ├── main.js             # Event listeners e inicialização
│       └── ui.js               # Funções de interface
├── .firebaserc                 # Configuração do Firebase
├── firebase.json               # Regras de deploy
├── firestore.rules             # Regras de segurança do Firestore
└── README.md                   # Este arquivo
```

---

## 🚀 Como Instalar e Executar

### Pré-requisitos

- Node.js (v14 ou superior)
- npm ou yarn
- Conta no Firebase
- Navegador moderno com suporte a geolocalização

### 1. Clone o Repositório

```bash
git clone https://github.com/seu-usuario/sistema-alerta-comunitario.git
cd sistema-alerta-comunitario
```

### 2. Instale as Dependências

```bash
npm install -g firebase-tools
```

### 3. Configure o Firebase

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Crie um novo projeto
3. Ative **Authentication** (Email/Password)
4. Ative **Cloud Firestore**
5. Copie as credenciais do Firebase

### 4. Configure as Credenciais

Crie o arquivo `public/js/config.js`:

```javascript
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJECT_ID.firebaseapp.com",
    projectId: "SEU_PROJECT_ID",
    storageBucket: "SEU_PROJECT_ID.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
```

### 5. Configure as Regras do Firestore

Deploy as regras de segurança:

```bash
firebase deploy --only firestore:rules
```

### 6. Execute Localmente

```bash
firebase serve
```

Acesse: `http://localhost:5000`

### 7. Deploy para Produção

```bash
firebase deploy
```

---

## 👥 Como Usar

### Criando uma Conta de Cidadão

1. Acesse a aplicação
2. Clique em **"Registrar"**
3. Preencha: Nome, CPF, Email, Senha
4. Selecione **"Cidadão"** como tipo de conta
5. Clique em **"Criar Conta"**

### Criando uma Conta de Operador

1. Siga os mesmos passos acima
2. Selecione **"Operador"** como tipo de conta
3. Após criar, você terá acesso ao painel de operador

### Enviando um Relato (Cidadão)

1. Faça login como cidadão
2. Permita o acesso à localização quando solicitado
3. Clique no botão **+** (FAB) no canto inferior direito
4. Selecione o tipo de ocorrência
5. Descreva o problema
6. Clique em **"Confirmar e Enviar"**

### Gerenciando Relatos (Operador)

1. Faça login como operador
2. Acesse `operador.html`
3. Visualize todos os relatos no mapa e na lista lateral
4. Clique em um relato para ver detalhes
5. Altere o status conforme o atendimento progride
6. Exclua relatos finalizados

### Criando Zonas de Risco (Operador)

1. No painel do operador, use as ferramentas de desenho (canto superior direito)
2. Escolha **Polígono** ou **Retângulo**
3. Desenhe a área de risco no mapa
4. Digite a mensagem de alerta
5. A zona será visível para todos os cidadãos em tempo real

---

## 🔐 Validação de CPF

O sistema implementa validação de CPF usando o **algoritmo oficial da Receita Federal**:

- ✅ Verifica se tem 11 dígitos
- ✅ Valida os dígitos verificadores
- ✅ Rejeita CPFs com todos os dígitos iguais
- ✅ Formatação automática (000.000.000-00)

> **Nota**: A validação é matemática. Para ambientes de produção, recomenda-se integrar com APIs oficiais de validação de CPF.

---

## 🗺️ Sistema de Zonas de Risco

### Como Funciona

1. **Operador cria zona**: Desenha polígono/retângulo no mapa
2. **Sistema monitora cidadãos**: Verifica em tempo real se cidadãos entram na zona
3. **Alerta automático**: Quando detectado, mostra pergunta "Você está seguro?"
4. **Resposta do cidadão**:
   - ✅ **"Sim, estou seguro"**: Status registrado, não pergunta novamente
   - 🆘 **"Não, preciso de ajuda"**: Marcador vermelho aparece para operadores
5. **Monitoramento contínuo**: Operadores veem quem precisa de ajuda em tempo real

---

## 📊 Tipos de Ocorrências

| Tipo | Ícone | Descrição |
|------|-------|-----------|
| Alagamento | 🌊 | Inundações, enchentes |
| Deslizamento | ⛰️ | Deslizamento de terra |
| Incêndio | 🔥 | Incêndios urbanos ou florestais |
| Acidente | 🚗 | Acidentes de trânsito |
| Outro | ❓ | Outras emergências |

---

## 🎨 Status dos Relatos

| Status | Cor | Descrição |
|--------|-----|-----------|
| Aberto | 🟡 Amarelo | Relato recém-criado |
| Confirmado | 🔴 Vermelho | Operador confirmou a ocorrência |
| Em Atendimento | 🟠 Laranja | Equipes em campo |
| Resolvido | 🟢 Verde | Situação normalizada |

---

## 🔒 Segurança

### Autenticação
- Sistema de login com Firebase Authentication
- Validação de roles (cidadão/operador)
- Proteção de rotas por nível de acesso

### Firestore Rules
```javascript
// Apenas usuários autenticados
match /reports/{reportId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if isOperator();
  allow delete: if isOperator();
}

// Apenas operadores podem criar zonas
match /alerts/{alertId} {
  allow read: if request.auth != null;
  allow write: if isOperator();
}
```

### Validação de Dados
- CPF validado com algoritmo oficial
- Limite de um relato ativo por cidadão
- Validação de campos obrigatórios

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Para contribuir:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

---

## 📝 Roadmap

- [ ] Upload de fotos nos relatos
- [ ] Notificações push para cidadãos
- [ ] Dashboard com estatísticas
- [ ] Exportação de relatórios em PDF
- [ ] Integração com API oficial de validação de CPF
- [ ] Sistema de chat entre operadores e cidadãos
- [ ] Aplicativo mobile (React Native/Flutter)
- [ ] Integração com sistemas de emergência (SAMU, Bombeiros)

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

---

## 👨‍💻 Autores

Desenvolvido com ❤️ para ajudar comunidades a se manterem seguras.

---

## 📞 Suporte

Para dúvidas ou sugestões, abra uma [issue](https://github.com/seu-usuario/sistema-alerta-comunitario/issues).

---

<div align="center">

**⭐ Se este projeto foi útil, considere dar uma estrela!**

</div>
