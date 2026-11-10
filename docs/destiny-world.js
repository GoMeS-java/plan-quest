(function (root) {
  'use strict';

  const width = 800;
  const height = 900;
  const art = 'assets/citadel/';
  const states = ['Сковано', 'Ослаблено', 'Пробуждено'];
  const layout = {
    body: {points:[[288,390],[237,371],[162,347]], vein:'M347 520l-10-59-19-45-30-26-51-19-40-17-35-7-35-17',
      chain:[[226,417],[346,469],[439,411]], fork:'M237 371l-30-31-35-29-31-14', forkPoints:[[207,340],[172,311]]},
    will: {points:[[414,339],[475,264],[553,221]], vein:'M405 485l-9-68 18-78 25-44 36-31 43-24 35-19 46-16',
      chain:[[407,349],[509,342],[576,228]], fork:'M475 264l26-49 33-55 41-47', forkPoints:[[501,215],[534,160]]},
    mind: {points:[[343,338],[310,286],[247,207]], vein:'M377 464l-20-64-14-62-33-52-36-43-27-36-31-33',
      chain:[[262,293],[333,379],[434,370]]},
    path: {points:[[455,472],[529,464],[605,445]], vein:'M403 554l19-43 33-39 39-12 35 4 35-17 41-2 48-11',
      chain:[[314,481],[444,549],[592,450]]},
    citadel: {points:[[391,581],[375,673],[308,761]], vein:'M417 493l-16 43-10 45-7 55-9 37-29 42-38 46-51 41',
      horizonVein:'M415 514l-8-54 11-34-9-35 13-33-5-24 13-22',
      chain:[[249,703],[370,696],[484,642]], fork:'M375 673l-55 17-56 47-52 26', forkPoints:[[320,690],[264,737]]},
    capital: {points:[[473,612],[543,727],[631,800]], vein:'M413 548Q459 568 473 612L484 666Q498 705 543 727L580 766 631 800 707 837',
      chain:[[443,658],[565,656],[631,760]]}
  };
  // Ribbons follow the old wood; each new bough has its own silhouette and crown.
  const forms = {
    body:{wood:'M348 531Q340 438 295 405L244 380 171 353 108 335 163 363 232 389 283 421Q326 462 333 539Z',
      boughs:[
        ['M257 390Q223 352 184 334L137 307Q201 323 239 353L277 400Z',159,319,-24],
        ['M221 383Q191 390 152 393L101 371Q153 375 179 376L242 381Z',124,379,-52],
        ['M182 338Q157 309 149 282L162 291 178 313 201 349Z',157,295,-44]
      ],kind:'leaf'},
    will:{wood:'M391 485Q374 415 400 350Q423 290 467 263L524 237 590 205 532 244 476 280Q423 324 416 373L421 497Z',
      boughs:[
        ['M462 281Q486 229 509 202L526 185Q510 222 484 266L478 281Z',516,198,24],
        ['M509 260Q547 262 592 239L628 228 606 245 572 262 501 272Z',604,241,48],
        ['M542 235L581 201 598 166 597 198 567 234 552 241Z',596,184,20]
      ],kind:'ember'},
    mind:{wood:'M375 466L355 425 335 345Q311 291 282 250L224 174 260 205 302 252 353 329 375 393 397 468Z',
      boughs:[
        ['M310 299L269 281 236 247 256 259 285 267 328 307Z',246,258,-25],
        ['M292 269L302 229 286 187 307 210 315 240 308 289Z',300,207,6],
        ['M258 227L225 218 197 192 218 201 249 210 273 242Z',209,199,-32]
      ],kind:'crystal'},
    path:{wood:'M394 567Q411 507 450 471L508 454 560 455 626 438 709 414 676 434 622 452 563 470 518 475 465 493Q438 515 418 572Z',
      boughs:[
        ['M491 475Q523 505 578 506L620 492Q592 517 548 516L475 488Z',587,507,62],
        ['M579 461Q612 477 653 469L689 449Q665 479 626 486L558 475Z',662,467,40],
        ['M419 547Q437 586 459 608L511 628 487 630 454 617 410 574Z',484,624,63]
      ],kind:'flower'},
    citadel:{wood:'M408 506L423 529 400 583 396 643 381 690 347 738 285 785 316 748 342 716 366 669 369 635 375 576Z',
      boughs:[
        ['M373 637L348 663 314 680 273 681 289 694 331 695 361 678 383 652Z',302,685,-20],
        ['M354 715L322 725 273 741 241 774 264 766 301 751 344 744Z',266,757,-28],
        ['M391 601L414 617 417 658 405 649 399 627 380 623Z',408,635,12]
      ],kind:'stone'},
    capital:{wood:'M422 541Q462 564 482 610L497 671Q516 710 548 716L587 755 638 789 718 833 646 810 566 774 530 743Q482 723 468 674L454 619Q440 583 407 559Z',
      boughs:[
        ['M498 702Q539 701 572 682L611 663 588 687 543 718 509 724Z',585,679,58],
        ['M556 740Q600 734 636 743L678 754 641 758 589 752 573 760Z',652,752,60],
        ['M610 784Q642 776 680 790L720 806 681 802 650 801 626 801Z',695,799,66]
      ],kind:'gold'}
  };
  const motifs={
    leaf:'M0 7Q-15-9-10-25Q4-19 5-8Q12-21 24-23Q24-8 5 2L1 11Z',
    ember:'M0 7Q-11-1-5-14L0-7Q9-17 6-27Q21-9 11 2L3 8Z',
    crystal:'M-9 7L-11-8-4-20 3-10 6-23 14-31 21-17 15 3 5 9ZM-4-20L-3 6M14-31L12 4',
    flower:'M0 8V-7M0-5Q-18-4-11-15Q-7-19-3-14Q-6-27 4-26Q13-24 7-15Q20-23 21-13Q20-4 5-7Z',
    stone:'M-17 6V-8H-10V-16H-4V-10H3V-24H9V-15H15V3ZM-7 3V-3H-2V3M5-3V-9H9V-3',
    gold:'M1 11L-4 2Q-17-5-14-23Q3-21 5-8Q12-23 28-25Q24-8 8 2L3 11Z'
  };
  const stages=['Мёртвое Древо','Первое дыхание','Пробуждение','Возрождение','Сердце Древа'];
  const trunk='M82 829L171 790 235 750Q270 705 288 638L311 552Q327 481 298 440L244 395 186 368 261 380Q309 395 337 431L324 365 294 312 265 251 215 183 268 233 318 297 352 371 357 314 347 250 345 196 365 257 375 333 393 368Q406 294 446 242L488 185 533 145 501 191 458 253Q428 307 422 361L487 327 562 316 652 289 572 335 501 351 457 379Q419 431 450 468L516 463 573 444 650 440 580 467 521 482 471 502Q447 534 460 584L483 665Q503 707 553 739L613 778 716 838 625 810 552 779 492 739 448 690 451 733 483 798 545 850 483 829 447 791 415 737 409 796 415 856 387 835 376 789 381 731 364 695 342 746 294 797 229 849 187 860 238 822 280 770 300 727 254 768 174 809 116 822Z';
  const barkRidges=[
    ['M141 807L237 756 278 697 304 616 325 550 331 490 320 450 273 405 224 385Q296 399 339 452L349 515 331 587 317 664 273 733 226 780Z','#936b58'],
    ['M216 850L282 783 321 728 349 656 356 599 374 536 370 482 351 440 337 387 320 341 287 285 325 331 351 380 362 428 391 472 398 533 381 602 377 668 349 735 316 779 261 824Z','#b38463'],
    ['M399 835L387 787 394 726 383 670 394 613 390 569 410 517 405 466 390 432 405 375 416 318 441 273 476 222 504 187 483 226 450 279 431 327 424 388 411 430 431 468 434 516 418 569 426 617 415 671 425 721 409 779Z','#634653'],
    ['M525 837L479 813 450 773 419 724 421 666 432 615 420 569 439 523 445 494 438 461 428 435 437 404 468 373 517 353 558 347 626 318 573 352 520 366 484 387 455 422 452 445 464 473 457 528 445 575 456 620 443 666 449 724 467 779Z','#c1946e'],
    ['M703 836L622 800 555 771 505 736 478 701 462 658 454 622 466 640 496 694 534 727 592 764 631 783Z','#916851']
  ];
  const grain='M185 796l56-32 44-53 29-63 19-87m-21-30 3-31-16-56-27-20m81 28 14 29 6 32-15 61m-2 36-4 47-22 52-30 43m45-3 25-47 15-44 11-74m-13 189 7-40-7-37m43 66-14-38 2-38m39 67-20-54-2-39 11-64m-12-20-10-38 20-50 4-38m15 21 40-12 33 3 45-17m-134-13-19-41 4-44m-64 16-11-48-5-60m-14 85-23-38-32-37m108 80 8-52 25-44m-45 96 18-72 29-52m26 107 48-15 48-2 35-18m-124 399 31 41 51 35 62 27m-137-85-34-57-18-53';
  const crownSpine='M354 312Q351 274 348 231L346 183 337 141 339 108 325 74 323 42 341 82 352 111 350 139 366 183 364 232 380 315ZM398 333Q412 262 432 214L459 162 482 127 494 89 504 64 516 32 516 62 508 91 505 123 523 108 567 95 611 66 596 88 565 110 531 121 498 147 472 177 452 222 435 278 422 333Z';
  const rootMass=[
    'M353 622Q316 685 270 727Q222 764 174 770L121 798 76 813 36 846 118 823 166 804 216 791Q292 755 332 707L371 658Z',
    'M387 661Q363 731 313 772L263 811 217 861 259 850 286 831 331 814Q378 776 402 720L413 680Z',
    'M439 606Q481 667 508 711Q567 755 625 766L677 804 758 846 728 846 660 821 614 805Q544 790 496 751Q454 725 421 668Z',
    'M404 681Q432 742 470 769L522 800 555 839 612 870 565 868 522 851 477 816Q431 799 407 753L387 722Z'
  ];
  const rootVeins=[
    'M351 647Q316 727 233 770L164 795 104 813 52 842',
    'M396 682Q375 749 318 798L269 829 225 858',
    'M430 629Q476 722 541 756L617 784 675 814 742 843',
    'M403 709Q435 780 484 803L525 832 590 863'
  ];
  const forks=[
    ['body','M340 422Q279 319 184 295L142 252 197 276 258 291 306 340 357 417Z',[[166,268,-58],[190,280,-18],[231,291,-65],[251,307,2]]],
    ['will','M417 376Q438 279 538 231L613 185 584 224 526 256Q459 289 438 370Z',[[560,240,33],[581,224,60],[608,196,25],[538,258,-16]]],
    ['mind','M364 355Q323 271 263 199L246 157 277 178 309 220 336 248 381 351Z',[[256,172,-28],[279,199,18],[305,232,-37],[324,248,2]]],
    ['path','M440 498Q517 514 590 493L673 475 639 506 586 521Q520 533 458 520Z',[[613,501,50],[632,505,71],[657,486,24],[584,516,55]]],
    ['citadel','M376 620Q341 694 272 714L205 753 227 716 275 691 328 665 367 606Z',[[245,711,-37],[268,705,-19],[289,690,3],[225,733,-33]]],
    ['capital','M479 697Q543 743 613 724L704 752 648 750 603 755 548 763 505 750Z',[[620,739,49],[644,745,64],[669,746,54],[693,753,78]]]
  ];
  const channels=[
    'M392 524Q367 477 347 520','M392 524Q415 507 405 485','M392 524Q378 501 377 464',
    'M392 524Q412 533 403 554','M392 524Q420 533 417 493','M392 524Q401 544 413 548'
  ];
  const pulseTrace='M397 777Q376 725 393 672L409 604 402 568 392 524Q415 479 402 434L418 374 435 317 464 265';
  const stone = 'M0-18L13-12 18 0 12 13 0 18-13 12-18 0-12-13Z';
  const windows = [[661,390],[628,420],[690,433],[599,445],[718,455],[661,406],[633,438],[683,453],[611,466],[710,477],[652,425],[672,436],[637,471],[681,480],[623,483],[700,466]];
  const svg = (tag, attributes = {}) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    return node;
  };

  function project(rows, roomLevels, growth={}) {
    const branches = Object.entries(layout).map(([id, shape]) => {
      const main = rows.find(row => row.id === id);
      const fork = shape.forkPoints && rows.find(row => row.from && row.id.startsWith(id + '-'));
      const nodes = (main?.nodes || []).map((node, i) => ({
        id:node.id, name:node.name, description:node.description, open:node.state === 'open', point:shape.points[i]
      }));
      const extra = (fork?.nodes || []).map((node, i) => ({
        id:node.id, name:node.name, description:node.description, open:node.state === 'open', point:shape.forkPoints[i]
      }));
      const opened = nodes.filter(node => node.open).length;
      const evidence=growth[id]||{};
      const tier=Math.min(12,opened*4+[2,5,9].filter(days=>evidence.days>=days).length);
      const warmth=Math.min(4,Math.max(0,Math.ceil((evidence.recent||0)/2)));
      return {id,label:main?.label || '',glyph:main?.glyph || '',state:opened===3?2:opened>0?1:0,opened,tier,warmth,nodes,extra};
    });
    const levels = roomLevels.filter(level => level === 2 || level === 3);
    const lamps = Math.min(windows.length, 1 + levels.reduce((count,level) => count + level - 1,0));
    const restoration=lamps>=12?3:lamps>=6?2:lamps>=2?1:0;
    return {branches,lamps,restoration,awakening:awakening(branches)};
  }

  function awakening(branches) {
    const fullness=branches.reduce((sum,branch)=>sum+branch.tier,0)/(12*branches.length);
    return {
      percent:Math.floor(fullness*100),
      stage:Math.floor(fullness*4),
      warmth:branches.reduce((sum,branch)=>sum+branch.warmth,0)/(4*branches.length)
    };
  }

  function historicalAppearance(tree, seals=[]) {
    if(!tree)return null;
    const known=new Set(seals);
    const branches=Object.entries(layout).map(([id,shape])=>{
      const [tier,warmth]=tree[id];
      const readNodes=(points,prefix)=>points.map((point,index)=>{
        const key=prefix+'-'+(index+1);
        return {id:key,point,open:known.has(key)};
      });
      const nodes=readNodes(shape.points,id);
      const opened=nodes.filter(node=>node.open).length;
      const extra=shape.forkPoints&&known.has(id+'-hidden-1')?readNodes(shape.forkPoints,id+'-hidden'):[];
      return {id,tier,warmth,nodes,extra,opened,state:opened===3?2:opened>0?1:0};
    });
    return {branches,awakening:awakening(branches)};
  }

  function heartArt(id, distant=false) {
    const group=svg('g',{class:'destiny-heart-tree','aria-hidden':'true'});
    const defs=svg('defs');
    const gradient=svg('linearGradient',{id:id+'-bark',gradientUnits:'userSpaceOnUse',x1:180,y1:390,x2:610,y2:610});
    for(const [offset,color] of [[0,'#31212e'],[.28,'#735344'],[.40,'#a77b5f'],[.5,'#765348'],[.58,'#503846'],[.71,'#95634e'],[1,'#35222e']]){
      gradient.append(svg('stop',{offset,'stop-color':color}));
    }
    const halo=svg('radialGradient',{id:id+'-halo'});
    for(const [offset,color,opacity] of [[0,'#ffdda2',.95],[.24,'#ffc784',.43],[.60,'#e88d75',.19],[1,'#b66c84',0]]){
      halo.append(svg('stop',{offset,'stop-color':color,'stop-opacity':opacity}));
    }
    defs.append(gradient,halo);
    const roots=svg('g',{class:'destiny-living-roots'});
    rootMass.forEach((d,i)=>roots.append(svg('path',{d,class:'destiny-root-mass',fill:'url(#'+id+'-bark)'}),
      svg('path',{d:rootVeins[i],class:'destiny-root-vein'})));
    const bark=svg('g',{class:'destiny-trunk'});
    const barkFill='url(#'+id+'-bark)';
    bark.append(svg('path',{d:trunk,fill:barkFill,class:'destiny-trunk-mass'}),
      svg('path',{d:crownSpine,fill:barkFill,class:'destiny-trunk-mass destiny-crown-spine'}));
    if(!distant){
      barkRidges.forEach(([d,fill])=>bark.append(svg('path',{d,fill,class:'destiny-bark-ridge'})));
      bark.append(svg('path',{d:grain,class:'destiny-trunk-grain'}));
    }
    bark.append(svg('path',{d:pulseTrace,class:'destiny-spine'}));
    const limbs=svg('g',{class:'destiny-major-limbs'});
    forks.forEach(([branch,d,crown])=>{
      const limb=svg('g',{'data-direction':branch,class:'destiny-major-limb'});
      limb.append(svg('path',{d,class:'destiny-limb-bark'}));
      if(!distant)crown.forEach(([x,y,angle],index)=>limb.append(svg('path',{
        d:motifs[forms[branch].kind],class:'destiny-limb-crown',
        transform:`translate(${x} ${y}) rotate(${angle}) scale(${index%2?.7:.94})`
      })));
      limbs.append(limb);
    });
    if(!distant){
      const foliage=svg('g',{class:'destiny-high-crown'});
      for(const [branch,x,y,angle] of [
        ['mind',333,78,-30],['mind',348,113,20],['mind',353,145,-33],
        ['will',506,72,20],['will',486,119,-25],['will',526,123,62],
        ['body',572,105,44],['body',599,82,60]
      ]){
        foliage.append(svg('path',{d:motifs[forms[branch].kind],class:'destiny-limb-crown','data-direction':branch,
          transform:`translate(${x} ${y}) rotate(${angle}) scale(.66)`}));
      }
      limbs.append(foliage);
    }
    const heart=svg('g',{class:'destiny-heart',transform:'translate(392 524)'});
    heart.append(svg('circle',{r:62,fill:'url(#'+id+'-halo)',class:'destiny-heart-halo'}),
      svg('path',{d:'M-19-15L-7-24 8-22 21-8 19 9 8 21-6 24-20 10-24-2Z',class:'destiny-heart-cradle'}),
      svg('path',{d:'M0-15L12-6 9 7 0 16-10 5-12-5ZM0-15L3 0 12-6M3 0L0 16M-12-5L3 0',class:'destiny-heart-core'}));
    if(!distant)heart.append(svg('path',{d:'M-25 12l-3 5m-1-40 4 2m43-13 1-4m11 55 5 3m-41 6-1 5m43-41 4-2',class:'destiny-heart-dust'}));
    const flow=svg('g',{class:'destiny-heart-channels'});
    Object.keys(layout).forEach((branch,index)=>flow.append(svg('path',{d:channels[index],
      'data-direction':branch,class:'destiny-heart-channel','pathLength':1})));
    const wave=svg('path',{d:pulseTrace,class:'destiny-trunk-wave',pathLength:1});
    group.append(defs,roots,bark,limbs,flow,heart);
    if(!distant)group.append(wave);
    function sync(model) {
      const {stage,percent,warmth}=model.awakening;
      group.dataset.stage=stage;
      group.dataset.percent=percent;
      group.style.setProperty('--growth-edge',Math.max(0,100-percent*1.12)+'%');
      group.style.setProperty('--tree-light',String(.42+warmth*.58));
      model.branches.forEach((branch,index)=>{
        limbs.children[index].dataset.tier=branch.tier;
        flow.children[index].style.setProperty('--channel-light',String(branch.tier/12));
      });
    }
    return {group,sync,flow,wave};
  }

  function snapshot(model) {
    return Object.fromEntries(model.branches.map(({id,tier,warmth})=>[id,[tier,warmth]]));
  }

  function drawWood(branch) {
    const {wood,boughs,kind}=forms[branch.id], shape=layout[branch.id];
    const group=svg('g',{class:'destiny-wood','data-direction':branch.id,'data-tier':branch.tier,'aria-hidden':'true'});
    group.style.setProperty('--bark-light',String(.20+branch.tier*.06));
    group.style.setProperty('--warmth',String(.26+branch.warmth*.18));
    group.append(svg('path',{d:wood,class:'destiny-cambium'}),
      svg('path',{d:shape.vein,class:'destiny-grain'}));
    for(const [index,[trace,x,y,angle]] of boughs.entries()){
      if(branch.tier<1+index*4)break;
      const bough=svg('g',{class:'destiny-bough'});
      bough.append(svg('path',{d:trace,class:'destiny-new-wood'}));
      const leaves=Math.min(4,Math.max(0,branch.tier-index*3-1));
      for(let n=0;n<leaves;n++){
        const scale=.50+(branch.tier-n)*.055;
        const crown=svg('g',{transform:`translate(${x+n*9} ${y+(n%2?-11:5)}) rotate(${angle+n*21}) scale(${scale})`});
        crown.append(svg('path',{d:motifs[kind],class:'destiny-crown '+kind}));
        bough.append(crown);
      }
      group.append(bough);
    }
    return group;
  }

  function artImage(name) {
    return svg('image',{href:art+name,width,height,'pointer-events':'none'});
  }

  function drawVeins(layer, branch, shape, distant) {
    const lines=svg('g',{class:'destiny-veins','data-direction':branch.id,'data-state':branch.state});
    lines.style.setProperty('--vein-life',String(.54+branch.warmth*.115));
    const trace=distant&&shape.horizonVein?shape.horizonVein:shape.vein;
    lines.append(svg('path',{d:trace,class:'destiny-vein-glow'}),svg('path',{d:trace,class:'destiny-vein-core'}));
    if(branch.state===2)lines.append(svg('path',{d:trace,class:'destiny-vein-sparks'}));
    if(branch.extra.length) lines.append(svg('path',{d:shape.fork,class:'destiny-vein-glow destiny-secret'}),svg('path',{d:shape.fork,class:'destiny-vein-core destiny-secret'}));
    layer.append(lines);
    return lines;
  }

  function chainArt(points, id) {
    const [a,b,c]=points;
    const chain=svg('g',{class:'destiny-chain','data-direction':id});
    const length=Math.hypot(c[0]-a[0],c[1]-a[1]);
    const count=Math.ceil(length/19);
    for(let i=0;i<=count;i++){
      const t=i/count,u=1-t;
      const x=u*u*a[0]+2*u*t*b[0]+t*t*c[0], y=u*u*a[1]+2*u*t*b[1]+t*t*c[1];
      const angle=Math.atan2(u*(b[1]-a[1])+t*(c[1]-b[1]),u*(b[0]-a[0])+t*(c[0]-b[0]))*180/Math.PI;
      const link=svg('g',{class:i<2||i>count-2?'destiny-chain-tip':'destiny-chain-link',transform:'translate('+x+' '+y+') rotate('+angle+')'});
      const ring={rx:i%2?10:12,ry:i%2?3.6:7.5};
      link.append(svg('ellipse',{...ring,class:'destiny-link-shadow'}),svg('ellipse',{...ring,class:'destiny-link-metal'}));
      if(i===Math.floor(count/2)||i%3===0)link.append(svg('path',{class:'destiny-chain-crack',d:'M-4-8l-2 6 5 4-2 7M2-7L0-4l4 3'}));
      chain.append(link);
    }
    return chain;
  }

  function horizonArt(horizon) {
    horizon.append(artImage('destiny-tree.svg'));
    const layer=svg('g');
    const heart=heartArt('horizon-tree',true);
    heart.group.insertBefore(layer,heart.flow);
    horizon.append(heart.group);
    return model=>{
      heart.sync(model);
      layer.replaceChildren();
      for(const branch of model.branches){
        const shape=layout[branch.id];
        layer.append(drawWood(branch));
        drawVeins(layer,branch,shape,true);
        if(branch.tier<12){
          const [a,b,c]=shape.chain, edge=(12-branch.tier)/24;
          layer.append(svg('path',{d:`M${a.join(' ')}Q${b.join(' ')} ${c.join(' ')}`,
            class:'destiny-horizon-chain',pathLength:1,'stroke-dasharray':`${edge} ${1-edge*2} ${edge}`}));
        }
      }
    };
  }

  function cameraFor(map, foreground, background, tools) {
    const pointers=new Map();
    let x=0,y=0,scale=1,drag=false;
    const center=[width/2,height/2];
    function draw(nx,ny,nz) {
      scale=Math.max(1,Math.min(2.7,nz));
      x=Math.max(width*(1-scale),Math.min(0,nx));
      y=Math.max(height*(1-scale),Math.min(0,ny));
      foreground.setAttribute('transform','translate('+x+' '+y+') scale('+scale+')');
      background.setAttribute('transform','translate('+x*.18+' '+y*.18+') scale('+(1+(scale-1)*.18)+')');
      map.dataset.zoom=String(scale);
    }
    function zoom(factor, from=center, to=from) {
      const next=Math.max(1,Math.min(2.7,scale*factor));
      const ratio=next/scale;
      draw(to[0]-(from[0]-x)*ratio,to[1]-(from[1]-y)*ratio,next);
    }
    function point(event) {
      const coords=map.createSVGPoint();
      coords.x=event.clientX;coords.y=event.clientY;
      const local=coords.matrixTransform(map.getScreenCTM().inverse());
      return [local.x,local.y];
    }
    function gesture() {
      const [a,b]=pointers.values();
      return b?{at:[(a[0]+b[0])/2,(a[1]+b[1])/2],distance:Math.hypot(a[0]-b[0],a[1]-b[1])}:{at:a,distance:0};
    }
    map.addEventListener('pointerdown',event=>{
      if(event.button!==0||pointers.size===2)return;
      if(!pointers.size)drag=false;
      pointers.set(event.pointerId,point(event));
      if(pointers.size===2)drag=true;
      event.target.setPointerCapture(event.pointerId);
    });
    map.addEventListener('pointermove',event=>{
      if(!pointers.has(event.pointerId))return;
      const before=gesture(), next=point(event);
      if(!drag&&Math.hypot(next[0]-before.at[0],next[1]-before.at[1])<10)return;
      drag=true;pointers.set(event.pointerId,next);
      const after=gesture();
      zoom(before.distance&&after.distance?after.distance/before.distance:1,before.at,after.at);
    });
    for(const name of ['pointerup','pointercancel','lostpointercapture'])map.addEventListener(name,event=>pointers.delete(event.pointerId));
    map.addEventListener('click',event=>{if(drag&&event.detail!==0){event.preventDefault();event.stopPropagation();}},true);
    map.addEventListener('wheel',event=>{event.preventDefault();zoom(event.deltaY<0?1.13:1/1.13,point(event));},{passive:false});
    tools.querySelector('[data-destiny-zoom="in"]').onclick=()=>zoom(1.3);
    tools.querySelector('[data-destiny-zoom="out"]').onclick=()=>zoom(1/1.3);
    const reset=()=>{pointers.clear();drag=false;draw(0,0,1);};
    tools.querySelector('[data-destiny-zoom="reset"]').onclick=reset;
    return reset;
  }

  function mount(dialog, horizon, home, suspendCastle) {
    const syncHorizon=horizonArt(horizon);
    const reduce=matchMedia('(prefers-reduced-motion: reduce)');
    const map=dialog.querySelector('.destiny-world-art');
    const far=map.querySelector('.destiny-world-far'), near=map.querySelector('.destiny-world-near');
    const lights=svg('g',{class:'destiny-castle-windows'});
    windows.forEach(([x,y])=>lights.append(svg('path',{d:'M'+x+' '+y+'l2-4 2 4v5h-4z',class:'destiny-window'})));
    const renewal=svg('g',{class:'destiny-castle-renewal','aria-hidden':'true'});
    renewal.append(
      svg('path',{'data-tier':1,d:'M628 420v20m33-50v36m29 7v22'}),
      svg('path',{'data-tier':2,d:'M599 445v19m119-10v20M613 472h16m49 5h20'}),
      svg('path',{'data-tier':3,d:'M650 474v-14l9-7 9 7v14m-34 12h50'})
    );
    const skyline=home.querySelector('.citadel-sky');
    const nearLights=document.createElement('div');
    nearLights.className='citadel-renewal';
    nearLights.setAttribute('aria-hidden','true');
    skyline.append(nearLights);
    far.append(artImage('destiny-valley.svg'),renewal,lights,
      svg('path',{class:'destiny-haze',d:'M34 553q176-28 313 0t418-51m-752 86q197-30 351 0t424-39M57 621q174-25 315 5t375-33'}));
    const wood=svg('g',{class:'destiny-living-wood'}), veins=svg('g'), chains=svg('g'), seals=svg('g',{class:'destiny-world-seals'});
    const embers=svg('g',{class:'destiny-embers','aria-hidden':'true'});
    for(const [x,y] of [[89,633],[153,720],[193,488],[267,588],[310,536],[347,648],[455,702],[517,587],[556,690],[614,517],[687,641],[733,583]]){
      embers.append(svg('path',{d:'M'+x+' '+y+'l2-4 2 4-2 3z'}));
    }
    const heart=heartArt('near-tree');
    heart.group.insertBefore(wood,heart.flow);
    heart.group.insertBefore(veins,heart.flow);
    near.append(artImage('destiny-tree.svg'),heart.group,chains,seals,embers);
    const reset=cameraFor(map,near,far,dialog);
    const close=dialog.querySelector('.destiny-world-back');
    const tabs=dialog.querySelector('.destiny-branches'), nodeList=dialog.querySelector('.destiny-node-list');
    const heading=dialog.querySelector('.destiny-branch-title'), phase=dialog.querySelector('.destiny-branch-phase');
    const stageLabel=dialog.querySelector('.destiny-awakening-label');
    const desc=dialog.querySelector('.destiny-node-description'), status=dialog.querySelector('.destiny-status');
    const fog=document.getElementById('destiny-travel-fog');
    const pending=new Map(), visuals=new Map();
    let stageWave=false;
    let model=null, signature='', branchId='body', nodeId='', timer=0, travelling=false, opener=null;

    for(const [id,shape] of Object.entries(layout)){
      const chain=chainArt(shape.chain,id);
      chains.append(chain);
      const tab=document.createElement('button');
      tab.type='button';tab.dataset.direction=id;
      tab.onclick=()=>select(id);
      tabs.append(tab);
      visuals.set(id,{chain,tab});
    }

    function select(id, target) {
      if(!model)return;
      if(id!==branchId)nodeId='';
      branchId=id;
      const branch=model.branches.find(row=>row.id===id), nodes=branch.nodes.concat(branch.extra);
      const selected=nodes.find(node=>node.id===(target||nodeId))||nodes.find(node=>node.open)||nodes[0];
      nodeId=selected?.id||'';
      heading.textContent=branch.label;
      const growth=['Сухая кора','Первые побеги','Живая древесина','Крона пробуждена'][Math.ceil(branch.tier/4)];
      phase.textContent=states[branch.state]+' · '+branch.opened+' / '+branch.nodes.length+' печатей · '+growth;
      desc.textContent=selected ? selected.name+' · '+(selected.open?'Открыто. ':'')+selected.description : 'Записи проявятся, когда загрузится профиль.';
      tabs.querySelectorAll('button').forEach(tab=>tab.setAttribute('aria-pressed',String(tab.dataset.direction===id)));
      seals.querySelectorAll('[role="button"]').forEach(seal=>seal.setAttribute('aria-pressed',String(seal.dataset.node===nodeId)));
      const focused=nodeList.contains(document.activeElement)?document.activeElement.dataset.node:null;
      nodeList.replaceChildren(...nodes.map((node,index)=>{
        const button=document.createElement('button');
        button.type='button';button.textContent=String(index+1);button.dataset.node=node.id;
        button.setAttribute('aria-label',node.name+(node.open?' · открыто':''));
        button.setAttribute('aria-pressed',String(node.id===nodeId));button.classList.toggle('is-open',node.open);
        button.onclick=()=>select(id,node.id);
        return button;
      }));
      if(focused)Array.from(nodeList.children).find(button=>button.dataset.node===focused)?.focus({preventScroll:true});
    }

    function playPending() {
      if(!dialog.open||document.hidden)return;
      if(stageWave&&!reduce.matches)restartAnimation(heart.wave,'is-rising');
      stageWave=false;
      if(!reduce.matches&&pending.size>1)wood.classList.add('is-awakening');
      for(const [id,event] of pending){
        const {chain,line,bark}=visuals.get(id);
        if(!reduce.matches){
          if(event.seal){
            if(chain.querySelector('.is-fragment'))restartAnimation(chain,'is-breaking');
            line.classList.add('is-surging');
            restartAnimation(heart.flow.querySelector('[data-direction="'+id+'"]'),'is-flowing');
          }
          bark.classList.add('is-growing');
        }else chain.querySelectorAll('.is-fragment').forEach(link=>link.classList.remove('is-fragment'));
        status.textContent=(event.release?'Цепь разомкнулась':event.seal?'Печать пробудила древесину':'Появились новые побеги')+' · '+model.branches.find(branch=>branch.id===id).label;
      }
      pending.clear();
    }
    chains.addEventListener('animationend',event=>{
      if(event.animationName!=='destiny-chain-break')return;
      const chain=event.target.closest('.is-breaking');
      event.target.classList.remove('is-fragment');
      if(chain&&!chain.querySelector('.is-fragment'))chain.classList.remove('is-breaking');
    });
    veins.addEventListener('animationend',event=>{
      if(event.animationName==='destiny-vein-surge')event.target.closest('.is-surging')?.classList.remove('is-surging');
    });
    wood.addEventListener('animationend',event=>{
      if(event.animationName==='destiny-grow')event.target.classList.remove('is-growing');
      if(event.animationName==='destiny-awakening')wood.classList.remove('is-awakening');
    });
    function restartAnimation(node,name){
      if(node.classList.contains(name)){
        node.classList.remove(name);
        node.getBoundingClientRect();
      }
      node.classList.add(name);
    }
    heart.group.addEventListener('animationend',event=>{
      if(event.animationName==='destiny-heart-current')event.target.classList.remove('is-flowing');
      if(event.animationName==='destiny-trunk-rise')event.target.classList.remove('is-rising');
    });
    function stopRelease(){
      const transient=['is-breaking','is-surging','is-growing','is-awakening','is-flowing','is-rising','is-fragment'];
      dialog.querySelectorAll(transient.map(name=>'.'+name).join(',')).forEach(el=>el.classList.remove(...transient));
    }
    reduce.addEventListener('change',()=>{if(reduce.matches)stopRelease();});

    function sync(next) {
      const stamp=JSON.stringify(next);
      if(signature===stamp)return;
      signature=stamp;
      syncHorizon(next);
      heart.sync(next);
      stageLabel.textContent=stages[next.awakening.stage]+' · '+next.awakening.percent+'%';
      if(model&&next.awakening.stage>model.awakening.stage)stageWave=true;
      skyline.dataset.restoration=renewal.dataset.restoration=next.restoration;
      Array.from(lights.children).forEach((lamp,index)=>lamp.classList.toggle('is-lit',index<next.lamps));
      // Commit animation only for a new change seen in this session, never for a loaded snapshot.
      for(const branch of next.branches){
        const previous=model?.branches.find(row=>row.id===branch.id);
        const newSeal=previous&&(branch.opened>previous.opened||
          branch.extra.some(node=>node.open&&!previous.extra.some(old=>old.id===node.id&&old.open)));
        if(previous&&(newSeal||branch.tier>previous.tier)){
          const prior=pending.get(branch.id);
          pending.set(branch.id,{release:prior?.release||branch.state===2&&previous.state<2,
            seal:prior?.seal||newSeal});
        }
        const visual=visuals.get(branch.id);
        visual.tab.textContent=branch.label;
        visual.tab.dataset.state=branch.state;
        visual.chain.dataset.state=branch.state;
        visual.chain.style.setProperty('--wear',String(branch.tier/12));
        const links=visual.chain.querySelectorAll('.destiny-chain-link');
        const missing=Math.floor(links.length*branch.tier/12);
        links.forEach((link,index)=>{
          const distance=Math.abs(index-(links.length-1)/2);
          const gone=distance<missing/2;
          if(newSeal&&gone&&!link.classList.contains('is-gone'))link.classList.add('is-fragment');
          if(!gone)link.classList.remove('is-fragment');
          link.classList.toggle('is-gone',gone);
          link.classList.toggle('is-eroded',branch.tier>=2&&distance<(missing+4)/2);
        });
      }
      model=next;
      veins.replaceChildren();
      wood.replaceChildren();
      embers.style.opacity=String(.10+next.branches.reduce((sum,branch)=>sum+branch.warmth,0)*.018);
      const focus=seals.contains(document.activeElement)?document.activeElement.dataset.node:null;
      seals.replaceChildren();
      for(const branch of next.branches){
        const shape=layout[branch.id],visual=visuals.get(branch.id);
        visual.bark=drawWood(branch);
        wood.append(visual.bark);
        visual.line=drawVeins(veins,branch,shape);
        for(const node of branch.nodes.concat(branch.extra)){
          const seal=svg('g',{class:'destiny-seal'+(node.open?' is-open':''),'data-direction':branch.id,
            role:'button',tabindex:0,'aria-label':node.name+(node.open?' · открыто':''),transform:'translate('+node.point.join(' ')+')'});
          seal.dataset.node=node.id;
          seal.append(svg('circle',{class:'destiny-hit',r:25}),svg('path',{class:'destiny-stone',d:stone}),
            svg('path',{class:'destiny-rune',d:node.open?branch.glyph:'M-5-1H5V7H-5ZM-3-1V-6H3V-1'}));
          seal.addEventListener('click',()=>select(branch.id,node.id));
          seal.addEventListener('keydown',event=>{
            if(event.key==='Enter'||event.key===' '){event.preventDefault();select(branch.id,node.id);}
          });
          seals.append(seal);
        }
      }
      select(branchId,nodeId);
      if(focus)Array.from(seals.children).find(seal=>seal.dataset.node===focus)?.focus({preventScroll:true});
      playPending();
    }

    function clearTravel() {
      clearTimeout(timer);
      timer=0;
      travelling=false;
      fog.hidden=true;
      home.classList.remove('destiny-departure');
    }
    function leave() {
      clearTravel();
      dialog.classList.remove('is-returning');
      if(dialog.open)dialog.close();
      delete document.documentElement.dataset.destinyScene;
      suspendCastle(false);
      stopRelease();
      status.textContent='';
      if(!reduce.matches){
        home.classList.add('destiny-homecoming');
        setTimeout(()=>home.classList.remove('destiny-homecoming'),440);
      }
      const target=opener?.getClientRects().length?opener:home.querySelector('.citadel-map-toggle');
      target?.focus({preventScroll:true});
    }
    function back() {
      if(!dialog.open||travelling)return;
      travelling=true;
      if(!history.state?.destinyWorld){leave();return;}
      if(reduce.matches){history.back();return;}
      dialog.classList.add('is-returning');
      timer=setTimeout(()=>history.back(),350);
    }
    function enter() {
      clearTravel();reset();
      document.documentElement.dataset.destinyScene='active';
      dialog.showModal();
      suspendCastle(true);
      dialog.scrollTop=0;
      close.focus({preventScroll:true});
      playPending();
    }
    function open(trigger) {
      if(dialog.open||travelling||!model)return;
      opener=trigger;
      travelling=true;
      home.classList.remove('destiny-homecoming');
      history.pushState({...history.state,destinyWorld:true},'');
      if(reduce.matches){enter();return;}
      fog.hidden=false;home.classList.add('destiny-departure');
      timer=setTimeout(enter,340);
    }
    close.onclick=back;
    dialog.addEventListener('cancel',event=>{event.preventDefault();back();});
    dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();back();}});
    document.addEventListener('visibilitychange',()=>{
      dialog.classList.toggle('is-background',document.hidden);
      if(document.hidden)stopRelease();else playPending();
    });
    window.addEventListener('popstate',event=>{
      if(event.state?.destinyWorld&&model){
        event.stopImmediatePropagation();
        if(!dialog.open&&!travelling)enter();
      }else if(dialog.open||travelling){
        event.stopImmediatePropagation();
        leave();
      }
    },true);
    return {sync,open};
  }

  root.VkachDestinyWorld=Object.freeze({project,mount,snapshot,historicalAppearance,stages:Object.freeze(stages)});
})(globalThis);
