"""Posta uma mensagem no Discord por webhook (ex.: "conteúdo novo no site").

Uso:
    python bot/avisar.py "📚 Conteúdo novo de Cálculo I no site!"
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request

from util import carregar_env


def main() -> int:
    if len(sys.argv) < 2:
        print('Uso: python bot/avisar.py "mensagem"')
        return 1
    carregar_env()
    url = os.environ.get("DISCORD_WEBHOOK_URL")
    if not url:
        print("Faltou o DISCORD_WEBHOOK_URL no arquivo .env (veja o README).")
        return 1
    corpo = json.dumps({"content": " ".join(sys.argv[1:])[:2000]}).encode("utf-8")
    req = urllib.request.Request(url, data=corpo, method="POST", headers={
        "Content-Type": "application/json", "User-Agent": "LousaBot (estudos da turma, 1.0)"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        print("Aviso enviado." if resp.status in (200, 204) else f"Resposta: {resp.status}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
