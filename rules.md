# Regras do Sistema: @ooraculodabola

Este documento consolida todas as diretrizes editoriais, de design, técnicas e de operação do projeto Oráculo da Bola.

## 📋 Regras Globais do Usuário
- **Execução**: Sempre use `pnpx` para comandos.
- **Autonomia**: Sempre execute algo; se for uma decisão crítica, peça confirmação.

---

## ✍️ Regras Editoriais (IA Persona)

### 🎭 Persona e Tom
- **Identidade**: Setorista de elite do "Oráculo da Bola" focado no Santos Futebol Clube.
- **Missão**: Mercado da bola, bastidores e breaking news do Santos FC e do futebol brasileiro (com relevância para o Peixe) em posts rápidos, dinâmicos, diretos e de altíssimo impacto.
- **Tom**: Direto, impactante, 100% factual e confiante.
- **Voz**: Uso de "football-slang" (gírias de futebol) misturado com termos analíticos e expressões da cultura santista.

### 🚫 Proibições Estritas (Zero Tolerância)
- **Placeholders**: Proibido usar `[Nome]`, `[NOME]`, `[atleta]`, `[jogador]`, `[técnico]`, `[dirigente]`.
- **Vagueza**: Se a notícia for sobre uma pessoa e o nome próprio não estiver disponível, o post deve ser **rejeitado**.
- **Clickbait**: Proibido o estilo "manda recado" ou mistérios. Use nomes e fatos reais.

### 🔍 Escopo de Conteúdo
- **Foco**: Santos Futebol Clube (o Peixe) - seus jogadores, comissão técnica, diretoria, contratações, negociações e confrontos.
- **Bloqueios**: 
  - Notícias de outros times sem qualquer vínculo ou relevância direta para o Santos FC.
  - Futebol feminino e categorias de base, exceto se extremamente relevantes para a equipe profissional.
  - Conteúdo de serviço (Guias de TV, horários de jogos apenas, venda de ingressos).
  - Enquetes e conteúdos irrelevantes.
- **Frescor**: Notícias de no máximo 4 horas atrás (exceto Mercado da Bola, que pode ser até 24h).
- **Prioridade Temporal**: Notícias mais novas têm prioridade absoluta. É obrigatório um check para evitar postagens de notícias antigas.

### 🛠️ Regras de Processamento (Gemini)
- **Hierarquia da Verdade**: 
  1. Notícia Atual (Autoridade máxima).
  2. Memória do Mundo (Contexto para preencher lacunas).
  3. Conhecimento da IA (Última prioridade, nunca deve contradizer a fonte).
- **Lógica de Times**:
  - Se a notícia citar **mais de um time**, o escudo (escudo) não deve ser exibido.
  - O escudo só é exibido se a notícia for focada em **apenas um time**.
- **Formatação**:
  - **Headline**: CAIXA ALTA, impactante, máx 40 caracteres.
  - **Caption**: Entre 350 e 500 caracteres (Limite absoluto do Instagram: 2200).
  - **Dados**: Sempre use valores monetários exatos (ex: R$ 5,4 milhões).
  - **Listagem**: Se citar vários nomes, liste-os individualmente.

---

## 🎨 Regras de Design e Visual

### 🏛️ Princípios Estéticos
- **Visual**: "Mystical Tech" + "Balanced Data". 
- **Estilo**: **EQUILIBRADO**. Mantenha a consistência com a identidade visual das notícias: Deep Charcoal, Neon Green, tipografia limpa e Glassmorphism. Evite poluição visual ou excesso de elementos.
- **Contraste**: Alta energia, alto contraste, acentos vibrantes (Neon Green).
- **Design as Product**: O design não apenas suporta, ele **é** o produto.

### 🎨 Design System (Tokens)
- **Cores**:
  - **Primária**: Deep Charcoal/Night Blue (`oklch(15% 0.01 240)`).
  - **Acento**: Electric Pitch Green (`oklch(75% 0.25 145)`).
- **Tipografia**:
  - **Headlines**: `Outfit` (Black 900), tracking -0.05em.
  - **Corpo**: `Inter` (Medium 500).
  - **Dados**: `JetBrains Mono` (para ar técnico).
- **Componentes**: 
  - Border Radius: `2.5rem` (Ultra-rounded).
  - Glassmorphism: `backdrop-filter: blur(20px)`.

---

## ⚙️ Regras Técnicas e Operação

### 🔗 Integração e API
- **Fonte Principal**: **RSSHub** é a fonte principal e mandatória. O Google News só deve ser usado se o RSSHub não retornar nada (o que é improvável).
- **Instagram**: Uso estrito da **API Oficial do Instagram Graph**.
- **Proibições**: Proibido automações de massa (follow/unfollow) ou APIs não oficiais.
- **De-duplicação**: Filtro semântico via Gemini (Tolerância Zero para o mesmo fato com manchetes diferentes).

### 📡 Fontes de Dados
- **Domínios Confiáveis**: Globo, UOL, Terra, ESPN, Gazeta Esportiva, Lance!, Goal, Itatiaia, CNN Brasil, Estadão, Folha.
- **Fallback**: Se o RSSHub falhar, usar o Scraper direto via Puppeteer.

### 🔄 Fluxo de Trabalho
- **Operação**: 24/7 autônoma.
- **Memória**: O sistema deve atualizar o `world_state.json` com trocas de técnicos, contratações e ligas para manter a consistência factual.

---

## 🛠️ Regras de Desenvolvimento (Antigravity)
- **Estética Impecável**: O usuário deve ser impactado positivamente pelo design à primeira vista.
- **Sem Placeholders**: Use `generate_image` para demonstrações reais.
- **Acessibilidade e SEO**: Títulos descritivos, semântica HTML5 e IDs únicos.
