"""Funções e caminhos compartilhados pelos scripts do bot."""
from __future__ import annotations

import json
import os
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SITE = RAIZ / "site"
DADOS = RAIZ / "dados"
CONFIG = RAIZ / "bot" / "config.json"

ESTADO = DADOS / "estado_discord.json"      # último ID de mensagem lido em cada canal
FOTOS = DADOS / "fotos.json"                # fotos da lousa (pendentes e processadas)
ANEXOS = DADOS / "anexos.json"              # PDFs, slides, livros e outros arquivos
MENSAGENS = DADOS / "mensagens.json"        # textos dos canais gerais (avisos, guias de estudo)


def ler_json(caminho: Path, padrao):
    if caminho.exists():
        return json.loads(caminho.read_text(encoding="utf-8"))
    return padrao


def salvar_json(caminho: Path, dados) -> None:
    """Grava em um arquivo temporário e depois troca, para nunca deixar JSON pela metade."""
    caminho.parent.mkdir(parents=True, exist_ok=True)
    tmp = caminho.with_suffix(caminho.suffix + ".tmp")
    tmp.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(caminho)


def carregar_env() -> None:
    """Lê o arquivo .env da raiz do projeto (KEY=valor) sem precisar de biblioteca extra."""
    env = RAIZ / ".env"
    if not env.exists():
        return
    for linha in env.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        os.environ.setdefault(chave.strip(), valor.strip().strip('"').strip("'"))
