"""Baixa as fotos, arquivos e mensagens postados no Discord para dentro do projeto.

Não usa nenhuma IA: só copia o que foi postado desde a última execução e termina.
A análise é feita depois, no Claude Code, com o comando /processar-aulas.

Tipos de canal (em bot/config.json):
  "fotos": fotos da lousa. Com "materia" definida, todas as fotos são dessa matéria;
           com "materia": null, o Claude descobre a matéria de cada foto ao processar.
  "geral": mensagens de texto (avisos, guias de estudo) e arquivos (PDFs, slides, imagens).

Uso:
    python bot/baixar.py
"""
from __future__ import annotations

import io
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import discord
from PIL import Image, ImageOps

from util import (ANEXOS, CONFIG, ESTADO, FOTOS, MENSAGENS, SITE, carregar_env,
                  ler_json, salvar_json)

LADO_MAX = 2000  # px: lousa continua legível e cada foto fica com ~300 KB
EXT_IMAGEM = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}


def nome_seguro(nome: str) -> str:
    base = re.sub(r"[^\w.\-]+", "_", nome).strip("._")
    return base[:120] or "arquivo"


def comprimir(conteudo: bytes) -> bytes | None:
    """Endireita (EXIF), reduz e converte para JPEG. None se não for uma imagem legível."""
    try:
        img = Image.open(io.BytesIO(conteudo))
        img = ImageOps.exif_transpose(img)
        img.thumbnail((LADO_MAX, LADO_MAX))
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        saida = io.BytesIO()
        img.save(saida, "JPEG", quality=85, optimize=True)
        return saida.getvalue()
    except Exception:
        return None


def eh_imagem(anexo: discord.Attachment) -> bool:
    if anexo.content_type and anexo.content_type.startswith("image/"):
        return True
    return Path(anexo.filename).suffix.lower() in EXT_IMAGEM


class Baixador(discord.Client):
    def __init__(self, config: dict):
        intents = discord.Intents.default()
        intents.message_content = True  # sem isso o Discord não entrega texto nem anexos
        super().__init__(intents=intents)
        self.config = config
        self.fuso = ZoneInfo(config.get("fuso", "America/Sao_Paulo"))
        self.contagem = {"fotos": 0, "arquivos": 0, "mensagens": 0}
        self.erro: Exception | None = None

    async def on_ready(self):
        try:
            await self.sincronizar()
        except Exception as e:  # mostra o erro depois de desconectar
            self.erro = e
        finally:
            await self.close()

    async def sincronizar(self):
        estado = ler_json(ESTADO, {})
        fotos = ler_json(FOTOS, [])
        anexos = ler_json(ANEXOS, [])
        mensagens = ler_json(MENSAGENS, [])
        ids = {f["id"] for f in fotos} | {a["id"] for a in anexos} | {m["id"] for m in mensagens}

        for cfg in self.config.get("canais", []):
            canal_id, tipo = cfg.get("id"), cfg.get("tipo")
            if not canal_id:
                print(f"- canal '{cfg.get('nome')}' sem ID em bot/config.json, pulando")
                continue
            if tipo not in ("fotos", "geral"):
                print(f"- canal '{cfg.get('nome')}' com tipo inválido {tipo!r}, pulando")
                continue
            canal = self.get_channel(int(canal_id)) or await self.fetch_channel(int(canal_id))
            pasta = nome_seguro(cfg.get("nome") or canal.name)
            ultimo = estado.get(str(canal_id))
            if ultimo:
                depois = discord.Object(id=int(ultimo))
            elif self.config.get("a_partir_de"):  # primeira leitura: só a partir dessa data
                ano, mes, dia_ = map(int, self.config["a_partir_de"].split("-"))
                depois = datetime(ano, mes, dia_, tzinfo=self.fuso)
            else:
                depois = None
            print(f"- lendo #{canal.name}…")

            async for msg in canal.history(limit=None, after=depois, oldest_first=True):
                estado[str(canal_id)] = str(msg.id)
                if msg.author.bot:
                    continue
                quando = msg.created_at.astimezone(self.fuso)
                dia, hora = quando.strftime("%Y-%m-%d"), quando.strftime("%H:%M")
                texto = msg.content.strip()

                if tipo == "geral" and texto and str(msg.id) not in ids:
                    mensagens.append({"id": str(msg.id), "canal": canal.name, "data": dia, "hora": hora,
                                      "texto": texto, "processado": False})
                    ids.add(str(msg.id))
                    self.contagem["mensagens"] += 1

                for i, anexo in enumerate(msg.attachments):
                    ident = f"{msg.id}-{i}"
                    if ident in ids:
                        continue
                    conteudo = await anexo.read()

                    if tipo == "fotos" and eh_imagem(anexo):
                        jpg = comprimir(conteudo)
                        nome = f"{ident}.jpg" if jpg else f"{ident}{Path(anexo.filename).suffix.lower()}"
                        rel = Path("fotos") / pasta / dia / nome
                        (SITE / rel).parent.mkdir(parents=True, exist_ok=True)
                        (SITE / rel).write_bytes(jpg or conteudo)
                        fotos.append({"id": ident, "canal": canal.name, "materia": cfg.get("materia"),
                                      "data": dia, "hora": hora, "arquivo": rel.as_posix(),
                                      "texto": texto, "processada": False})
                        self.contagem["fotos"] += 1
                    else:
                        rel = Path("arquivos") / pasta / f"{msg.id}-{nome_seguro(anexo.filename)}"
                        (SITE / rel).parent.mkdir(parents=True, exist_ok=True)
                        (SITE / rel).write_bytes(conteudo)
                        anexos.append({"id": ident, "canal": canal.name, "data": dia,
                                       "nome": anexo.filename, "arquivo": rel.as_posix(),
                                       "tipo_mime": anexo.content_type, "tamanho": anexo.size,
                                       "texto": texto, "processado": False})
                        self.contagem["arquivos"] += 1
                    ids.add(ident)

            # salva a cada canal: se cair no meio, não baixa tudo de novo
            salvar_json(FOTOS, fotos)
            salvar_json(ANEXOS, anexos)
            salvar_json(MENSAGENS, mensagens)
            salvar_json(ESTADO, estado)


def main() -> int:
    carregar_env()
    token = os.environ.get("DISCORD_TOKEN")
    if not token:
        print("Faltou o DISCORD_TOKEN no arquivo .env (veja o README).")
        return 1
    if not CONFIG.exists():
        print("Faltou o bot/config.json (copie de bot/config.exemplo.json).")
        return 1

    cliente = Baixador(ler_json(CONFIG, {}))
    try:
        cliente.run(token, log_handler=None)
    except discord.LoginFailure:
        print("Token inválido. Gere outro no Discord Developer Portal.")
        return 1
    except discord.PrivilegedIntentsRequired:
        print("Ative 'Message Content Intent' na aba Bot do Developer Portal.")
        return 1

    if cliente.erro:
        if isinstance(cliente.erro, discord.Forbidden):
            print("O bot não tem acesso a um dos canais. Confira se ele pode ver o canal e ler o histórico.")
        elif isinstance(cliente.erro, discord.NotFound):
            print("Um dos IDs de canal não existe. Confira o bot/config.json.")
        else:
            print(f"Erro durante a sincronização: {cliente.erro!r}")
        return 1
    c = cliente.contagem
    print(f"\nPronto: {c['fotos']} fotos, {c['arquivos']} arquivos e {c['mensagens']} mensagens novas.")
    if any(c.values()):
        print("Agora rode /processar-aulas no Claude Code.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
