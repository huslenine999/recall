# Reads the "Best 2x2 Algs" workbook (best2x2algs.com) into data/src/best2x2_cells.json: for every algorithm sheet, the section labels
# (column A) and the text of the cells in the case columns (B to G), row by row. tools/make_best2x2.js turns that into the data files.
# Usage: python3 tools/best2x2_extract.py Best_2x2_Algs.xlsx     (needs openpyxl)
import openpyxl, json, sys, warnings
warnings.simplefilter('ignore')
wb = openpyxl.load_workbook(sys.argv[1])
SHEETS = ['PBL', 'CLL', 'EG-1', 'EG-2', 'LEG-1', 'TCLL+', 'TCLL-', 'TEG2+'] + ['LS-%d' % i for i in range(1, 10)]
out = {}
for n in SHEETS:
    ws = wb[n]; cells = []
    last = max((r for r in range(1, ws.max_row + 1) if any(ws.cell(r, c).value not in (None, '') for c in range(1, 8))), default=0)
    for r in range(1, last + 1):
        for c in range(1, 8):
            v = ws.cell(r, c).value
            if isinstance(v, str) and v.strip(): cells.append([r, c, v.strip()])
    out[n] = cells
json.dump(out, open('data/src/best2x2_cells.json', 'w'), ensure_ascii=False, indent=0)
print({k: len(v) for k, v in out.items()})
