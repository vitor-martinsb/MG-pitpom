from pathlib import Path
import gzip
import sys
source=Path(sys.argv[1])
with source.open('rb') as incoming, gzip.open(str(source)+'.gz','wb',compresslevel=6) as outgoing:
    while block:=incoming.read(1024*1024): outgoing.write(block)
