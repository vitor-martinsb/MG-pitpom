"""Generate browser and C tables from one translation catalogue (no dependencies)."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LANGUAGES = ('en', 'pt-BR', 'es')

def generate(output):
    source = json.loads((ROOT / 'data/locales.json').read_text(encoding='utf-8'))
    keys = set(source['en'])
    for lang in LANGUAGES:
        if set(source[lang]) != keys:
            raise ValueError(f'Incomplete catalogue: {lang}')
    output.mkdir(parents=True, exist_ok=True)
    def literal(value):
        # Octal UTF-8 bytes avoid dependence on the compiler's execution charset.
        return '"' + ''.join(chr(b) if 32 <= b < 127 and b not in (34, 92) else f'\\{b:03o}' for b in value.encode('utf-8')) + '"'
    rows = ['/* Generated from data/locales.json. */', 'static const struct { const char *key; const char *text[3]; } golf_translations[] = {']
    for key in sorted(keys):
        rows.append('{' + literal(key) + ',{' + ','.join(literal(source[lang][key]) for lang in LANGUAGES) + '}},')
    rows.append('};')
    (output / 'i18n_tables.h').write_text('\n'.join(rows) + '\n', encoding='utf-8')
    (output / 'i18n-data.js').write_text('window.GOLF_TRANSLATIONS=' + json.dumps(source, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    generate(parser.parse_args().output)
