"""Create a portable ZIP and, optionally, its embedded C header."""
from pathlib import Path
import argparse
import zipfile

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('source',type=Path)
parser.add_argument('archive',type=Path)
parser.add_argument('--header',type=Path)
args=parser.parse_args()
args.archive.parent.mkdir(parents=True,exist_ok=True)
# Keep entries directly readable; compress once at the HTTP boundary.
with zipfile.ZipFile(args.archive,'w',zipfile.ZIP_STORED) as archive:
    for source in sorted(args.source.rglob('*')):
        if source.is_file():
            entry=zipfile.ZipInfo(source.relative_to(args.source).as_posix(),(1980,1,1,0,0,0))
            entry.compress_type=zipfile.ZIP_STORED
            archive.writestr(entry,source.read_bytes())
if args.header:
    data=args.archive.read_bytes()
    with args.header.open('w',newline='\n') as header:
        header.write('static const unsigned char golf_data_zip[] = {\n')
        for offset in range(0,len(data),4096):
            header.write(','.join(map(str,data[offset:offset+4096]))+',\n')
        header.write('};\n')
