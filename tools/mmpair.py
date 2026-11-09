import json,re
pos=json.load(open('mm_pos.json'))
cases=[]
for pg in range(2,11):
    items=[i for i in pos[str(pg)]['items'] if 48<i['y0']<700]
    # name labels: short, x0 near column starts, height ~7.8 and no spaces inside besides trailing
    names=[];algs=[]
    for i in items:
        s=i['s'].strip()
        if len(s)<=5 and 7.5<(i['y1']-i['y0'])<10 and re.fullmatch(r"[A-Z]\d?[^\s]?",s.replace('￾','-')) and 'x2' not in s:
            names.append(dict(i,s=s.replace('￾','-').replace('￿','-')))
        elif (i['y1']-i['y0'])<10.5: algs.append(i)
    print('page',pg,'names',len(names),[n['s'] for n in names])
    for a in algs: a['name']=None
    for a in algs:
        c=(a['x0']+a['x1'])/2
        best=None
        for n in names:
            if n['x0']-8<=c<=n['x0']+135 and n['y0']>=a['y1']-1:
                g=n['y0']-a['y1']
                if best is None or g<best[0]: best=(g,n)
        if best is None: print('  UNPAIRED',pg,a)
        else: a['name']=best[1]['s']
    for n in names:
        mine=sorted([a for a in algs if a['name']==n['s']],key=lambda a:-a['y1'])
        cases.append(dict(id=n['s'],page=pg,raw=' '.join(m['s'].strip() for m in mine),lines=len(mine)))
json.dump(cases,open('mm_raw2.json','w'),indent=1)
print(len(cases))
