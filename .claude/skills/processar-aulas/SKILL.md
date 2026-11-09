---
name: processar-aulas
description: Baixa as fotos novas da lousa, os avisos e os arquivos do Discord e transforma tudo em conteúdo de estudo no site (transcrição, resumo, explicações pesquisadas, flashcards, mini provas, mapa mental, calendário e recomendações). Use quando pedirem para processar as aulas, atualizar o site ou rodar /processar-aulas.
---

# Processar aulas

Você transforma o que a turma posta no Discord em material de estudo para o site em `site/`.
O site só lê os JSON de `site/data/`. O formato deles está descrito em `CLAUDE.md`.

## 1. Baixar o que é novo

Rode `python bot/baixar.py`. Se faltar `.env` ou `bot/config.json`, avise o usuário,
aponte a seção de configuração do `README.md` e continue com o que já estiver em `dados/`.

Pendências:
- `dados/fotos.json`: itens com `"processada": false`
- `dados/mensagens.json`: textos dos canais gerais (avisos, guias de estudo), `"processado": false`
- `dados/anexos.json`: arquivos e imagens dos canais gerais, `"processado": false`

**Comece pelas mensagens e anexos** (passos 5 e 6): os guias de estudo dizem o que cada matéria
cobre e ajudam a descobrir de qual matéria é cada foto.

Se não houver nada pendente, diga isso e pare.

**Conteúdo de exemplo:** no primeiro processamento real, apague tudo que tiver `"exemplo": true`
(aulas, flashcards e questões ligados a elas, avisos e recomendações) e os nós do mapa ligados a essas aulas.

## 2. Aulas (uma matéria e uma data por vez)

Fotos com `"materia": null` vêm de um canal com fotos misturadas: olhe cada uma e decida a matéria
(`logica`, `calculo1`, `algebra`, `engsoft`) pelo conteúdo, pelo texto da mensagem e pelos guias de
estudo. Grave a matéria no item de `dados/fotos.json`. Se não der para saber, deixe pendente e
liste para o usuário. Fotos que não são de lousa (memes, prints aleatórios) recebem
`"ignorada": true` e `"processada": true`.

Agrupe as fotos pendentes por `materia` + `data`. Cada grupo é **uma aula**, com `id` = data
(`2026-03-10`). Se já existir uma aula com esse id, junte as fotos novas a ela.
Fotos da mesma lousa tiradas por colegas diferentes são normais: use todas para ler melhor,
mas não duplique conteúdo. Processe no máximo umas 15 fotos por rodada, para não estourar o limite de uso,
e diga quantas ficaram para a próxima.

Para cada aula:

1. **Leia todas as fotos** com a ferramenta Read (o caminho é `site/` + o `arquivo` da foto).
   Considere também o `texto` que o colega escreveu junto da foto.
2. **`transcricao`**: copie fielmente o que está na lousa, em Markdown. Use fórmulas em LaTeX
   (`$x^2$`, `$$\int_0^1 f(x)\,dx$$`), blocos de código para pseudocódigo e tabelas quando houver.
   Marque trechos ilegíveis com `[ilegível]`. **Não invente nada que não esteja na foto.**
3. **`titulo`** curto e **`topicos`** (3 a 6, em minúsculas).
4. **`resumo`**: o essencial da aula em 5 a 10 linhas, para quem faltou.
5. **Pesquise** (WebSearch / WebFetch) cada tópico para escrever o **`aprofundamento`**: explicação
   clara e didática, pelo menos um exemplo resolvido passo a passo, erros comuns e como isso costuma
   cair em prova. Siga a notação e a abordagem do professor. Se alguma fonte contradisser a lousa,
   avise com cuidado em vez de "corrigir" o professor.
6. **`referencias`**: 2 a 4 links gratuitos, **sempre em português e de preferência de professores
   e instituições brasileiras**. Fontes boas para começar a busca: Curso em Vídeo (Gustavo Guanabara),
   UNIVESP, Khan Academy em português, Equaciona Matemática, Professor Ferretto, Me Salva!,
   livros abertos do REAMAT/UFRGS e do Portal de Livros Abertos da USP, apostilas de universidades
   federais. Material em inglês só se não houver nada bom em português, e avise na `descricao`.
   Só inclua links que você abriu e confirmou que funcionam.
   `tipo`: `video` | `artigo` | `livro` | `exercicios` | `site`. `descricao`: só o nome do professor
   ou da instituição.
7. **`fotos`**: caminhos relativos a `site/` (`fotos/calculo1/2026-03-10/123-0.jpg`).

## 3. Flashcards e questões

