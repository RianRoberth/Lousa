# Lousa: estudos da turma

Site de estudos da turma de Engenharia de Software (2º semestre), gerado a partir das fotos da lousa
que a turma posta no Discord. Não existe API de IA: o Claude Code faz a análise localmente, com o
comando `/processar-aulas` (veja `.claude/skills/processar-aulas/SKILL.md`).

## Estrutura

- `bot/baixar.py`: baixa fotos, anexos e mensagens (avisos, guias de estudo) novos do Discord (sem IA) para `site/fotos`, `site/arquivos` e `dados/`
- `bot/avisar.py`: posta uma mensagem no Discord por webhook
- `dados/`: manifestos do que foi baixado (`processada: false` = falta processar)
- `site/`: site estático (HTML + JS puro, sem build), publicado no GitHub Pages
- `site/data/geral.json`: matérias, avisos (calendário), arquivos e recomendações
- `site/data/<materia>.json`: aulas, flashcards, questões e mapa mental de cada matéria
- `scripts/validar.py`: confere os JSON. **Rode sempre depois de editar `site/data/`.**

IDs das matérias: `logica`, `calculo1`, `algebra`, `engsoft`.

## Formato de `site/data/<materia>.json`

```json
{
  "materia": "calculo1",
  "aulas": [{
    "id": "2026-03-10", "data": "2026-03-10", "titulo": "Limites laterais",
    "topicos": ["limites"], "fotos": ["fotos/calculo1/2026-03-10/123-0.jpg"],
    "resumo": "md", "transcricao": "md (fiel à lousa)", "aprofundamento": "md (pesquisado)",
    "referencias": [{ "titulo": "", "url": "https://…", "tipo": "video|artigo|livro|exercicios|site", "descricao": "" }]
  }],
  "flashcards": [{ "id": "2026-03-10-f1", "aula": "2026-03-10", "topico": "", "frente": "md", "verso": "md" }],
  "questoes": [
    { "id": "2026-03-10-q1", "aula": "2026-03-10", "topico": "", "tipo": "multipla", "dificuldade": 1,
      "enunciado": "md", "alternativas": ["md", "md", "md", "md"], "correta": 0, "explicacao": "md" },
    { "id": "…-q2", "tipo": "vf", "correta": true, "…": "…" },
    { "id": "…-q3", "tipo": "aberta", "resposta": "md", "…": "…" }
  ],
  "mapa": { "titulo": "Cálculo I", "filhos": [{ "titulo": "Limites", "aula": "2026-03-10", "filhos": [] }] }
}
```

Campos em Markdown aceitam fórmulas LaTeX entre `$…$` e `$$…$$`. Um cifrão literal é escrito `\$`.
Itens com `"exemplo": true` são conteúdo de demonstração e devem ser removidos no primeiro processamento real.

## Rodar localmente

```
python -m http.server 8000 -d site
```
