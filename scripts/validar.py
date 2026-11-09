"""Confere se os JSON do site estão corretos antes de publicar.

Uso:
    python scripts/validar.py
Sai com código 1 e lista os problemas se algo estiver errado.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "site"
DATA = SITE / "data"
DATA_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIPOS_AVISO = {"prova", "trabalho", "atividade", "exercicio", "aviso"}
TIPOS_ARQUIVO = {"slide", "livro", "pdf", "lista", "link", "outro"}
TIPOS_QUESTAO = {"multipla", "vf", "aberta"}

erros: list[str] = []


def erro(onde: str, msg: str) -> None:
    erros.append(f"{onde}: {msg}")


def ler(caminho: Path):
    try:
        return json.loads(caminho.read_text(encoding="utf-8"))
    except Exception as e:
        erro(caminho.name, f"JSON inválido ({e})")
        return None


def data_ok(onde: str, valor) -> None:
    if not isinstance(valor, str) or not DATA_RE.match(valor):
        erro(onde, f"data inválida: {valor!r} (use AAAA-MM-DD)")


def unicos(onde: str, itens: list, campo: str = "id") -> set:
    vistos = set()
    for item in itens:
        v = item.get(campo)
        if not v:
            erro(onde, f"item sem '{campo}': {str(item)[:80]}")
        elif v in vistos:
            erro(onde, f"'{campo}' repetido: {v}")
        vistos.add(v)
    return vistos


def validar_geral(g: dict) -> set:
    ids = unicos("geral.materias", g.get("materias", []))
    for c in ("turma", "atualizado_em", "materias", "avisos", "arquivos", "recomendacoes"):
        if c not in g:
            erro("geral.json", f"falta o campo '{c}'")
    data_ok("geral.atualizado_em", g.get("atualizado_em"))
    unicos("geral.avisos", g.get("avisos", []))
    for a in g.get("avisos", []):
        onde = f"aviso {a.get('id')}"
        data_ok(onde, a.get("data"))
        if a.get("tipo") not in TIPOS_AVISO:
            erro(onde, f"tipo inválido {a.get('tipo')!r}")
        if a.get("materia") not in ids | {None}:
            erro(onde, f"matéria desconhecida {a.get('materia')!r}")
        if not a.get("titulo"):
            erro(onde, "sem título")
    unicos("geral.arquivos", g.get("arquivos", []))
    for a in g.get("arquivos", []):
        onde = f"arquivo {a.get('id')}"
        if a.get("tipo") not in TIPOS_ARQUIVO:
            erro(onde, f"tipo inválido {a.get('tipo')!r}")
        if a.get("materia") not in ids | {None}:
            erro(onde, f"matéria desconhecida {a.get('materia')!r}")
        if a.get("arquivo"):
            if not (SITE / a["arquivo"]).exists():
                erro(onde, f"arquivo não existe: site/{a['arquivo']}")
        elif not a.get("url"):
            erro(onde, "precisa de 'arquivo' ou 'url'")
    for r in g.get("recomendacoes", []):
        if r.get("materia") not in ids | {None}:
            erro("recomendação", f"matéria desconhecida {r.get('materia')!r}")
    return ids


def validar_mapa(onde: str, no, aulas: set) -> None:
    if not isinstance(no, dict) or not no.get("titulo"):
        erro(onde, "nó do mapa sem 'titulo'")
        return
    if no.get("aula") and no["aula"] not in aulas:
        erro(onde, f"mapa aponta para aula inexistente {no['aula']!r}")
    for f in no.get("filhos", []):
        validar_mapa(onde, f, aulas)


def validar_materia(mid: str, d: dict) -> None:
    onde = f"{mid}.json"
    if d.get("materia") != mid:
        erro(onde, f"campo 'materia' deveria ser {mid!r}")
    aulas = unicos(f"{onde} aulas", d.get("aulas", []))
    for a in d.get("aulas", []):
        oa = f"{onde} aula {a.get('id')}"
        data_ok(oa, a.get("data"))
        obrigatorios = ("titulo", "resumo") if a.get("origem") == "guia" else ("titulo", "resumo", "transcricao")
        for c in obrigatorios:
            if not a.get(c):
                erro(oa, f"falta '{c}'")
        for f in a.get("fotos", []):
            if not (SITE / f).exists():
                erro(oa, f"foto não existe: site/{f}")
        for r in a.get("referencias", []):
            if not str(r.get("url", "")).startswith(("http://", "https://")):
                erro(oa, f"referência sem URL válida: {r.get('titulo')!r}")

    unicos(f"{onde} flashcards", d.get("flashcards", []))
    for c in d.get("flashcards", []):
        oc = f"{onde} card {c.get('id')}"
        if c.get("aula") not in aulas:
            erro(oc, f"aula inexistente {c.get('aula')!r}")
        if not c.get("frente") or not c.get("verso"):
            erro(oc, "precisa de 'frente' e 'verso'")

    unicos(f"{onde} questoes", d.get("questoes", []))
    for q in d.get("questoes", []):
        oq = f"{onde} questão {q.get('id')}"
        if q.get("aula") not in aulas:
            erro(oq, f"aula inexistente {q.get('aula')!r}")
        if not q.get("enunciado"):
            erro(oq, "sem enunciado")
        tipo = q.get("tipo")
        if tipo not in TIPOS_QUESTAO:
            erro(oq, f"tipo inválido {tipo!r}")
        elif tipo == "multipla":
            alts = q.get("alternativas") or []
            if len(alts) < 2:
                erro(oq, "precisa de pelo menos 2 alternativas")
            if not isinstance(q.get("correta"), int) or not 0 <= q["correta"] < len(alts):
                erro(oq, "'correta' deve ser o índice (0, 1, 2…) de uma alternativa")
            if len(set(alts)) != len(alts):
                erro(oq, "alternativas repetidas")
        elif tipo == "vf" and not isinstance(q.get("correta"), bool):
            erro(oq, "'correta' deve ser true ou false")
        elif tipo == "aberta" and not q.get("resposta"):
            erro(oq, "questão aberta precisa de 'resposta'")

    if d.get("mapa") is not None:
        validar_mapa(f"{onde} mapa", d["mapa"], aulas)


def main() -> int:
    g = ler(DATA / "geral.json")
    if g is None:
        print("\n".join(erros))
        return 1
    for mid in validar_geral(g):
        caminho = DATA / f"{mid}.json"
        if not caminho.exists():
            erro(caminho.name, "arquivo da matéria não existe")
            continue
        d = ler(caminho)
        if d is not None:
            validar_materia(mid, d)

    if erros:
        print(f"{len(erros)} problema(s):")
        print("\n".join(f"  - {e}" for e in erros))
        return 1
    print("Tudo certo com os dados do site.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
