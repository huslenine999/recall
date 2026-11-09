import json,re
pos=json.load(open('ep_pos.json'))
DORD=["-","cw U","ccw U","Z","H","Opp","Adj","cw O","ccw O","W"]
UORD=["cw U","ccw U","Z","H","Opp","Adj","cw O","ccw O","W","-"]
numre=re.compile(r"-?\d+,-?\d+")
rows=[];gi=0;prev=-1;prob_sum=0
for pg in ('1','2'):
    it=[i for i in pos[pg] if i['y0']<728 and i['y0']>30]
    cy=lambda i:(i['y0']+i['y1'])/2
    Ds=sorted([i for i in it if 104<i['x0']<129 and i['s'].strip() in DORD],key=lambda i:-cy(i))
    probs=[i for i in it if 472<i['x0']<520 and re.fullmatch(r'\d+',i['s'].strip())]
    cnts=[i for i in it if i['x0']>530 and re.fullmatch(r'\d+',i['s'].strip())]
    yes=[i for i in it if i['x0']<80 and i['s'].strip()=='Yes']
    lines=[i for i in it if 129<=i['x0']<472 and (numre.search(i['s']) or 'adj' in i['s'] or 'M2' in i['s'])]
    lines.sort(key=lambda i:-cy(i))
    li=0
    for D in Ds:
        y=cy(D)
        near=lambda L:min(L,key=lambda i:abs(cy(i)-y))
        pr=int(near(probs)['s']); ct=int(near(cnts)['s'])
        par=any(abs(cy(i)-y)<8 for i in yes)  # tentative
        idx=DORD.index(D['s'].strip())
        if idx<=prev: gi+=1
        prev=idx
        row=dict(u=UORD[gi],d=D['s'].strip(),prob=pr,count=ct,page=int(pg),y=round(y,1),nf=[],f=[],notes=[])
        got=0;cur=None
        while li<len(lines) and got<ct:
            band=[lines[li]]; li+=1
            while li<len(lines) and abs(cy(lines[li])-cy(band[0]))<1.5: band.append(lines[li]); li+=1
            for b in band:
                s=b['s'].strip()
                col='nf' if b['x0']<306 else 'f'
                if numre.search(s):
                    m=re.search(r"\s*and adj/adj\s*$",s)
                    if m: row['notes'].append(s[m.start():].strip()); s=s[:m.start()].strip()
                    row[col].append(s); got+=1
                else:
                    row['notes'].append(s)
                    if s.startswith('M2'): got+=1
        rows.append(row)
    print('page',pg,'rows',len(Ds),'leftover lines',len(lines)-li)
    # trailing notes lines after consumed (e.g. attach)
    while li<len(lines): print('LEFT',lines[li]); li+=1
print(len(rows),'sum prob',sum(r['prob'] for r in rows),'sum count',sum(r['count'] for r in rows))
bad=[(r['u'],r['d'],r['count'],len(r['nf'])+len(r['f'])+sum(n.startswith('M2') for n in r['notes'])) for r in rows if r['count']!=len(r['nf'])+len(r['f'])+sum(n.startswith('M2') for n in r['notes'])]
print('count mismatch',bad)
json.dump(rows,open('ep_rows.json','w'),indent=1)
print([(r['u'],r['d']) for r in rows][:12])
