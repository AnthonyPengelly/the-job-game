"""
THE JOB - Heat model Monte Carlo (v3).
Now reports OBSTACLES per run (target ~4-5), softer botch heat, and a tunable
Getaway curve. Escape = fixed heat threshold or forced at HMAX. Getaway success
depends on heat + crew skill, so skill separates win/score/length.
"""
import random, statistics

SKILL = {'bad': 0.45, 'avg': 0.65, 'good': 0.82}
def player_bonus(n): return {2:-0.04,3:-0.02,4:0.0,5:0.02,7:0.05}.get(n,0.0)
def growth_bonus(i): return min(0.12, 0.015*i)

class Config:
    def __init__(s, HMAX, run_at_frac, ramp_step, base_ob, greedy_x, comp_h, botch_h, scen_s, exp=1.3):
        s.HMAX=HMAX; s.run_at=run_at_frac*HMAX; s.ramp_step=ramp_step
        s.base_ob=base_ob; s.greedy_x=greedy_x; s.comp_h=comp_h; s.botch_h=botch_h
        s.scen_s=scen_s; s.exp=exp

def getaway(H, cfg, n, crewskill):
    frac=H/cfg.HMAX
    p=1.0-frac**cfg.exp
    p+=(crewskill-0.65)*0.5 + player_bonus(n)*0.8
    return max(0.04, min(0.97, p))

def outcome(rng,p):
    if rng.random()<p: return 'clean' if rng.random()<0.7 else 'comp'
    return 'comp' if rng.random()<0.4 else 'botch'

def run_once(rng,cfg,skill,n):
    H=loot=room=obst=0
    base=SKILL[skill]+player_bonus(n)
    while True:
        room+=1
        if room>40: return resolve(rng,cfg,H,loot,n,room,obst,skill,True)
        p=min(0.95, base+growth_bonus(room))
        if rng.random()<0.6:                       # OBSTACLE
            obst+=1
            ramp=cfg.base_ob+int(room*cfg.ramp_step)
            greedy=(H<0.5*cfg.HMAX)
            H+=ramp+(cfg.greedy_x if greedy else 0)
            oc=outcome(rng,p-(0.1 if greedy else 0))
            if oc=='clean': loot+= 2 if greedy else 1
            elif oc=='comp': loot+=1; H+=cfg.comp_h
            else: H+=cfg.botch_h
        else:                                       # SCENARIO
            if H>0.6*cfg.HMAX:
                if rng.random()<0.5: H-=cfg.scen_s
                else: H+= -cfg.scen_s if rng.random()<p else cfg.scen_s
            else:
                r=rng.random()
                if r<0.4: loot+=2
                elif r<0.7: loot+=1
                else:
                    if rng.random()<p: loot+=2
                    else: H+=cfg.scen_s
        H=max(0,H)
        if H>=cfg.HMAX: return resolve(rng,cfg,cfg.HMAX,loot,n,room,obst,skill,True)
        if room>=2 and H>=cfg.run_at: return resolve(rng,cfg,H,loot,n,room,obst,skill,False)

def resolve(rng,cfg,H,loot,n,room,obst,skill,forced):
    gp=getaway(H,cfg,n,SKILL[skill]); win=rng.random()<gp
    score=loot*(1.0+0.5*(1-H/cfg.HMAX)) if win else loot*0.4
    return dict(win=win,score=score,rooms=room,obst=obst,heat=H,forced=forced)

def summ(rng,cfg,skill,n,N=15000):
    rs=[run_once(rng,cfg,skill,n) for _ in range(N)]
    rooms=[r['rooms'] for r in rs]; obst=[r['obst'] for r in rs]
    return dict(mob=statistics.median(obst), mrm=statistics.median(rooms),
        meanrm=round(statistics.mean(rooms),1),
        plong=round(sum(x>10 for x in rooms)/N,3),
        win=round(sum(r['win'] for r in rs)/N,3),
        bust=round(sum(r['forced'] and not r['win'] for r in rs)/N,3),
        score=round(statistics.mean(r['score'] for r in rs),2),
        heat=round(statistics.mean(r['heat'] for r in rs),1),
        cv=round(statistics.pstdev(rooms)/max(.01,statistics.mean(rooms)),2))

def stage1():
    print("="*104)
    print("STAGE 1 (avg, n=4, 8000). Targets: ~4-5 obstacles, rooms<=10 almost always, avg win ~0.48-0.58")
    print("="*104)
    print(f"{'HMAX':>4} {'run@':>5} {'ramp':>5} | {'obst':>4} {'rooms':>5} {'meanR':>5} {'r>10':>5} {'win':>5} {'bust':>5} {'heat':>5} {'score':>6}")
    rng=random.Random(1); good=[]
    for HMAX in (14,16,20,24):
        for frac in (0.55,0.65):
            for ramp in (0.2,0.3):
                cfg=Config(HMAX,frac,ramp,1,1,1,2,2,exp=1.3)
                s=summ(rng,cfg,'avg',4,8000)
                hit = 4<=s['mob']<=5 and s['plong']<=0.05 and 0.46<=s['win']<=0.60
                if hit: good.append((HMAX,frac,ramp))
                print(f"{HMAX:>4} {frac:>5} {ramp:>5} | {s['mob']:>4} {s['mrm']:>5} {s['meanrm']:>5} {s['plong']:>5} {s['win']:>5} {s['bust']:>5} {s['heat']:>5} {s['score']:>6}{'  <==' if hit else ''}")
    print(f"\nHit all targets: {good if good else 'none exact'}")
    return good

def stage2(configs):
    print("\n"+"="*104)
    print("STAGE 2 - skill x players (15000). win+score should rise with skill; good crew rarely busts")
    print("="*104)
    rng=random.Random(2)
    for (HMAX,frac,ramp) in configs:
        cfg=Config(HMAX,frac,ramp,1,1,1,2,2,exp=1.3)
        print(f"\n--- HMAX={HMAX} run@={frac} ramp={ramp} ---")
        print(f"{'skill':>5} {'n':>2} | {'obst':>4} {'rooms':>5} {'win':>5} {'bust':>5} {'score':>6} {'cv':>4}")
        rows={}
        for skill in ('bad','avg','good'):
            for n in (2,4,7):
                s=summ(rng,cfg,skill,n); rows[(skill,n)]=s
                print(f"{skill:>5} {n:>2} | {s['mob']:>4} {s['mrm']:>5} {s['win']:>5} {s['bust']:>5} {s['score']:>6} {s['cv']:>4}")
        g,b=rows[('good',4)],rows[('bad',4)]
        print(f"   gap @n4: win {b['win']}->{g['win']} (+{round(g['win']-b['win'],3)})  score {b['score']}->{g['score']} (x{round(g['score']/max(.01,b['score']),2)})")

def verify(t):
    print("\n"+"="*104); print("VERIFICATION - recommended across seeds (avg, n=4)"); print("="*104)
    HMAX,frac,ramp=t
    for seed in (7,21,99,314,2718):
        rng=random.Random(seed); cfg=Config(HMAX,frac,ramp,1,1,1,2,2,exp=1.3)
        s=summ(rng,cfg,'avg',4,12000)
        print(f"seed {seed:>4}: obst={s['mob']} rooms={s['mrm']} mean={s['meanrm']} win={s['win']} r>10={s['plong']} bust={s['bust']} score={s['score']}")

if __name__=="__main__":
    good=stage1()
    shortlist=[(20,0.65,0.2),(24,0.65,0.2),(20,0.55,0.2),(16,0.65,0.2)]
    stage2(shortlist)
    verify((20,0.65,0.2))
