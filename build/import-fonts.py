"""Regenerate Latin-1 font atlases using the same importer as the game."""
import os
from pathlib import Path
import shutil
import subprocess
ROOT=Path(__file__).resolve().parent.parent
def main():
    output=ROOT/'out/font-import'
    output.mkdir(parents=True,exist_ok=True)
    executable=output/('import-fonts.exe' if os.name=='nt' else 'import-fonts')
    zig=ROOT/'out/toolchain/ziglang/zig.exe'
    compiler=[str(zig),'cc'] if zig.is_file() else [shutil.which('cc') or shutil.which('clang') or 'gcc']
    subprocess.run([*compiler,'-O2','-Isrc','-Isrc/3rd_party','build/import-fonts.c','src/3rd_party/parson/parson.c','-lm','-o',str(executable)],cwd=ROOT,check=True)
    for name in ['poppins/Poppins-Regular','poppins/Poppins-Medium','poppins/Poppins-SemiBold','poppins/Poppins-Bold']:
        font=ROOT/f'data/font/{name}.ttf'
        subprocess.run([str(executable),str(font),str(font)+'.golf_data'],check=True)
        print('Regenerated '+name,flush=True)
if __name__=='__main__':main()
