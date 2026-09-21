(function(){
  var ic={
    home:'<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/></svg>',
    map:'<svg viewBox="0 0 24 24"><path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/></svg>',
    add:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    stats:'<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>',
    settings:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
  };
  var tabs=[['home','ホーム'],['map','マップ'],['add',''],['stats','好み'],['settings','設定']];
  document.querySelectorAll('.a-tab,.ios-tab').forEach(function(n){
    var act=n.getAttribute('data-active');
    n.innerHTML=tabs.map(function(t){
      if(t[0]==='add') return '<a class="fab" href="#screens" aria-label="記録を追加"><span>'+ic.add+'</span></a>';
      return '<a href="#screens" class="'+(t[0]===act?'on':'')+'">'+ic[t[0]]+t[1]+'</a>';
    }).join('');
  });
  var sb='<svg viewBox="0 0 56 14"><rect x="0" y="8" width="3" height="6" rx="1"/><rect x="5" y="6" width="3" height="8" rx="1"/><rect x="10" y="4" width="3" height="10" rx="1"/><rect x="15" y="2" width="3" height="12" rx="1"/><path d="M23 6.5a7 7 0 0 1 10 0l-1.4 1.4a5 5 0 0 0-7.2 0zM25.8 9.3a3 3 0 0 1 4.4 0L28 11.5z"/><rect x="37" y="2.5" width="16" height="9" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="38.5" y="4" width="11" height="6" rx="1.2"/><rect x="54" y="5" width="1.5" height="4" rx=".7"/></svg>';
  document.querySelectorAll('.a-status').forEach(function(n){ n.innerHTML='<span>9:41</span>'+sb; });
  document.querySelectorAll('.st').forEach(function(n){
    var v=parseFloat(n.getAttribute('data-v')||'0'),h='';
    for(var i=1;i<=5;i++){ h+='<i class="'+(v>=i?'f':(v>=i-0.5?'h':''))+'"></i>'; }
    n.innerHTML=h; n.setAttribute('aria-label',v+' / 5');
  });
  var axes=['Flavor','Sweetness','Acidity','After taste','Body'];
  document.querySelectorAll('.tc').forEach(function(n){
    var vs=(n.getAttribute('data-v')||'').split(',');
    n.innerHTML=axes.map(function(a,i){
      var v=parseInt(vs[i]||'0',10),d='';
      for(var k=1;k<=5;k++){ d+='<i class="'+(k<=v?'on':'')+'"></i>'; }
      return '<div class="r"><span>'+a+'</span><div class="d">'+d+'</div><b>'+(v||'—')+'</b></div>';
    }).join('');
  });
  function fitDesktop(){
    document.querySelectorAll('.dt').forEach(function(d){
      var inner=d.querySelector('.dtin'); if(!inner) return;
      var s=d.clientWidth/1440; inner.style.transform='scale('+s+')'; d.style.height=Math.round(900*s)+'px';
    });
  }
  fitDesktop(); window.addEventListener('resize',fitDesktop);
})();
