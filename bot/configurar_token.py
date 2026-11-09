"""Pede o token do bot e salva no arquivo .env, sem mostrar o token na tela.

Uso:
    python bot/configurar_token.py
"""
from __future__ import annotations

import getpass
import re
import sys

from util import RAIZ

ENV = RAIZ / ".env"


def main() -> int:
    print("Cole o token do bot e aperte Enter.")
    print("(Ele não aparece enquanto você cola, isso é normal. No terminal, cole com Ctrl+Shift+V ou botão direito.)")
    token = getpass.getpass("Token: ").strip().strip('"').strip("'")
    if len(token) < 50 or " " in token:
        print("Isso não parece um token do Discord. Copie de novo em Bot > Reset Token e rode outra vez.")
        return 1

    texto = ENV.read_text(encoding="utf-8") if ENV.exists() else ""
    if re.search(r"^DISCORD_TOKEN=.*$", texto, re.M):
        texto = re.sub(r"^DISCORD_TOKEN=.*$", lambda _: f"DISCORD_TOKEN={token}", texto, flags=re.M)
    else:
        texto = texto.rstrip("\n") + ("\n" if texto else "") + f"DISCORD_TOKEN={token}\n"
    ENV.write_text(texto, encoding="utf-8")
    print("Token salvo no .env. Pode voltar para o Claude e avisar que terminou.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
