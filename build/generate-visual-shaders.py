"""Bake the visual GLSL subset into the engine's GL330/GLES300 asset format.

Sokol expects flattened vec4 uniforms. Keep the 450 source readable and derive
both runtime variants and their std140 reflection together, without an SDK tool.
"""
from pathlib import Path
import argparse
import json
import re

ROOT = Path(__file__).resolve().parents[1]
SHADERS = ['environment_material', 'ball', 'ui', 'aim_line', 'garden']
TYPES = {'float': (4, 4), 'vec2': (8, 8), 'vec3': (16, 12), 'vec4': (16, 16), 'mat4': (16, 64)}

def compile_stage(source, language):
    uniforms, textures, replacements = [], [], {}
    def block(match):
        binding, name, body = match.groups()
        members, offset = [], 0
        for declaration in body.split(';'):
            declaration = declaration.strip()
            if not declaration:
                continue
            kind, names = declaration.split(None, 1)
            alignment, size = TYPES[kind]
            for field in names.split(','):
                field = field.strip()
                if not re.fullmatch(r'\w+', field):
                    raise ValueError(f'Unsupported uniform: {field}')
                offset = (offset + alignment - 1) // alignment * alignment
                members.append({'name': field, 'offset': offset, 'size': size})
                slot, component = divmod(offset, 16)
                if kind == 'mat4':
                    expression = 'mat4(' + ','.join(f'{name}[{slot+i}]' for i in range(4)) + ')'
                else:
                    components = size // 4
                    expression = f'{name}[{slot}]' + ('.' + 'xyzw'[component//4:component//4+components] if components < 4 else '')
                replacements[field] = expression
                offset += size
        size = (offset + 15) // 16 * 16
        uniforms.append({'name': name, 'size': size, 'binding': int(binding), 'members': members})
        return f'uniform vec4 {name}[{size//16}];'
    source = re.sub(r'layout\(binding\s*=\s*(\d+)\)\s*uniform\s+(\w+)\s*\{(.*?)\};', block, source, flags=re.S)
    def sampler(match):
        binding, name = match.groups()
        textures.append({'name': name, 'binding': int(binding)})
        return f'uniform sampler2D {name};'
    source = re.sub(r'layout\(binding\s*=\s*(\d+)\)\s*uniform\s+sampler2D\s+(\w+)\s*;', sampler, source)
    inputs = [{'name': m[1], 'location': int(m[0])} for m in re.findall(r'layout\(location\s*=\s*(\d+)\)\s*in\s+\w+\s+(\w+)\s*;', source)]
    source = re.sub(r'layout\(location\s*=\s*\d+\)\s*', '', source)
    if replacements:
        source = re.sub(r'\b(' + '|'.join(re.escape(k) for k in replacements) + r')\b', lambda m: replacements[m[0]], source)
    source = re.sub(r'(?<=\d)f\b', '', source)
    header = '#version 300 es\nprecision highp float;\nprecision highp int;' if language == 'gles300' else '#version 330'
    source = re.sub(r'#version\s+450', header, source)
    result = {'source': source.strip() + '\n', 'inputs': inputs, 'uniforms': uniforms}
    if textures:
        result['textures'] = textures
    return result

def generate(name):
    source = (ROOT / f'data/shaders/{name}.glsl').read_text(encoding='utf-8')
    stages = {stage: re.search(r'//@begin_' + tag + r'\s*(.*?)//@end', source, re.S).group(1) for stage, tag in [('vs', 'vert'), ('fs', 'frag')]}
    return json.dumps({language: {stage: compile_stage(code, language) for stage, code in stages.items()} for language in ['glsl330', 'gles300']}, indent=2) + '\n'

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for name in SHADERS:
        target = ROOT / f'data/shaders/{name}.glsl.golf_data'
        result = generate(name)
        if args.check:
            assert target.read_text(encoding='utf-8') == result, f'Stale shader asset: {target}'
        elif not target.exists() or target.read_text(encoding='utf-8') != result:
            target.write_text(result, encoding='utf-8')
