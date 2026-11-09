# Lousa: estudos da turma

A turma posta as fotos da lousa no Discord, o Claude Code transforma tudo em material de estudo
e o site mostra esse material para todo mundo. Não precisa de API de IA paga.

```
Discord (fotos, avisos, PDFs)
   │  python bot/baixar.py           (só baixa, sem IA)
   ▼
pasta do projeto
   │  /processar-aulas no Claude Code (lê, pesquisa e gera o conteúdo)
   ▼
site/data/*.json  ──git push──▶  GitHub Pages  ──▶  turma estuda pelo site
```

O que o site tem:
- **Aulas** de cada matéria: fotos, transcrição da lousa, resumo, explicação com exemplos e links para se aprofundar
- **Mapa mental** de cada matéria
- **Flashcards** com revisão espaçada
- **Mini provas** sorteadas de um banco de questões, com correção e explicação
- **Calendário** de provas, trabalhos e listas, montado a partir dos avisos e das lousas
- **Arquivos**: slides, livros e PDFs
- **XP e nível** de cada aluno, salvos no navegador. O ranking da turma fica para depois.

---

## Configuração (uma vez só)

### 1. Python
```bash
pip install -r requirements.txt
```

### 2. Criar o bot no Discord
1. Acesse https://discord.com/developers/applications, clique em **New Application** e dê um nome (ex.: "Lousa").
2. Na aba **Bot**: clique em **Reset Token** e copie o token. Ative também **Message Content Intent**.
3. Na aba **OAuth2 → URL Generator**: marque `bot` e, em permissões, `View Channels` e `Read Message History`.
   Abra a URL gerada e adicione o bot ao servidor da turma.
4. Copie `.env.exemplo` para `.env` e cole o token em `DISCORD_TOKEN=`.

### 3. Dizer ao bot quais canais ler
1. No Discord: **Configurações → Avançado → Modo desenvolvedor** (ligado).
2. Clique com o botão direito em cada canal e escolha **Copiar ID do canal**.
3. Copie `bot/config.exemplo.json` para `bot/config.json` e coloque o ID em cada canal da lista `canais`:
   - `"tipo": "fotos"`: canal com fotos da lousa. Use `"materia": null` se as fotos forem de várias
     matérias (o Claude descobre qual é cada uma) ou o id da matéria (`"calculo1"`) se o canal for de uma só.
   - `"tipo": "geral"`: canal com avisos, guias de estudo, PDFs e slides.
   - Dá para colocar quantos canais quiser de cada tipo.

### 4. (Opcional) Aviso automático no Discord
Em um canal, abra **Editar canal → Integrações → Webhooks → Novo webhook**, copie a URL e cole em
`DISCORD_WEBHOOK_URL=` no `.env`.

### 5. Publicar o site no GitHub Pages
1. Crie um repositório no GitHub e envie este projeto (o `.env` e o `bot/config.json` ficam de fora pelo `.gitignore`).
2. No repositório: **Settings → Pages → Source: GitHub Actions**.
3. A cada `git push` que mude algo em `site/`, o site é validado e publicado em
   `https://<seu-usuario>.github.io/<repositorio>/`.

---

## Uso semanal

1. Abra o Claude Code na pasta do projeto.
2. Digite **`/processar-aulas`**. O Claude baixa o que é novo, lê as fotos, pesquisa os assuntos e atualiza o site.
3. Confira o resumo que ele mostra e responda se quer publicar e avisar a turma.

Para ver o site no seu computador antes de publicar:
```bash
python -m http.server 8000 -d site
```
e abra http://localhost:8000.

## Cuidados

- **O site é público** (GitHub Pages gratuito). Não coloque nomes nem dados pessoais. Livros com
  direitos autorais devem entrar como **link**, não como arquivo. Para publicar os slides dos professores, peça autorização a eles.
- O processamento consome o limite da sua assinatura do Claude. Rode toda semana, e não tudo no fim do semestre.
- O conteúdo é gerado por IA. A transcrição tenta ser fiel à lousa, mas na dúvida vale o que o professor passou.
