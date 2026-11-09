import pypdfium2 as p, json, re
d=p.PdfDocument('/Users/huslenine/Downloads/Megaminx_Full_PLL.pdf')
out={}
for i,pg in enumerate(d):
    tp=pg.get_textpage(); W,H=pg.get_size()
    items=[]
    for r in range(tp.count_rects()):
        l,b,rt,t=tp.get_rect(r)
        s=tp.get_text_bounded(l,b,rt,t)
        items.append(dict(x0=round(l,1),x1=round(rt,1),y0=round(b,1),y1=round(t,1),s=s))
    out[i+1]=dict(W=W,H=H,items=items)
json.dump(out,open('mm_pos.json','w'))
for it in out[2]['items'][:40]: print(it)
