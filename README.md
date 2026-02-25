# 🚨 UniFacens SOS

Aplicação web desenvolvida para atendimento rápido de ocorrências institucionais por meio de dois canais principais:

- 📞 Canal direto de ligações para setores específicos  
- 💬 Canal de envio de mensagem com localização via WhatsApp  

O sistema direciona automaticamente o atendimento conforme a categoria da ocorrência selecionada pelo usuário.

Desenvolvido com foco em:

- Simplicidade operacional  
- Alta confiabilidade em situações críticas  
- Compatibilidade com GitHub Pages  
- Arquitetura modular e escalável  

---

## 🎯 Objetivo

Permitir que usuários realizem chamados emergenciais de forma estruturada, rápida e direcionada.

Dependendo da categoria selecionada, o sistema pode:

- Realizar ligação direta para o setor responsável
- Gerar mensagem estruturada via WhatsApp
- Incluir link dinâmico de localização
- Melhorar automaticamente a precisão do GPS antes do envio

O app foi projetado para funcionar de forma leve, sem necessidade de backend.

---

## 🧭 Funcionalidades Principais

### 📞 Canal de Ligações

Na página `call.html`, o usuário pode realizar ligações diretas para setores específicos da instituição.

### 💬 Canal de Mensagem com Localização

Na página `message.html`, o usuário seleciona a categoria de emergência e o sistema:

1. Solicita permissão de localização
2. Tenta obter coordenadas válidas
3. Melhora progressivamente a precisão do GPS
4. Gera link interno para visualização do mapa
5. Redireciona para o WhatsApp com mensagem estruturada ou permite envio manual caso necessário

### 🗺️ Visualização de Mapa

A página `map.html` recebe latitude e longitude via query string e renderiza o mapa em visão de satélite com o Google Maps incorporado.

---

## 📱 Aplicação Web (PWA)

O UniFacens SOS funciona como aplicativo instalável (PWA), com abertura em modo standalone quando suportado e cache do app shell para carregamento rápido.

### 🔄 Atualização em cache

Quando `service-worker.js` muda (ex.: nova `CACHE_VERSION`), o navegador instala a nova versão, remove o cache antigo no `activate` e recarrega o app ao assumir o novo Service Worker.

### 📶 Funcionamento offline

O canal de ligações continua funcional via `tel:`. O canal de mensagens depende de internet (WhatsApp + envio de localização) e, sem conexão, o app orienta o usuário a usar ligação.

### 📲 Instalação

#### Android (Google Chrome)

1. Abra o app no Chrome.
2. Menu ( ⋮ ).
3. **Adicionar à tela inicial**.
4. Toque em **Instalar** para confirmar.

#### iOS (Safari)

1. Abra o app no Safari.
2. Toque no botão de menu **Compartilhar** (ícone de quadrado com seta para cima, na barra inferior/superior).
3. No menu de compartilhamento, toque em **Adicionar à Tela de Início**.
4. Toque em **Adicionar** para confirmar.

---

## 🧱 Arquitetura do Projeto

Estrutura organizada em módulos HTML, CSS e JavaScript:

```
unifacens-sos/
│
├── index.html           # Ponto de entrada da aplicação
├── manifest.json        # Manifesto PWA (instalação do app)
├── service-worker.js    # Service Worker (offline e atualizações)
│
├── pages/               # Páginas funcionais do app
│   │
│   ├── home.html        # Tela inicial
│   ├── call.html        # Canal de ligações por setor
│   ├── message.html     # Envio de mensagem com localização
│   └── map.html         # Visualização da localização no mapa
│
├── styles/              # Arquivos de estilo
│   │
│   ├── app.css          # Inicializador de estilos
│   ├── global.css       # Estilos globais
│   ├── utils.css        # Classes utilitárias
│   ├── home.css         # Estilos da home
│   ├── call.css         # Estilos da página de ligações
│   ├── message.css      # Estilos da página de mensagens
│   └── map.css          # Estilos da página de mapa
│
├── scripts/             # Módulos JavaScript
│   │
│   ├── app.js           # Inicializador de scripts
│   ├── utils.js         # Funções utilitárias globais
│   ├── home.js          # Lógica da home
│   ├── call.js          # Lógica do canal de ligações
│   ├── message.js       # Lógica de localização e envio WhatsApp
│   └── map.js           # Renderização do Google Maps
│
├── assets/              # Recursos estáticos
│   │
│   ├── images/          # Imagens do projeto
│   └── icons/           # Ícones do PWA
│
├── README.md            # Documentação do projeto
└── LICENSE.md           # Licença institucional
```

---

## 🔁 Sistema Modular

O projeto utiliza arquitetura modular baseada em ES Modules.

### Inicialização HTML

`index.html` atua como ponto de entrada do aplicativo.

### Inicialização CSS

`app.css` é responsável por carregar os estilos base e organizar os módulos de estilo.

### Inicialização JavaScript

`app.js` identifica a página ativa e importa dinamicamente o módulo correspondente:

```javascript
const routes = {
  'home.html': () => import('./home.js'),
  'call.html': () => import('./call.js'),
  'message.html': () => import('./message.js'),
  'map.html': () => import('./map.js'),
};
```

Cada módulo exporta:

```javascript
export function init() {}
```

Esse padrão garante:

- Separação de responsabilidades
- Melhor manutenção
- Escalabilidade futura
- Organização clara por página

---

## 📍 Fluxo de Localização

### Processo Automatizado

- Solicita permissão do navegador
- Aguarda coordenadas válidas
- Confirma a localização
- Inicia melhoria progressiva de precisão
- Meta inicial: 15 metros
- Relaxamento da meta: +10m a cada 2s
- Tentativa máxima de melhoria: 10 segundos
- Envio automático ao atingir meta
- Permite envio manual caso necessário

### Regras Técnicas

- Nunca piora a precisão (usa sempre a melhor leitura)
- Se não houver coordenadas válidas, envia como "Não disponível."
- Compatível com GitHub Pages (ajuste automático do path do projeto)
- Requer HTTPS para funcionamento da Geolocation API

---

## 💬 Estrutura da Mensagem Enviada

```
PEDIDO DE AJUDA

Tipo: [Categoria da Ocorrência]

Precisão: 12 metros

Localização: https://...
```

---

## ⚙️ Tecnologias Utilizadas

- HTML
- CSS
- JavaScript
- WhatsApp Web API
- Google Maps Embed
- GitHub Pages

---

## 🔐 Considerações Técnicas

- A Geolocation API exige HTTPS
- O comportamento de popups pode variar conforme navegador
- A precisão do GPS pode variar conforme ambiente
- Compatível com dispositivos móveis e desktop

---

## 🧠 Possíveis Evoluções

- Registro de logs
- Dashboard administrativo
- Integração com sistemas internos

---

## 📄 Licença

Este projeto é de titularidade exclusiva da UniFacens e encontra-se protegido por direitos autorais.

Os termos completos de uso, restrições e disposições legais estão descritos no arquivo:

[LICENSE](./LICENSE.md)

```
Copyright © 2026 UniFacens

Todos os direitos reservados.
```