Para cada aula nova:
- **8 a 15 flashcards**, com `id` `<aula>-f<n>`, uma ideia por card, frente curta.
- **8 a 12 questões**, com `id` `<aula>-q<n>`, misturando:
  - `multipla`: 4 alternativas plausíveis, `correta` = índice (0 a 3), sem "todas as anteriores";
  - `vf`: `correta` é `true` ou `false`;
  - `aberta`: com `resposta` modelo. Em Cálculo e Álgebra, use para contas; em Lógica, para algoritmos.
  - Sempre com `explicacao`, `topico` e `dificuldade` (1 a 3).
- Confira cada resposta com cuidado, principalmente contas. Resolva você mesmo antes de gravar.

## 4. Mapa mental

Atualize o `mapa` da matéria: a raiz é a matéria, o nível 1 são as grandes unidades e, abaixo delas,
os conceitos. Ponha `"aula": "<id>"` nos nós que têm uma aula correspondente.
Reorganize o mapa quando o conteúdo crescer: ele é o mapa da matéria inteira, não um diário de aulas.

## 5. Mensagens: guias de estudo, avisos e calendário

Leia as mensagens pendentes de `dados/mensagens.json`.
- **Guias de estudo** (lista de conteúdos de uma matéria, o que cai na prova): use para entender a
  ementa, organizar o mapa mental e priorizar as recomendações. Se o guia tiver conteúdo útil para
  a turma, registre-o também em `geral.json > arquivos` como `tipo: "lista"` com um resumo curto.
- **Avisos**: datas de prova, trabalho, lista.

Fique atento também a avisos escritos nas lousas ("P1 dia 12/05", "entregar lista 3"). Para cada prova, trabalho, atividade ou lista com data,
crie ou atualize um item em `geral.json > avisos`:
`{id, tipo, materia, titulo, data, hora?, descricao?}`. `tipo`: `prova` | `trabalho` | `atividade` |
`exercicio` | `aviso`. Datas sem ano são do ano letivo atual. Se a data for ambígua, não invente:
liste para o usuário confirmar. Se um aviso adiar algo que já existe, atualize em vez de duplicar.

## 6. Arquivos

Anexos que são imagens (ex.: foto de um guia ou cronograma) leia como mensagens (passo 5) e só
registre como arquivo se fizer sentido baixar. Para os demais anexos pendentes, crie um item em `geral.json > arquivos`:
`{id, titulo, materia, tipo, arquivo, descricao, adicionado_em}`. Descubra a matéria e o tipo pelo
nome, pelo texto da mensagem e pelo conteúdo (abra PDFs e slides com Read).
Use os slides do professor como fonte extra nos aprofundamentos e nas questões da matéria.
Se o arquivo parecer um livro protegido por direitos autorais, avise o usuário: o site é público.

## 7. Recomendações

Reescreva `geral.json > recomendacoes` (3 a 6 itens) pensando na semana: o que estudar primeiro,
de acordo com as provas e entregas próximas e com os assuntos mais difíceis.
Cada item: `{materia, prioridade: alta|media|baixa, titulo, texto, link}`, com `link` para a aula
(`#/materia/<id>/aula/<aula>`) ou para a aba (`#/materia/<id>/provas`).

## 8. Fechar

1. Marque as fotos, anexos e avisos usados como `processada`/`processado: true`.
   **Privacidade:** fotos com rosto visível de professor ou colegas, ou com nomes de alunos, não
   entram em `fotos` da aula. Mova esses arquivos de `site/fotos/` para `dados/privado/` (a pasta
   `site/` inteira é publicada, mesmo o que não aparece nas páginas).
2. Atualize `geral.json > atualizado_em` com a data de hoje.
3. Rode `python scripts/validar.py` e corrija tudo o que ele apontar.
4. Mostre um resumo: aulas novas por matéria, provas e entregas encontradas, o que ficou pendente
   e qualquer dúvida (data ambígua, foto ilegível).
5. Pergunte antes de **publicar** (`git add`, `commit`, `push`) e antes de **avisar a turma**
   (`python bot/avisar.py "..."`). Não faça nenhum dos dois sem um sim.

## Regras de escrita

- Português do Brasil, tom de colega que explica bem. Nada de enrolação.
- **Curto.** O site é visual: resumo em tópicos, recomendações com uma frase, descrições com
  poucas palavras. Texto longo só no `aprofundamento`, e mesmo lá use subtítulos e listas.
- Siga a notação usada no Brasil (vírgula decimal, "sen" e "tg", Portugol/VisuAlg em Lógica
  quando o professor usar).
- Nunca misture o que estava na lousa (`transcricao`) com o que você pesquisou (`aprofundamento`).
- Não coloque nomes de colegas no site.
- Evite `$` fora de fórmulas (o site trata `$...$` como matemática); escreva "R$" como "R\$".
