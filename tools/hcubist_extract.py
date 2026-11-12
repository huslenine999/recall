# Reads the HCubist PDFs (Skewb NS, Skewb Sarah's Advanced, Pyraminx L4E) into data/src/hcubist_rows.json.
# Usage: python3 tools/hcubist_extract.py <folder with the three PDFs>   (needs pdfplumber)
import pdfplumber, json, re, sys, logging
logging.disable(logging.CRITICAL)
A=(sys.argv[1] if len(sys.argv)>1 else '.').rstrip('/')+'/'
def fam(w):
    f=w['fontname']
    if 'LiberationSans-Bold' in f: return 'title' if w['size']>9 else 'head'
    if 'DejaVuSansMono-Bold' in f:
        if w['size']>8: return 'sec'
        if w['size']>7: return 'alg'
        if w['size']>6.5: return 'moves'
        return 'altlabel'
    if 'DejaVuSansMono' in f and w['size']>7: return 'alt'
    return 'other'
def extract(path):
    out=[]; carry=['?',None]
    with pdfplumber.open(path) as pdf:
        for pi,p in enumerate(pdf.pages):
            words=[dict(w,k=fam(w)) for w in p.extract_words(extra_attrs=['fontname','size'])]
            secs=[]  # section headers
            lines={}
            for w in words:
                if w['k']=='sec': lines.setdefault(round(w['top']),[]).append(w)
            for t,ws in sorted(lines.items()):
                ws.sort(key=lambda w:w['x0'])
                txt=' '.join(w['text'] for w in ws if w['x0']<500)
                cnt=[w['text'] for w in ws if w['x0']>=500]
                secs.append((t,txt,int(cnt[0]) if cnt else None))
            titles=[w for w in words if w['k']=='title' ]
            # a title line: group words with same top and column
            tl={}
            for w in titles:
                col=0 if w['x0']<300 else 1
                tl.setdefault((col,round(w['top'])),[]).append(w)
            cards=[]
            for (col,t),ws in tl.items():
                ws.sort(key=lambda w:w['x0'])
                name=' '.join(w['text'] for w in ws)
                cards.append(dict(col=col,top=t,name=name,x0=ws[0]['x0']))
            cards.sort(key=lambda c:(c['col'],c['top']))
            prev=carry[:]
            allbreaks=[s[0] for s in secs]+[c['top'] for c in cards]
            for c in cards:
                nxt=[b for b in allbreaks if b>c['top']]
                # next card in same column or next section header
                same=[d['top'] for d in cards if d['col']==c['col'] and d['top']>c['top']]
                nx=min([s[0] for s in secs if s[0]>c['top']]+same+[10**6])
                inbox=[w for w in words if (0 if w['x0']<300 else 1)==c['col'] and c['top']-3<=w['top']<nx-3 and w['x0']>=c['x0']-2 and w['k'] in('alg','alt','moves','altlabel')]
                def join(k):
                    ws=sorted([w for w in inbox if w['k']==k],key=lambda w:(round(w['top']),w['x0']))
                    return ' '.join(w['text'] for w in ws)
                sec=[s for s in secs if s[0]<c['top']]
                s=sec[-1] if sec else (0,prev[0],prev[1])
                mv=join('moves')
                out.append(dict(page=pi+1,section=s[1],seccount=s[2],name=c['name'],moves=int(re.sub(r'\D','',mv.split()[0])) if mv else None,alg=join('alg'),alt=join('alt')))
            if secs: carry[0],carry[1]=secs[-1][1],secs[-1][2]
    return out
if __name__=='__main__':
    res={}
    for tag,f in [('ns','HCubist-Skewb-NS-Sheet.pdf'),('sa','HCubist-Skewb-Sarahs-Advanced-Sheet.pdf'),('l4e','HCubist-Pyraminx-L4E-Sheet.pdf')]:
        r=extract(A+f); res[tag]=r
        print(tag,len(r),'cases; sections:',{s:sum(1 for x in r if x['section']==s) for s in dict.fromkeys(x['section'] for x in r)})
    json.dump(res,open('data/src/hcubist_rows.json','w'),indent=1)
