import json,re,collections
c=json.load(open('mm_raw2.json'))
sets=["CPLL","EPLL","3x1 Line","2x2 Block","R Block","2x1s touching","2x1s not touching","2x1","No blocks"]
tok=re.compile(r"^(?:[URFLD]|BR|BL|dR|bR|dL|bL|y)(?:2'?|'|)$")
out=[];odd=[]
for x in c:
    a=x['raw'].replace('’',"'")
    a=re.sub(r'\s+',' ',a).strip()
    fixes=[]
    m=re.fullmatch(r"\((.*)\)x2",a)
    if m: a=m.group(1)+' '+m.group(1); fixes.append('expanded (..)x2')
    else:
        # inline (..)x2
        def rep(mm): return mm.group(1)+' '+mm.group(1)
        if re.search(r'\)x2',a): a=re.sub(r"\(([^)]*)\)x2",rep,a); fixes.append('expanded inline (..)x2')
    a=a.replace('(','').replace(')','')
    bad=[t for t in a.split() if not tok.match(t)]
    # glued tokens like D-R
    if bad: odd.append((x['id'],bad,a))
    out.append(dict(id=x['id'].replace('\x02','-'),set=sets[x['page']-2],page=x['page'],alg=a,fixes=fixes,raw=x['raw']))
json.dump(out,open('mm_clean.json','w'),indent=1)
for o in odd: print(o)
print(collections.Counter(t for o in out for t in o['alg'].split() if tok.match(t) and t[0] not in 'UR').most_common(30))
# duplicate ids?
print([k for k,v in collections.Counter(o['id'] for o in out).items() if v>1])
print(collections.Counter(re.sub(r'[+-]|\d','',o['id']) for o in out))
