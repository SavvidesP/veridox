import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createChart } from 'lightweight-charts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, TrendingUp, X, ChevronDown, ChevronRight, Search, BarChart2, Plus, Check, MousePointer2, Crosshair, Minus, Square, Circle, Triangle, Type, Ruler, ZoomIn, Magnet, Trash2, Undo2, Sun, Moon } from 'lucide-react';
const TWELVE_KEY  = '05ee6ae8c5ca41c0a9556a99c91debf9';
const C_LIGHT = {
  bg:'#ffffff',panel:'#f8f9fb',panel2:'#f0f3f5',border:'#e0e3eb',border2:'#d0d3dc',
  text:'#131722',muted:'#787b86',muted2:'#b2b5be',accent:'#2962ff',
  green:'#089981',red:'#f23645',
  greenBg:'rgba(8,153,129,0.1)',redBg:'rgba(242,54,69,0.1)',accentBg:'rgba(41,98,255,0.1)',
};
// TradingView-style dark palette
const C_DARK = {
  bg:'#131722',panel:'#1e222d',panel2:'#2a2e39',border:'#2a2e39',border2:'#363a45',
  text:'#d1d4dc',muted:'#787b86',muted2:'#5d606b',accent:'#2962ff',
  green:'#26a69a',red:'#ef5350',
  greenBg:'rgba(38,166,154,0.15)',redBg:'rgba(239,83,80,0.15)',accentBg:'rgba(41,98,255,0.18)',
};
const SYMBOL_META = {
  'EUR/USD':{ bg:'#1a6dd4',short:'€', cls:'forex'  },
  'GBP/USD':{ bg:'#7b4ea0',short:'£', cls:'forex'  },
  'USD/JPY':{ bg:'#c0392b',short:'¥', cls:'forex'  },
  'XAU/USD':{ bg:'#d4a017',short:'AU',cls:'forex'  },
  'BTC/USD':{ bg:'#f7931a',short:'₿', cls:'crypto' },
  'ETH/USD':{ bg:'#627eea',short:'Ξ', cls:'crypto' },
  'AAPL':   { bg:'#555555',short:'',  cls:'stocks' },
  'TSLA':   { bg:'#e31937',short:'T', cls:'stocks' },
  'NVDA':   { bg:'#76b900',short:'N', cls:'stocks' },
  'MSFT':   { bg:'#00a4ef',short:'M', cls:'stocks' },
  'SPY':    { bg:'#e31837',short:'S', cls:'stocks' },
  'QQQ':    { bg:'#0068ff',short:'Q', cls:'stocks' },
};
// App interval value → Twelve Data interval + client-side aggregation factor.
// Twelve supports up to 1month, so 3M/6M/1Y are built by aggregating monthly bars.
const TD_INTERVAL = {
  '1min':  { td:'1min',  agg:1  }, '5min':  { td:'5min',  agg:1  },
  '15min': { td:'15min', agg:1  }, '1h':    { td:'1h',    agg:1  },
  '4h':    { td:'4h',    agg:1  }, '1day':  { td:'1day',  agg:1  },
  '1week': { td:'1week', agg:1  }, '1month':{ td:'1month',agg:1  },
  '3month':{ td:'1month',agg:3  }, '6month':{ td:'1month',agg:6  },
  '1year': { td:'1month',agg:12 },
};
function tdInterval(iv){ return (TD_INTERVAL[iv] || TD_INTERVAL['5min']).td; }
function tdAgg(iv){ return (TD_INTERVAL[iv] || {}).agg || 1; }
function outputSize(iv){
  // Smaller initial pulls = faster first paint; infinite scroll fetches more on demand.
  const m = { '1min':600,'5min':500,'15min':500,'1h':500,'4h':500,'1day':500,'1week':400,'1month':300,'3month':300,'6month':300,'1year':300 };
  return m[iv] || 500;
}
// Group n ascending bars into one OHLC bar (for quarterly/semiannual/yearly candles).
function aggregateBars(candles, volumes, n){
  if (n <= 1) return { candles, volumes };
  const c = [], v = [];
  for (let i = 0; i < candles.length; i += n) {
    const ch = candles.slice(i, i + n), vh = volumes.slice(i, i + n);
    if (!ch.length) continue;
    c.push({ time: ch[0].time, open: ch[0].open, high: Math.max(...ch.map(x=>x.high)), low: Math.min(...ch.map(x=>x.low)), close: ch[ch.length-1].close });
    v.push({ time: ch[0].time, value: vh.reduce((s,x)=>s+(x.value||0),0), color: ch[ch.length-1].close >= ch[0].open ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)' });
  }
  return { candles: c, volumes: v };
}
function twelveTimestamp(datetime, interval) {
  const isDailyPlus = ['1day','1week','1month','3month','6month','1year'].includes(interval);
  if (isDailyPlus) {
    return datetime.slice(0, 10);
  }
  // We request timezone=UTC, but Twelve datetimes have no 'Z' suffix → force UTC parse
  // (otherwise the browser reads them as local time and the chart clock is wrong).
  return Math.floor(Date.parse(datetime.replace(' ', 'T') + 'Z') / 1000);
}
// Fetch OHLC candles for any asset from Twelve Data. endDate (optional) pages older data.
// Returns ascending {candles, volumes} plus the oldest raw datetime for further paging.
async function fetchTwelveSeries(sym, interval, endDate) {
  const td = tdInterval(interval), agg = tdAgg(interval);
  let url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(sym)}&interval=${td}&outputsize=${outputSize(interval) * agg}&timezone=UTC&apikey=${TWELVE_KEY}`;
  if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;
  const data = await (await fetch(url)).json();
  if (!data.values?.length) return null;
  const sorted = [...data.values].reverse(); // Twelve returns newest-first → ascending
  let candles = sorted.map(v => ({ time: twelveTimestamp(v.datetime, interval), open: +v.open, high: +v.high, low: +v.low, close: +v.close }));
  let volumes = sorted.map(v => ({ time: twelveTimestamp(v.datetime, interval), value: parseFloat(v.volume) || 0, color: +v.close >= +v.open ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)' }));
  const oldestDatetime = sorted[0].datetime;
  if (agg > 1) ({ candles, volumes } = aggregateBars(candles, volumes, agg));
  return { candles, volumes, oldestDatetime };
}
// Real asset logos (TradingView-style): stocks via FMP, crypto/forex via Twelve's CDN.
// Forex pairs render two overlapping flags; metals (XAU/XAG) have no flag → colored fallback.
const METALS = ['xau','xag','xpt','xpd'];
const FIATS = ['usd','eur','gbp','jpy','aud','cad','chf','nzd','cnh','cny','hkd','sgd','sek','nok','dkk','mxn','zar','try','inr','rub','pln','thb','krw','huf','czk','ils','clp','php','aed','sar'];
// Resolve the asset class for ANY symbol: explicit hint → SYMBOL_META → infer from format.
function classOf(symbol, cls){
  if(cls) return cls;
  if(SYMBOL_META[symbol]) return SYMBOL_META[symbol].cls;
  if(!symbol.includes('/')) return 'stocks';      // no "/" ⇒ a stock/ETF ticker
  const base = symbol.split('/')[0].toLowerCase();
  if(METALS.includes(base)) return 'forex';
  return FIATS.includes(base) ? 'forex' : 'crypto'; // fiat base ⇒ forex, else crypto
}
function logoFor(symbol, cls){
  const c = classOf(symbol, cls);
  const sym = symbol.toUpperCase();
  const base = symbol.split('/')[0].toLowerCase();
  if(c==='stocks') return { single:[
    `https://financialmodelingprep.com/image-stock/${encodeURIComponent(sym)}.png`,
    `https://s3-symbol-logo.tradingview.com/${base}.svg`,
  ] };
  if(c==='crypto') return { single:[`https://logo.twelvedata.com/crypto/${base}.png`] };
  if(c==='forex'){
    const [b,q]=symbol.split('/').map(s=>s.toLowerCase());
    // Metals (gold/silver/etc.) have an official commodity logo, not a flag.
    if(METALS.includes(b)) return { single:[`https://logo.twelvedata.com/commodity/${b}.png`,`https://financialmodelingprep.com/image-stock/${sym.replace('/','')}.png`] };
    if(METALS.includes(q)) return { single:[`https://logo.twelvedata.com/commodity/${q}.png`] };
    return { pair:[`https://logo.twelvedata.com/forex/${b}.png`,`https://logo.twelvedata.com/forex/${q}.png`] };
  }
  return null;
}
function SymbolLogo({ symbol, size = 20, cls }) {
  const meta = SYMBOL_META[symbol] || { bg:'#787b86', short:(symbol?.replace('/','')?.slice(0,2)||'?').toUpperCase() };
  const logo = logoFor(symbol, cls);
  const singles = logo?.single || null;
  const [idx,setIdx]=useState(0);     // which candidate URL we're trying (single logos)
  const [pairErr,setPairErr]=useState(false);
  useEffect(()=>{ setIdx(0); setPairErr(false); },[symbol]); // reset when the symbol changes
  if(singles && idx < singles.length){
    return <img src={singles[idx]} alt={symbol} onError={()=>setIdx(i=>i+1)} style={{ width:size, height:size, borderRadius:'50%', objectFit:'contain', flexShrink:0, background:'#fff' }} />;
  }
  if(logo?.pair && !pairErr){
    const s2=Math.round(size*0.66);
    return (
      <div style={{ width:size, height:size, position:'relative', flexShrink:0 }}>
        <img src={logo.pair[0]} alt="" onError={()=>setPairErr(true)} style={{ width:s2, height:s2, borderRadius:'50%', objectFit:'cover', position:'absolute', top:0, left:0, background:'#fff' }} />
        <img src={logo.pair[1]} alt="" onError={()=>setPairErr(true)} style={{ width:s2, height:s2, borderRadius:'50%', objectFit:'cover', position:'absolute', bottom:0, right:0, background:'#fff', boxShadow:'0 0 0 1.5px #fff' }} />
      </div>
    );
  }
  return (
    <div style={{ width:size,height:size,borderRadius:'50%',background:meta.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:size*0.4,fontWeight:'700',color:'white',fontFamily:'Inter,sans-serif',letterSpacing:'-0.5px' }}>
      {meta.short}
    </div>
  );
}
const DEFAULT_SYMBOLS = [
  { symbol:'EUR/USD',label:'Euro / US Dollar', type:'Forex',  change:'+0.02%',up:true  },
  { symbol:'GBP/USD',label:'Pound / US Dollar',type:'Forex',  change:'-0.08%',up:false },
  { symbol:'USD/JPY',label:'US Dollar / Yen',  type:'Forex',  change:'+0.12%',up:true  },
  { symbol:'XAU/USD',label:'Gold',             type:'Forex',  change:'+0.34%',up:true  },
  { symbol:'BTC/USD',label:'Bitcoin / USD',    type:'Crypto', change:'+1.24%',up:true  },
  { symbol:'ETH/USD',label:'Ethereum / USD',   type:'Crypto', change:'-0.55%',up:false },
  { symbol:'AAPL',   label:'Apple Inc.',        type:'Stocks', change:'-0.41%',up:false },
  { symbol:'TSLA',   label:'Tesla Inc.',        type:'Stocks', change:'+2.11%',up:true  },
  { symbol:'NVDA',   label:'NVIDIA Corp.',      type:'Stocks', change:'+3.05%',up:true  },
  { symbol:'MSFT',   label:'Microsoft Corp.',   type:'Stocks', change:'+0.18%',up:true  },
  { symbol:'SPY',    label:'S&P 500 ETF',       type:'Indices',change:'+0.09%',up:true  },
  { symbol:'QQQ',    label:'Nasdaq 100 ETF',    type:'Indices',change:'+0.22%',up:true  },
];
const INTERVALS = [
  {label:'1m', value:'1min'  },
  {label:'5m', value:'5min'  },
  {label:'15m',value:'15min' },
  {label:'1h', value:'1h'    },
  {label:'4h', value:'4h'    },
  {label:'1D', value:'1day'  },
  {label:'1W', value:'1week' },
  {label:'1M', value:'1month'},
  {label:'3M', value:'3month'},
  {label:'6M', value:'6month'},
  {label:'1Y', value:'1year' },
];
const INTERVAL_GROUPS = [
  { label:'Minutes', options:['1m','5m','15m'] },
  { label:'Hours',   options:['1h','4h']        },
  { label:'Days+',   options:['1D','1W','1M','3M','6M','1Y'] },
];
const LEFT_TOOLS = [
  { icon:<Undo2 size={17} />, title:'Back', group:0 },
  { icon:<MousePointer2 size={17} />, title:'Cursor', group:1 },
  { icon:<Crosshair size={17} />, title:'Crosshair', group:1 },
  { icon:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="19" x2="19" y2="5"/><circle cx="5" cy="19" r="2" fill="currentColor" stroke="none"/><circle cx="19" cy="5" r="2" fill="currentColor" stroke="none"/></svg>, title:'Trend Line', group:2 },
  { icon:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="12" x2="20" y2="12"/><circle cx="4" cy="12" r="2" fill="currentColor" stroke="none"/><polyline points="16,8 20,12 16,16"/></svg>, title:'Horizontal Ray', group:2 },
  { icon:<Minus size={17} />, title:'Horizontal Line', group:2 },
  { icon:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="4" x2="12" y2="20"/></svg>, title:'Vertical Line', group:2 },
  { icon:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="4" y1="5" x2="20" y2="5"/><line x1="4" y1="10" x2="20" y2="10"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="4" y1="20" x2="20" y2="20"/></svg>, title:'Fib Retracement', group:3 },
  { icon:<Square size={16} />, title:'Rectangle', group:4 },
  { icon:<Circle size={16} />, title:'Ellipse', group:4 },
  { icon:<Triangle size={16} />, title:'Triangle', group:4 },
  { icon:<Type size={16} />, title:'Text', group:5 },
  { icon:<Ruler size={16} />, title:'Measure', group:6 },
  { icon:<ZoomIn size={16} />, title:'Zoom', group:6 },
  { icon:<Magnet size={16} />, title:'Magnet', group:7 },
  { icon:<Trash2 size={16} />, title:'Remove All', group:8 },
];
function fmt(n,d=5){return n!=null?Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';}
function fmtP(n){const a=Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});return n>=0?`+$${a}`:`-$${a}`;}
function fmtUSD(n){return n!=null?`$${Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`:'—';}
function useIsMobile(){
  const[v,set]=useState(window.innerWidth<768);
  useEffect(()=>{const h=()=>set(window.innerWidth<768);window.addEventListener('resize',h);return()=>window.removeEventListener('resize',h);},[]);
  return v;
}
// Live prices from Twelve. /price is a real-time tick (updates every few seconds) so we
// poll it FAST for the price; /quote.close lags (steps every ~10-15s), so we poll it SLOW
// only for the slow-changing fields (prev close, % change, market open). On Grow (377
// credits/min): 12 prices/3s = 240 + 12 quotes/60s = 12 → ~252/min, within budget.
function useLivePrices(symbols){
  const[prices,setPrices]=useState({});
  const[quotes,setQuotes]=useState({});
  useEffect(()=>{
    if(!symbols.length) return;
    let cancelled=false;
    const symParam=symbols.map(encodeURIComponent).join(',');
    const pollPrices=async()=>{
      try{
        const data=await (await fetch(`https://api.twelvedata.com/price?symbol=${symParam}&apikey=${TWELVE_KEY}`)).json();
        if(cancelled) return;
        const apply=(s,o)=>{ const p=parseFloat(o?.price); if(!isNaN(p)) setPrices(prev=>({...prev,[s]:p})); };
        if(symbols.length===1) apply(symbols[0],data);
        else symbols.forEach(s=>apply(s,data[s]));
      }catch{}
    };
    const pollQuotes=async()=>{
      try{
        const data=await (await fetch(`https://api.twelvedata.com/quote?symbol=${symParam}&apikey=${TWELVE_KEY}`)).json();
        if(cancelled) return;
        const apply=(s,q)=>{ if(!q||q.status==='error'||q.previous_close==null) return; setQuotes(prev=>({...prev,[s]:{prevClose:parseFloat(q.previous_close),percentChange:parseFloat(q.percent_change),close:parseFloat(q.close),isOpen:q.is_market_open}})); };
        if(symbols.length===1) apply(symbols[0],data);
        else symbols.forEach(s=>apply(s,data[s]));
      }catch{}
    };
    // Debounce the first poll: the symbol set changes rapidly on load / symbol-switch
    // (watchlist + selected + positions). Without this each change fires an immediate
    // /price + /quote, bursting past the rate limit (429). Wait for the set to settle.
    const warmup=setTimeout(()=>{ pollPrices(); pollQuotes(); }, 500);
    const idP=setInterval(pollPrices,5000); // 12 symbols × 12/min = 144 credits/min (Grow cap is 377)
    const idQ=setInterval(pollQuotes,60000);
    return()=>{cancelled=true;clearTimeout(warmup);clearInterval(idP);clearInterval(idQ);};
  },[symbols.join(',')]);
  return {prices,quotes};
}
// % change vs the day's previous close, live when a streaming price is available
function dayChangePct(sym,livePrice,quote){
  if(!quote) return null;
  const cur=livePrice??quote.close;
  if(cur!=null&&quote.prevClose) return ((cur-quote.prevClose)/quote.prevClose)*100;
  return quote.percentChange??null;
}
// Display decimals per asset (price-aware so low-priced crypto keeps precision).
function symDecimals(sym, price){
  if(sym.includes('JPY')) return 3;
  const base=sym.split('/')[0].toLowerCase();
  if(METALS.includes(base)) return 2;
  const c=SYMBOL_META[sym]?.cls||classOf(sym);
  if(c==='stocks') return 2;
  if(c==='crypto') return price==null?2 : price>=100?2 : price>=1?4 : 6;
  return 5; // forex
}
// Units per 1.0 lot — broker-style: forex 100k, metals 100oz, crypto 1 coin, stocks/indices 1 share.
function contractSize(sym){
  const base=sym.split('/')[0].toLowerCase();
  if(METALS.includes(base)) return 100;
  return classOf(sym)==='forex' ? 100000 : 1;
}
// Smallest meaningful price increment for pip-value / spread display.
function pipSize(sym){
  if(sym.includes('JPY')) return 0.01;
  const base=sym.split('/')[0].toLowerCase();
  if(METALS.includes(base)) return 0.01;
  const c=classOf(sym);
  if(c==='forex') return 0.0001;
  if(c==='crypto') return 1;
  return 0.01; // stocks/indices
}
// Half the bid/ask spread (price units), scaled to the asset instead of a flat 0.00002.
// `demo` flag → lower spreads on the demo account, aggressive on live.
function halfSpread(sym, price, demo){
  if(price==null) return 0;
  const base=sym.split('/')[0].toLowerCase();
  if(METALS.includes(base)) return demo ? 0.30 : 1.5;             // demo $0.60 / live $3.00 spread
  const c=classOf(sym);
  if(c==='forex') return sym.includes('JPY') ? (demo?0.015:0.075) : (demo?0.00015:0.00075); // demo 3pip / live 15pip
  if(c==='crypto') return price*(demo?0.0006:0.0030);            // demo 0.12% / live 0.6%
  return price*(demo?0.0010:0.0050);                             // stocks/indices demo 0.20% / live 1.0%
}
export default function Platform() {
  const{trader:liveTrader,signOut,fetchTrader,signIn,loading:authLoading}=useAuth();
  const navigate=useNavigate();
  // ── Live / Demo mode ── (demo = guest, virtual money, lower spreads; live = real CRM account)
  const[modeChoice,setModeChoice]=useState(()=>{try{return sessionStorage.getItem('ts_mode')||null;}catch{return null;}});
  useEffect(()=>{try{ if(modeChoice) sessionStorage.setItem('ts_mode',modeChoice); else sessionStorage.removeItem('ts_mode'); }catch{}},[modeChoice]);
  // Mode survives a refresh (same tab, via sessionStorage) as long as the session is alive; a brand-new tab/session defaults to Demo.
  const mode = modeChoice === 'live' ? ((authLoading || liveTrader) ? 'live' : 'demo') : (modeChoice || 'demo');
  const isDemo = mode==='demo';
  const DEMO_START=10000;
  const[demoBalance,setDemoBalance]=useState(()=>{try{const v=parseFloat(localStorage.getItem('ts_demo_balance'));return isFinite(v)?v:DEMO_START;}catch{return DEMO_START;}});
  const[demoOpen,setDemoOpen]=useState(()=>{try{const s=JSON.parse(localStorage.getItem('ts_demo_open'));return Array.isArray(s)?s:[];}catch{return [];}});
  const[demoClosed,setDemoClosed]=useState(()=>{try{const s=JSON.parse(localStorage.getItem('ts_demo_closed'));return Array.isArray(s)?s:[];}catch{return [];}});
  useEffect(()=>{try{localStorage.setItem('ts_demo_balance',String(demoBalance));}catch{}},[demoBalance]);
  useEffect(()=>{try{localStorage.setItem('ts_demo_open',JSON.stringify(demoOpen));}catch{}},[demoOpen]);
  useEffect(()=>{try{localStorage.setItem('ts_demo_closed',JSON.stringify(demoClosed));}catch{}},[demoClosed]);
  const demoUsedMargin = demoOpen.reduce((s,p)=>s+(p.open_price*p.lot_size*contractSize(p.symbol))/100,0);
  const demoAccount = { id:'demo', email:'demo@local', balance:demoBalance, equity:demoBalance, free_margin:Math.max(0,demoBalance-demoUsedMargin), leverage:100 };
  const trader = isDemo ? demoAccount : liveTrader;
  const handleSignOut=()=>{ setModeChoice(null); signOut(); };
  // Switching Demo → Live asks the client to confirm their CRM-issued credentials.
  const[showLiveModal,setShowLiveModal]=useState(false);
  const[liEmail,setLiEmail]=useState('');
  const[liPwd,setLiPwd]=useState('');
  const[liErr,setLiErr]=useState('');
  const[liBusy,setLiBusy]=useState(false);
  async function confirmLive(e){
    if(e) e.preventDefault();
    setLiBusy(true); setLiErr('');
    const { error } = await signIn(liEmail.trim(), liPwd);
    setLiBusy(false);
    if(error){ setLiErr('Invalid credentials. Use the login we provided when you became a client.'); return; }
    setModeChoice('live'); setShowLiveModal(false); setLiEmail(''); setLiPwd('');
  }
  const isMobile=useIsMobile();
  const[theme,setTheme]=useState(()=>{try{return localStorage.getItem('ts_theme')||'dark';}catch{return 'dark';}});
  const C = theme==='dark' ? C_DARK : C_LIGHT;
  const toggleTheme=()=>setTheme(t=>{const n=t==='dark'?'light':'dark';try{localStorage.setItem('ts_theme',n);}catch{}return n;});
  const chartContainerRef=useRef();
  const chartRef=useRef();
  const seriesRef=useRef();
  const volumeSeriesRef=useRef();
  const lastCandlesRef=useRef([]);
  const lastVolumesRef=useRef([]);
  const oldestTimestampRef=useRef(null);
  const isLoadingMoreRef=useRef(false);
  const noMoreDataRef=useRef(false);
  const[selectedSymbol,setSelectedSymbol_raw]=useState(()=>{
    try{const s=localStorage.getItem('ts_symbol');if(s)return DEFAULT_SYMBOLS.find(d=>d.symbol===s)||DEFAULT_SYMBOLS[0];}catch{}
    return DEFAULT_SYMBOLS[0];
  });
  const setSelectedSymbol=(sym)=>{
    setSelectedSymbol_raw(sym);
    setCandlePrice(null); setPriceChange(0); // avoid a -100% flash from mixing the new
                                             // symbol's live price with the old candlePrice
    setSl?.('');setTp?.('');
    setShowSymbols(false);setShowIntervals(false);
    try{localStorage.setItem('ts_symbol',sym.symbol);}catch{}
  };
  const activeIntervalRef=useRef('5min');
  const[activeInterval,setActiveInterval]=useState(()=>{
    try{
      const saved=localStorage.getItem('ts_interval')||'5min';
      activeIntervalRef.current=saved;
      return saved;
    }catch{}
    activeIntervalRef.current='5min';
    return '5min';
  });
  const[showIntervals,setShowIntervals]=useState(false);
  const[priceChange,setPriceChange]=useState(0);
  const[positionsState,setPositionsState]=useState([]);
  const[historyState,setHistoryState]=useState([]);
  const positions = isDemo ? demoOpen : positionsState;
  const history = isDemo ? demoClosed : historyState;
  const[orderType,setOrderType]=useState('buy');
  const[orderMode,setOrderMode]=useState('Market'); // Market | Limit | Stop
  const[limitPrice,setLimitPrice]=useState('');     // entry/trigger price for pending orders
  const[lotSize,setLotSize]=useState('0.01');
  const[sl,setSl]=useState('');
  const[tp,setTp]=useState('');
  const[placing,setPlacing]=useState(false);
  const[tab,setTab]=useState('positions');
  // Pending Limit/Stop orders, monitored client-side against the live price (persisted).
  const[pendingOrders,setPendingOrders]=useState(()=>{try{const s=JSON.parse(localStorage.getItem('ts_pending'));if(Array.isArray(s))return s;}catch{} return [];});
  useEffect(()=>{try{localStorage.setItem('ts_pending',JSON.stringify(pendingOrders));}catch{}},[pendingOrders]);
  // Order toast notifications + a chime (Web Audio, no asset file needed).
  const[toasts,setToasts]=useState([]);
  const audioCtxRef=useRef(null);
  const playDing=()=>{
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext; if(!Ctx) return;
      if(!audioCtxRef.current) audioCtxRef.current=new Ctx();
      const ctx=audioCtxRef.current; if(ctx.state==='suspended') ctx.resume();
      const t0=ctx.currentTime;
      [880,1318.5].forEach((f,i)=>{ const o=ctx.createOscillator(),g=ctx.createGain(); o.type='sine'; o.frequency.value=f; const s=t0+i*0.085; g.gain.setValueAtTime(0.0001,s); g.gain.exponentialRampToValueAtTime(0.2,s+0.02); g.gain.exponentialRampToValueAtTime(0.0001,s+0.22); o.connect(g); g.connect(ctx.destination); o.start(s); o.stop(s+0.24); });
    }catch{}
  };
  const notify=(title,subtitle,side='neutral')=>{
    const id=Date.now()+Math.random();
    setToasts(prev=>[...prev,{id,title,subtitle,side}]);
    playDing();
    setTimeout(()=>setToasts(prev=>prev.filter(t=>t.id!==id)),4200);
  };
  const[symbolSearch,setSymbolSearch]=useState('');
  const[showSymbols,setShowSymbols]=useState(false);
  const[searchResults,setSearchResults]=useState([]);
  const[searchLoading,setSearchLoading]=useState(false);
  const[activeTool,setActiveTool]=useState('Crosshair');
  const[magnetOn,setMagnetOn]=useState(false); // snap drawing points to nearest candle OHLC
  const[showIndicators,setShowIndicators]=useState(false);
  const[activeIndicators,setActiveIndicators]=useState([]);
  const[mobileView,setMobileView]=useState('chart');
  const[showOrderDrawer,setShowOrderDrawer]=useState(false);
  const[showOrderPanel,setShowOrderPanel]=useState(false);
  const[watchlistCollapsed,setWatchlistCollapsed]=useState(false);
  const[showPositions,setShowPositions]=useState(false);
  // Entering Trade mode collapses the watchlist (chart grows) and pops up the positions panel.
  useEffect(()=>{ setWatchlistCollapsed(showOrderPanel); setShowPositions(showOrderPanel); },[showOrderPanel]);
  // Stateful, user-editable watchlist (persisted). The + button adds/removes assets.
  const[watchSyms,setWatchSyms]=useState(()=>{try{const s=JSON.parse(localStorage.getItem('ts_watchlist'));if(Array.isArray(s)&&s.length)return s;}catch{} return DEFAULT_SYMBOLS.map(d=>d.symbol);});
  useEffect(()=>{try{localStorage.setItem('ts_watchlist',JSON.stringify(watchSyms));}catch{}},[watchSyms]);
  const toggleWatch=(sym)=>setWatchSyms(prev=>prev.includes(sym)?prev.filter(s=>s!==sym):[...prev,sym]);
  // Assets the user added via search that aren't in DEFAULT_SYMBOLS (persisted, so they render).
  const[customSymbols,setCustomSymbols]=useState(()=>{try{const s=JSON.parse(localStorage.getItem('ts_custom_symbols'));if(Array.isArray(s))return s;}catch{} return [];});
  useEffect(()=>{try{localStorage.setItem('ts_custom_symbols',JSON.stringify(customSymbols));}catch{}},[customSymbols]);
  const addSearchedSymbol=(res)=>{
    const known=DEFAULT_SYMBOLS.some(s=>s.symbol===res.symbol)||customSymbols.some(s=>s.symbol===res.symbol);
    if(!known) setCustomSymbols(prev=>[...prev,{symbol:res.symbol,label:res.label,type:res.type}]);
    setWatchSyms(prev=>prev.includes(res.symbol)?prev:[...prev,res.symbol]);
  };
  const[showAddSymbol,setShowAddSymbol]=useState(false);
  const[detailExpanded,setDetailExpanded]=useState(false);
  const[candlePrice,setCandlePrice]=useState(null);
  const[chartLoading,setChartLoading]=useState(false);
  const[technical,setTechnical]=useState(null);
  const[drawings,setDrawings]=useState([]);
  const[selectedDrawing,setSelectedDrawing]=useState(null);
  const[activeDrawing,setActiveDrawing]=useState(null);
  const canvasRef=useRef(null);
  const indicatorSeriesRef=useRef({});
  const isDrawing=useRef(false);
  const searchTimer=useRef(null);
  // Render pool = defaults + custom-added; poll prices for defaults + everything watched +
  // the symbol on the chart + every open-position symbol (so their live P&L actually ticks,
  // even if the asset was chosen from the chart's symbol picker and never added to the watchlist).
  const watchPool=[...DEFAULT_SYMBOLS, ...customSymbols.filter(c=>!DEFAULT_SYMBOLS.some(d=>d.symbol===c.symbol))];
  const allSymbols=[...new Set([...DEFAULT_SYMBOLS.map(s=>s.symbol), ...watchSyms, selectedSymbol.symbol, ...positions.map(p=>p.symbol)])];
  const {prices:livePrices,quotes}=useLivePrices(allSymbols);
  const[perf,setPerf]=useState({});
  const price=livePrices[selectedSymbol.symbol]||candlePrice||null;
  // Load the Inter webfont + crisp text rendering (the app references Inter everywhere but
  // it was never loaded → it fell back to a generic system font, looking unpolished).
  useEffect(()=>{
    if(!document.getElementById('ts-inter')){
      const l=document.createElement('link');
      l.id='ts-inter'; l.rel='stylesheet';
      l.href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
      document.head.appendChild(l);
    }
    if(!document.getElementById('ts-smooth')){
      const s=document.createElement('style');
      s.id='ts-smooth';
      s.textContent="*{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}body{font-family:'Inter',sans-serif;}button{transition:filter .12s ease,background .12s ease,opacity .12s ease;}button:not(:disabled):hover{filter:brightness(1.12);}button:focus-visible{outline:2px solid #2962ff;outline-offset:1px;}@media(prefers-reduced-motion:reduce){*{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;}}";
      document.head.appendChild(s);
    }
  },[]);
  useEffect(()=>{
    if(!chartContainerRef.current) return;
    const chart=createChart(chartContainerRef.current,{
      layout:{backgroundColor:C.bg,textColor:C.muted},
      grid:{vertLines:{color:C.border},horzLines:{color:C.border}},
      crosshair:{mode:0},
      rightPriceScale:{borderColor:C.border2,textColor:C.text},
      timeScale:{borderColor:C.border2,timeVisible:true,textColor:C.muted,secondsVisible:false},
      width:chartContainerRef.current.clientWidth,
      height:chartContainerRef.current.clientHeight,
    });
    const series=chart.addCandlestickSeries({
      upColor:C.green,downColor:C.red,
      borderUpColor:C.green,borderDownColor:C.red,
      wickUpColor:C.green,wickDownColor:C.red,
      priceFormat:{
        type:'custom',
        formatter:(p)=>{
          if(p>=1000) return p.toFixed(0);
          if(p>=100) return p.toFixed(1);
          if(p>=10) return p.toFixed(2);
          if(p>=1) return p.toFixed(3);
          return p.toFixed(4);
        },
        minMove:0.0001,
      },
    });
    const volSeries=chart.addHistogramSeries({
      color:'rgba(38,166,154,0.3)',
      priceFormat:{type:'volume'},
      priceScaleId:'volume',
      scaleMargins:{top:0.85,bottom:0},
      lastValueVisible:false,  // hide the stray "0" volume label on the price axis
      priceLineVisible:false,
    });
    chartRef.current=chart;
    seriesRef.current=series;
    volumeSeriesRef.current=volSeries;
    try{chart.priceScale('right').applyOptions({scaleMargins:{top:0.05,bottom:0.2}});}catch(e){}
    // When the layout tree swaps (mobile⇄desktop across the 768px breakpoint) this effect
    // re-runs on a fresh container; repaint the last-known candles so it isn't left blank.
    if(lastCandlesRef.current&&lastCandlesRef.current.length){
      series.setData(lastCandlesRef.current);
      volSeries.setData(lastVolumesRef.current||[]);
      applyIndicators(lastCandlesRef.current,chart);
      chart.timeScale().fitContent();
    }
    const ro=new ResizeObserver(()=>{
      if(chartContainerRef.current) chart.applyOptions({width:chartContainerRef.current.clientWidth,height:chartContainerRef.current.clientHeight});
    });
    ro.observe(chartContainerRef.current);
    return()=>{chart.remove();ro.disconnect();};
  },[isMobile]);
  // Recolor the chart when the theme toggles (light ⇄ dark)
  useEffect(()=>{
    try{ document.body.style.background=C.bg; }catch{}
    const chart=chartRef.current; if(!chart) return;
    chart.applyOptions({
      layout:{backgroundColor:C.bg,textColor:C.muted},
      grid:{vertLines:{color:C.border},horzLines:{color:C.border}},
      rightPriceScale:{borderColor:C.border2,textColor:C.text},
      timeScale:{borderColor:C.border2,textColor:C.muted},
    });
    seriesRef.current?.applyOptions({upColor:C.green,downColor:C.red,borderUpColor:C.green,borderDownColor:C.red,wickUpColor:C.green,wickDownColor:C.red});
  },[theme]);
  const getCanvasPoint=(e)=>{
    const canvas=canvasRef.current;
    if(!canvas) return null;
    const rect=canvas.getBoundingClientRect();
    return{x:e.clientX-rect.left, y:e.clientY-rect.top};
  };
  // Magnet: snap a point to the nearest candle's column (x) and nearest OHLC value (y).
  const snapPoint=(pt)=>{
    if(!magnetOn||!pt) return pt;
    const series=seriesRef.current, ts=chartRef.current?.timeScale(), candles=lastCandlesRef.current;
    if(!series||!ts||!candles?.length) return pt;
    let best=null,bestDx=Infinity;
    for(const c of candles){ const cx=ts.timeToCoordinate(c.time); if(cx==null) continue; const dx=Math.abs(cx-pt.x); if(dx<bestDx){bestDx=dx;best={c,cx};} }
    if(!best) return pt;
    let snapY=pt.y,bestDy=Infinity;
    for(const pr of [best.c.open,best.c.high,best.c.low,best.c.close]){ const cy=series.priceToCoordinate(pr); if(cy==null) continue; const dy=Math.abs(cy-pt.y); if(dy<bestDy){bestDy=dy;snapY=cy;} }
    return {x:best.cx, y:snapY};
  };
  const redrawCanvas=useCallback(()=>{
    const canvas=canvasRef.current;
    if(!canvas) return;
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const allDrawings=[...drawings, ...(activeDrawing?[activeDrawing]:[])];
    allDrawings.forEach((d,i)=>{
      const isSelected=i===selectedDrawing;
      ctx.strokeStyle=isSelected?'#ff9800':d.color||'#2962ff';
      ctx.lineWidth=isSelected?2.5:d.lineWidth||1.5;
      ctx.setLineDash(d.dash||[]);
      ctx.lineCap='round';
      ctx.lineJoin='round';
      if(!d.points||d.points.length===0) return;
      if(d.type==='Trend Line'||d.type==='Horizontal Ray'||d.type==='Horizontal Line'||d.type==='Vertical Line'){
        if(d.points.length>=2){
          const[p1,p2]=d.points;
          if(d.type==='Horizontal Line'){ctx.beginPath();ctx.moveTo(0,p1.y);ctx.lineTo(canvas.width,p1.y);ctx.stroke();}
          else if(d.type==='Vertical Line'){ctx.beginPath();ctx.moveTo(p1.x,0);ctx.lineTo(p1.x,canvas.height);ctx.stroke();}
          else if(d.type==='Horizontal Ray'){ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(canvas.width,p1.y);ctx.stroke();}
          else{ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();}
          ctx.fillStyle=d.color||'#2962ff';
          [p1,p2].forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();});
        }
      }
      if(d.type==='Rectangle'){
        if(d.points.length>=2){
          const[p1,p2]=d.points;
          ctx.beginPath();ctx.rect(p1.x,p1.y,p2.x-p1.x,p2.y-p1.y);ctx.stroke();
          ctx.fillStyle='rgba(41,98,255,0.05)';ctx.fill();
        }
      }
      if(d.type==='Ellipse'){
        if(d.points.length>=2){
          const[p1,p2]=d.points;
          const cx=(p1.x+p2.x)/2,cy=(p1.y+p2.y)/2;
          const rx=Math.abs(p2.x-p1.x)/2,ry=Math.abs(p2.y-p1.y)/2;
          ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.stroke();
        }
      }
      if(d.type==='Triangle'){
        if(d.points.length>=3){const[p1,p2,p3]=d.points;ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.lineTo(p3.x,p3.y);ctx.closePath();ctx.stroke();}
        else if(d.points.length===2){const[p1,p2]=d.points;ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();}
      }
      if(d.type==='Fib Retracement'){
        if(d.points.length>=2){
          const[p1,p2]=d.points;
          const levels=[0,0.236,0.382,0.5,0.618,0.786,1];
          const colors=['#26a69a','#2962ff','#9c27b0','#ff9800','#9c27b0','#2962ff','#ef5350'];
          levels.forEach((lvl,i)=>{
            const y=p1.y+(p2.y-p1.y)*lvl;
            ctx.strokeStyle=colors[i];ctx.lineWidth=1;ctx.setLineDash([4,2]);
            ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();
            ctx.fillStyle=colors[i];ctx.font='10px Inter,sans-serif';
            ctx.fillText(`${(lvl*100).toFixed(1)}%`,4,y-3);
          });
        }
      }
      if(d.type==='Zoom'){
        if(d.points.length>=2){
          const[p1,p2]=d.points;
          ctx.strokeStyle='#2962ff';ctx.lineWidth=1.5;ctx.setLineDash([5,3]);
          ctx.beginPath();ctx.rect(Math.min(p1.x,p2.x),0,Math.abs(p2.x-p1.x),canvas.height);ctx.stroke();
          ctx.fillStyle='rgba(41,98,255,0.10)';ctx.fillRect(Math.min(p1.x,p2.x),0,Math.abs(p2.x-p1.x),canvas.height);
          ctx.setLineDash([]);
        }
      }
      if(d.type==='Measure'){
        if(d.points.length>=2){
          const[p1,p2]=d.points;
          const series=seriesRef.current, ts=chartRef.current?.timeScale();
          const pr1=series?series.coordinateToPrice(p1.y):null;
          const pr2=series?series.coordinateToPrice(p2.y):null;
          const up = (pr1!=null&&pr2!=null) ? pr2>=pr1 : (p2.y<=p1.y);
          const col = up ? '#26a69a' : '#ef5350';
          // shaded box + vertical move line
          ctx.strokeStyle=col;ctx.lineWidth=1;ctx.setLineDash([]);
          ctx.beginPath();ctx.rect(p1.x,p1.y,p2.x-p1.x,p2.y-p1.y);ctx.stroke();
          ctx.fillStyle = up ? 'rgba(38,166,154,0.12)' : 'rgba(239,83,80,0.12)';ctx.fill();
          const midX=(p1.x+p2.x)/2;
          ctx.beginPath();ctx.moveTo(midX,p1.y);ctx.lineTo(midX,p2.y);ctx.stroke();
          // label: Δprice (percent), bars — like TradingView
          if(pr1!=null&&pr2!=null&&pr1!==0){
            const dPrice=pr2-pr1, pct=(dPrice/Math.abs(pr1))*100;
            const adp=Math.abs(pr1), dec = adp<1?5 : adp<100?4 : 2;
            let bars=null; try{ if(ts){const l1=ts.coordinateToLogical(p1.x),l2=ts.coordinateToLogical(p2.x); if(l1!=null&&l2!=null) bars=Math.abs(Math.round(l2-l1));} }catch{}
            const sign=dPrice>=0?'+':'';
            const l1=`${sign}${dPrice.toFixed(dec)}  (${sign}${pct.toFixed(2)}%)`;
            const l2=bars!=null?`${bars} bar${bars===1?'':'s'}`:'';
            ctx.font='600 11px Inter,sans-serif';ctx.textAlign='center';
            const tw=Math.max(ctx.measureText(l1).width, l2?ctx.measureText(l2).width:0)+16;
            const rh=l2?32:20, rw=tw, rr=5, rx=midX-rw/2, ry=Math.min(p1.y,p2.y)-rh-6;
            ctx.fillStyle=col;ctx.beginPath();
            ctx.moveTo(rx+rr,ry);ctx.arcTo(rx+rw,ry,rx+rw,ry+rh,rr);ctx.arcTo(rx+rw,ry+rh,rx,ry+rh,rr);ctx.arcTo(rx,ry+rh,rx,ry,rr);ctx.arcTo(rx,ry,rx+rw,ry,rr);ctx.fill();
            ctx.fillStyle='#fff';
            ctx.fillText(l1, midX, ry+(l2?14:14));
            if(l2) ctx.fillText(l2, midX, ry+27);
            ctx.textAlign='left';
          }
        }
      }
      if(d.type==='Text'){
        const p=d.points[0];
        ctx.setLineDash([]);ctx.textAlign='left';
        ctx.font='600 13px Inter,sans-serif';
        ctx.fillStyle=isSelected?'#ff9800':(d.color||'#2962ff');
        ctx.fillText(d.text||'', p.x, p.y);
      }
    });
  },[drawings,activeDrawing,selectedDrawing]);
  useEffect(()=>{redrawCanvas();},[redrawCanvas]);
  useEffect(()=>{
    const handleKeyDown=(e)=>{
      // Don't hijack keys while the user is typing in an input/textarea (e.g. Quantity, SL/TP).
      const t=e.target;
      if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable)) return;
      if((e.metaKey||e.ctrlKey)&&e.key==='z'){
        e.preventDefault();
        setDrawings(prev=>{if(prev.length===0) return prev;return prev.slice(0,-1);});
        setSelectedDrawing(null);
      }
      if((e.key==='Delete'||e.key==='Backspace')&&selectedDrawing!==null){
        e.preventDefault();
        setDrawings(prev=>prev.filter((_,i)=>i!==selectedDrawing));
        setSelectedDrawing(null);
      }
    };
    window.addEventListener('keydown',handleKeyDown);
    return()=>window.removeEventListener('keydown',handleKeyDown);
  },[selectedDrawing]);
  const hitTest=(pt,drawing)=>{
    if(drawing.type==='Text'&&drawing.points?.[0]){const p=drawing.points[0];return pt.x>=p.x-6&&pt.x<=p.x+90&&Math.abs(pt.y-p.y)<14;}
    if(!drawing.points||drawing.points.length<2) return false;
    const[p1,p2]=drawing.points;
    const THRESHOLD=15;
    if(drawing.type==='Horizontal Line'||drawing.type==='Horizontal Ray'){return Math.abs(pt.y-p1.y)<THRESHOLD;}
    if(drawing.type==='Vertical Line'){return Math.abs(pt.x-p1.x)<THRESHOLD;}
    const dx=p2.x-p1.x,dy=p2.y-p1.y;
    const len=Math.sqrt(dx*dx+dy*dy);
    if(len===0) return false;
    const t=Math.max(0,Math.min(1,((pt.x-p1.x)*dx+(pt.y-p1.y)*dy)/(len*len)));
    const projX=p1.x+t*dx,projY=p1.y+t*dy;
    const dist=Math.sqrt((pt.x-projX)**2+(pt.y-projY)**2);
    return dist<THRESHOLD;
  };
  useEffect(()=>{
    const canvas=canvasRef.current;
    const container=chartContainerRef.current;
    if(!canvas||!container) return;
    const ro=new ResizeObserver(()=>{
      canvas.width=container.clientWidth;
      canvas.height=container.clientHeight;
      redrawCanvas();
    });
    ro.observe(container);
    return()=>ro.disconnect();
  },[redrawCanvas]);
  const handleCanvasMouseDown=(e)=>{
    if(activeTool==='Remove All'){setDrawings([]);setSelectedDrawing(null);return;}
    if(activeTool==='Back'){setDrawings(prev=>{if(prev.length===0)return prev;return prev.slice(0,-1);});setSelectedDrawing(null);return;}
    if(activeTool==='Crosshair') return;
    if(activeTool==='Cursor'){
      const pt=getCanvasPoint(e);if(!pt) return;
      let found=null;
      for(let i=drawings.length-1;i>=0;i--){if(hitTest(pt,drawings[i])){found=i;break;}}
      setSelectedDrawing(found);return;
    }
    if(activeTool==='Text'){
      const pt=getCanvasPoint(e);if(!pt) return;
      const txt=window.prompt('Add text to chart:');
      if(txt&&txt.trim()) setDrawings(prev=>[...prev,{type:'Text',points:[pt],text:txt.trim(),color:'#2962ff'}]);
      setActiveTool('Cursor');return;
    }
    const pt=snapPoint(getCanvasPoint(e));if(!pt) return;
    isDrawing.current=true;
    if(activeTool==='Triangle'&&activeDrawing?.type==='Triangle'&&activeDrawing.points.length===2){
      setDrawings(prev=>[...prev,{...activeDrawing,points:[...activeDrawing.points,pt]}]);
      setActiveDrawing(null);isDrawing.current=false;
    } else {
      setActiveDrawing({type:activeTool,points:[pt,pt],color:'#2962ff',lineWidth:1.5});
    }
  };
  const handleCanvasMouseMove=(e)=>{
    if(!isDrawing.current||!activeDrawing) return;
    const pt=snapPoint(getCanvasPoint(e));if(!pt) return;
    setActiveDrawing(prev=>({...prev,points:[prev.points[0],pt]}));
  };
  // Zoom tool: dragging a box rescales the chart's visible time range to that span.
  const applyZoom=(p1,p2)=>{
    const ts=chartRef.current?.timeScale(); if(!ts) return;
    try{
      let a=ts.coordinateToLogical(Math.min(p1.x,p2.x)), b=ts.coordinateToLogical(Math.max(p1.x,p2.x));
      if(a==null||b==null||Math.abs(b-a)<1) return;
      ts.setVisibleLogicalRange({from:a,to:b});
    }catch{}
  };
  const handleCanvasMouseUp=(e)=>{
    if(!isDrawing.current||!activeDrawing) return;
    const pt=snapPoint(getCanvasPoint(e));if(!pt) return;
    if(activeTool==='Zoom'){
      applyZoom(activeDrawing.points[0],pt);
      setActiveDrawing(null);isDrawing.current=false;return; // ephemeral: don't persist the box
    }
    if(activeTool==='Triangle'){
      setActiveDrawing(prev=>({...prev,points:[prev.points[0],pt]}));
      isDrawing.current=false;
    } else {
      setDrawings(prev=>[...prev,{...activeDrawing,points:[activeDrawing.points[0],pt]}]);
      setSelectedDrawing(null);setActiveDrawing(null);isDrawing.current=false;
    }
  };
  const canvasCursor=()=>{
    if(activeTool==='Cursor') return 'default';
    if(activeTool==='Crosshair') return 'crosshair';
    if(activeTool==='Zoom') return 'zoom-in';
    if(activeTool==='Remove All') return 'default';
    return 'crosshair';
  };
  function calcSMA(closes,period){return closes.map((_,i)=>i<period-1?null:closes.slice(i-period+1,i+1).reduce((a,b)=>a+b)/period);}
  function calcEMA(closes,period){
    const k=2/(period+1);const ema=[];let prev=null;
    closes.forEach((c,i)=>{
      if(i<period-1){ema.push(null);return;}
      if(prev===null) prev=closes.slice(0,period).reduce((a,b)=>a+b)/period;
      prev=c*k+prev*(1-k);ema.push(prev);
    });
    return ema;
  }
  function calcBB(closes,period=20,std=2){
    const sma=calcSMA(closes,period);
    return closes.map((_,i)=>{
      if(sma[i]===null) return{upper:null,mid:null,lower:null};
      const slice=closes.slice(i-period+1,i+1);const mean=sma[i];
      const sd=Math.sqrt(slice.reduce((a,b)=>a+(b-mean)**2,0)/period);
      return{upper:mean+std*sd,mid:mean,lower:mean-std*sd};
    });
  }
  function calcRSI(closes,period=14){
    const rsi=[];
    for(let i=0;i<closes.length;i++){
      if(i<period){rsi.push(null);continue;}
      let gains=0,losses=0;
      for(let j=i-period+1;j<=i;j++){const diff=closes[j]-closes[j-1];if(diff>0) gains+=diff;else losses+=Math.abs(diff);}
      const rs=(gains/period)/(losses/period||0.0001);rsi.push(100-100/(1+rs));
    }
    return rsi;
  }
  function calcMACD(closes,fast=12,slow=26,signal=9){
    const emaFast=calcEMA(closes,fast);const emaSlow=calcEMA(closes,slow);
    const macdLine=closes.map((_,i)=>emaFast[i]!==null&&emaSlow[i]!==null?emaFast[i]-emaSlow[i]:null);
    const validMacd=macdLine.filter(v=>v!==null);const signalEma=calcEMA(validMacd,signal);
    let sigIdx=0;const signalLine=macdLine.map(v=>v===null?null:signalEma[sigIdx++]??null);
    return{macd:macdLine,signal:signalLine,hist:macdLine.map((m,i)=>m!==null&&signalLine[i]!==null?m-signalLine[i]:null)};
  }
  // TradingView-style technical summary: aggregate MA + oscillator signals → -1..1 score.
  function computeTechnical(closes){
    if(closes.length<55) return null;
    const price=closes[closes.length-1];
    let buy=0,sell=0,neutral=0,total=0;
    const vote=(b)=>{ total++; if(b>0)buy++; else if(b<0)sell++; else neutral++; };
    [10,20,30,50].forEach(p=>{ const v=calcSMA(closes,p).at(-1); if(v!=null) vote(price>v?1:price<v?-1:0); });
    [10,20,30,50].forEach(p=>{ const v=calcEMA(closes,p).at(-1); if(v!=null) vote(price>v?1:price<v?-1:0); });
    const r=calcRSI(closes).at(-1); if(r!=null) vote(r<30?1:r>70?-1:0);
    const {hist}=calcMACD(closes); const h=hist.at(-1); if(h!=null) vote(h>0?1:h<0?-1:0);
    if(!total) return null;
    const score=(buy-sell)/total;
    const label = score>=0.5?'Strong buy':score>=0.15?'Buy':score<=-0.5?'Strong sell':score<=-0.15?'Sell':'Neutral';
    return {score,label,buy,sell,neutral};
  }
  function applyIndicators(candles,chart){
    Object.values(indicatorSeriesRef.current).forEach(s=>{try{chart.removeSeries(s);}catch{}});
    indicatorSeriesRef.current={};
    if(!candles.length) return;
    const closes=candles.map(c=>c.close);
    const times=candles.map(c=>c.time);
    activeIndicators.forEach(ind=>{
      try{
        if(ind==='Simple Moving Average (SMA)'){
          const vals=calcSMA(closes,20);
          const s=chart.addLineSeries({color:'#2962ff',lineWidth:1.5,priceLineVisible:false,lastValueVisible:true,title:'SMA20'});
          s.setData(times.map((t,i)=>vals[i]!==null?{time:t,value:vals[i]}:null).filter(Boolean));
          indicatorSeriesRef.current['SMA']=s;
        }
        if(ind==='Exponential Moving Average (EMA)'){
          const vals=calcEMA(closes,20);
          const s=chart.addLineSeries({color:'#f7931a',lineWidth:1.5,priceLineVisible:false,lastValueVisible:true,title:'EMA20'});
          s.setData(times.map((t,i)=>vals[i]!==null?{time:t,value:vals[i]}:null).filter(Boolean));
          indicatorSeriesRef.current['EMA']=s;
        }
        if(ind==='Bollinger Bands'){
          const bb=calcBB(closes);
          const upper=chart.addLineSeries({color:'rgba(41,98,255,0.5)',lineWidth:1,priceLineVisible:false,lastValueVisible:false,title:'BB Upper'});
          const mid=chart.addLineSeries({color:'rgba(41,98,255,0.8)',lineWidth:1,lineStyle:2,priceLineVisible:false,lastValueVisible:false,title:'BB Mid'});
          const lower=chart.addLineSeries({color:'rgba(41,98,255,0.5)',lineWidth:1,priceLineVisible:false,lastValueVisible:false,title:'BB Lower'});
          upper.setData(times.map((t,i)=>bb[i].upper!==null?{time:t,value:bb[i].upper}:null).filter(Boolean));
          mid.setData(times.map((t,i)=>bb[i].mid!==null?{time:t,value:bb[i].mid}:null).filter(Boolean));
          lower.setData(times.map((t,i)=>bb[i].lower!==null?{time:t,value:bb[i].lower}:null).filter(Boolean));
          indicatorSeriesRef.current['BB_U']=upper;indicatorSeriesRef.current['BB_M']=mid;indicatorSeriesRef.current['BB_L']=lower;
        }
        if(ind==='RSI'){
          const vals=calcRSI(closes);
          const s=chart.addLineSeries({color:'#9c27b0',lineWidth:1.5,priceScaleId:'rsi',priceLineVisible:false,lastValueVisible:true,title:'RSI14'});
          chart.priceScale('rsi').applyOptions({scaleMargins:{top:0.8,bottom:0},borderVisible:false});
          s.setData(times.map((t,i)=>vals[i]!==null?{time:t,value:vals[i]}:null).filter(Boolean));
          indicatorSeriesRef.current['RSI']=s;
        }
        if(ind==='MACD'){
          const{macd,hist}=calcMACD(closes);
          const ms=chart.addLineSeries({color:'#26a69a',lineWidth:1.5,priceScaleId:'macd',priceLineVisible:false,lastValueVisible:true,title:'MACD'});
          const hs=chart.addHistogramSeries({color:'rgba(41,98,255,0.5)',priceScaleId:'macd',priceLineVisible:false,lastValueVisible:false,title:''});
          chart.priceScale('macd').applyOptions({scaleMargins:{top:0.85,bottom:0},borderVisible:false});
          ms.setData(times.map((t,i)=>macd[i]!==null?{time:t,value:macd[i]}:null).filter(Boolean));
          hs.setData(times.map((t,i)=>hist[i]!==null?{time:t,value:hist[i],color:hist[i]>=0?'rgba(38,166,154,0.5)':'rgba(239,83,80,0.5)'}:null).filter(Boolean));
          indicatorSeriesRef.current['MACD']=ms;indicatorSeriesRef.current['MACD_H']=hs;
        }
        if(ind==='Weighted Moving Average (WMA)'){
          const wma=closes.map((_,i)=>{
            const p=14;if(i<p-1) return null;
            const slice=closes.slice(i-p+1,i+1);
            const w=slice.reduce((a,_,j)=>a+(j+1),0);
            return slice.reduce((a,v,j)=>a+v*(j+1),0)/w;
          });
          const s=chart.addLineSeries({color:'#ff6b35',lineWidth:1.5,priceLineVisible:false,lastValueVisible:true,title:'WMA14'});
          s.setData(times.map((t,i)=>wma[i]!==null?{time:t,value:wma[i]}:null).filter(Boolean));
          indicatorSeriesRef.current['WMA']=s;
        }
      }catch(e){console.error('Indicator error:',ind,e);}
    });
  }
  function mergeCandles(existing, incoming) {
    const map = new Map();
    [...incoming, ...existing].forEach(c => map.set(String(c.time), c));
    return Array.from(map.values()).sort((a, b) => {
      const ta = String(a.time);
      const tb = String(b.time);
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
  }
  const candleCacheRef = useRef(new Map());
  const fetchRetryRef = useRef(null);
  const chartKeyRef = useRef('');
  const renderCandles = (candles, volumes, oldest) => {
    oldestTimestampRef.current = oldest;
    lastCandlesRef.current = candles;
    lastVolumesRef.current = volumes;
    seriesRef.current?.setData(candles);
    volumeSeriesRef.current?.setData(volumes);
    if (chartRef.current) applyIndicators(candles, chartRef.current);
    chartRef.current?.timeScale().fitContent();
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    setCandlePrice(last.close);
    if (prev) setPriceChange(((last.close - prev.close) / prev.close) * 100);
    setTechnical(computeTechnical(candles.map(c => c.close)));
  };
  const fetchCandles = useCallback(async () => {
    const sym = selectedSymbol.symbol;
    const key = `${sym}|${activeInterval}`;
    chartKeyRef.current = key;
    if (fetchRetryRef.current) { clearTimeout(fetchRetryRef.current); fetchRetryRef.current = null; }
    noMoreDataRef.current = false;
    // Instant render from a fresh cache (≤30s) so re-selecting an asset is immediate.
    const cached = candleCacheRef.current.get(key);
    if (cached && Date.now() - cached.ts < 120000) {
      renderCandles(cached.candles, cached.volumes, cached.oldest);
      setChartLoading(false);
      return;
    }
    setChartLoading(true);
    oldestTimestampRef.current = null;
    lastCandlesRef.current = [];
    lastVolumesRef.current = [];
    seriesRef.current?.setData([]);        // blank the chart so stale prices from the
    volumeSeriesRef.current?.setData([]);  // previous asset aren't shown while loading
    const delays = [1500, 4000, 10000]; // backoff for transient/network failures
    const attempt = async (i) => {
      if (chartKeyRef.current !== key) return; // user switched away while pending
      try {
        const r = await fetchTwelveSeries(sym, activeInterval);
        if (!r) throw new Error('empty');
        if (chartKeyRef.current !== key) return; // switched while awaiting
        candleCacheRef.current.set(key, { candles: r.candles, volumes: r.volumes, oldest: r.oldestDatetime, ts: Date.now() });
        renderCandles(r.candles, r.volumes, r.oldestDatetime);
        setChartLoading(false);
      } catch (e) {
        if (chartKeyRef.current !== key) return;
        if (i < delays.length) { fetchRetryRef.current = setTimeout(() => attempt(i + 1), delays[i]); }
        else { console.error('fetchCandles:', e); setChartLoading(false); }
      }
    };
    attempt(0);
  }, [selectedSymbol, activeInterval]);
  useEffect(() => { fetchCandles(); }, [fetchCandles]);
  // Prefetch the OTHER watchlist symbols' candles in the background → switching is instant
  // (served from cache). Throttled to spare API credits.
  useEffect(() => {
    let cancelled = false;
    const others = allSymbols.filter(s => s !== selectedSymbol.symbol);
    let i = 0;
    const run = async () => {
      if (cancelled || i >= others.length) return;
      const sym = others[i++];
      const key = `${sym}|${activeInterval}`;
      const cached = candleCacheRef.current.get(key);
      if (!cached || Date.now() - cached.ts > 120000) {
        try {
          const r = await fetchTwelveSeries(sym, activeInterval);
          if (r && !cancelled) candleCacheRef.current.set(key, { candles: r.candles, volumes: r.volumes, oldest: r.oldestDatetime, ts: Date.now() });
        } catch {}
      }
      if (!cancelled) setTimeout(run, 500);
    };
    const t = setTimeout(run, 1500); // start after the selected chart has loaded
    return () => { cancelled = true; clearTimeout(t); };
  }, [selectedSymbol.symbol, activeInterval]);
  const fetchOlderCandles = useCallback(async () => {
    const sym = selectedSymbol.symbol;
    if (tdAgg(activeInterval) > 1) return; // skip paging for aggregated (3M/6M/1Y) intervals
    if (isLoadingMoreRef.current || noMoreDataRef.current) return;
    if (!oldestTimestampRef.current) return;
    isLoadingMoreRef.current = true;
    try {
      const prevOldest = oldestTimestampRef.current;
      const r = await fetchTwelveSeries(sym, activeInterval, prevOldest); // bars ending at current oldest
      if (!r || !r.candles.length || r.oldestDatetime === prevOldest) {
        noMoreDataRef.current = true;          // no older data available
        isLoadingMoreRef.current = false;
        return;
      }
      oldestTimestampRef.current = r.oldestDatetime;
      const merged = mergeCandles(lastCandlesRef.current, r.candles);
      const mergedVolumes = mergeCandles(lastVolumesRef.current || [], r.volumes);
      lastCandlesRef.current = merged;
      lastVolumesRef.current = mergedVolumes;
      seriesRef.current?.setData(merged);
      volumeSeriesRef.current?.setData(mergedVolumes);
    } catch (e) { console.error('Lazy load error:', e); }
    isLoadingMoreRef.current = false;
  }, [selectedSymbol, activeInterval]);
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const handler = (range) => {
      if (!range) return;
      const ts = chart.timeScale();
      const logRange = ts.getVisibleLogicalRange();
      if (!logRange) return;
      if (logRange.from < 10) {
        fetchOlderCandles();
      }
    };
    chart.timeScale().subscribeVisibleTimeRangeChange(handler);
    return () => { try { chart.timeScale().unsubscribeVisibleTimeRangeChange(handler); } catch {} };
  }, [fetchOlderCandles]);
  useEffect(() => {
    if (lastCandlesRef.current.length && chartRef.current) {
      applyIndicators(lastCandlesRef.current, chartRef.current);
    }
  }, [activeIndicators.length, activeIndicators.join(',')]);
  useEffect(() => {
    const lp = livePrices[selectedSymbol.symbol];
    if (lp && candlePrice) setPriceChange(((lp - candlePrice) / candlePrice) * 100);
  }, [livePrices[selectedSymbol.symbol]]);
  // Live-update the chart's forming candle so it tracks the streaming price
  // (without this the candles freeze at fetch time and drift from the live price).
  useEffect(() => {
    const lp = livePrices[selectedSymbol.symbol];
    const candles = lastCandlesRef.current;
    if (lp == null || !seriesRef.current || !candles?.length) return;
    const last = candles[candles.length - 1];
    const intervalSec = { '1min':60,'5min':300,'15min':900,'1h':3600,'4h':14400 }[activeInterval];
    let bar;
    if (!intervalSec || typeof last.time === 'string') {
      // daily+ (date-string times): keep updating the latest bar
      bar = { time: last.time, open: last.open, high: Math.max(last.high, lp), low: Math.min(last.low, lp), close: lp };
      candles[candles.length - 1] = bar;
    } else {
      const bucket = Math.floor(Date.now() / 1000 / intervalSec) * intervalSec;
      if (bucket > last.time) {
        bar = { time: bucket, open: lp, high: lp, low: lp, close: lp }; // new period: open a fresh candle
        candles.push(bar);
      } else {
        bar = { time: last.time, open: last.open, high: Math.max(last.high, lp), low: Math.min(last.low, lp), close: lp };
        candles[candles.length - 1] = bar;
      }
    }
    try { seriesRef.current.update(bar); } catch {}
  }, [livePrices[selectedSymbol.symbol], activeInterval]);
  useEffect(() => {
    let cancelled = false;
    let retry = null;
    const sym = selectedSymbol.symbol;
    setPerf({});
    const load = async () => {
      try {
        const res = await fetch(`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(sym)}&interval=1day&outputsize=400&timezone=UTC&apikey=${TWELVE_KEY}`);
        const data = await res.json();
        if (cancelled) return;
        if (!data.values?.length) { retry = setTimeout(load, 20000); return; } // rate-limited/empty: retry
        const bars = data.values.map(v => ({ t: new Date(v.datetime).getTime(), c: parseFloat(v.close) })); // newest-first
        const latest = bars[0].c, now = bars[0].t;
        const periods = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
        const out = {};
        for (const [label, days] of Object.entries(periods)) {
          const target = now - days * 86400000;
          const past = bars.find(b => b.t <= target);
          out[label] = past ? ((latest - past.c) / past.c) * 100 : null;
        }
        if (!cancelled) setPerf(out);
      } catch { if (!cancelled) retry = setTimeout(load, 20000); }
    };
    load();
    return () => { cancelled = true; if (retry) clearTimeout(retry); };
  }, [selectedSymbol.symbol]);
  async function fetchPositions() {
    if (isDemo || !liveTrader) return;
    const { data: open } = await supabase.from('trades').select('*').eq('trader_id', liveTrader.id).eq('status', 'open').order('opened_at', { ascending: false });
    const { data: closed } = await supabase.from('trades').select('*').eq('trader_id', liveTrader.id).eq('status', 'closed').order('closed_at', { ascending: false }).limit(20);
    setPositionsState(open || []); setHistoryState(closed || []);
  }
  useEffect(() => { fetchPositions(); }, [trader]);
  const livePositions = positions.map(p => {
    const mid = livePrices[p.symbol] || p.open_price;
    const hs = halfSpread(p.symbol, mid, isDemo);
    // Mark-to-close: a buy is valued at the bid, a sell at the ask (so it opens at -spread).
    const cur = p.type === 'buy' ? mid - hs : mid + hs;
    const diff = p.type === 'buy' ? cur - p.open_price : p.open_price - cur;
    return { ...p, live_profit: diff * p.lot_size * contractSize(p.symbol), current_price: cur };
  });
  const totalPnL = livePositions.reduce((s, p) => s + (p.live_profit || 0), 0);
  async function placeOrder() {
    if (!trader || !price) return;
    const lot = parseFloat(lotSize) || 0.01;
    const slv = sl ? parseFloat(sl) : null, tpv = tp ? parseFloat(tp) : null;
    // ── Pending order (Limit / Stop): validate the entry side, then queue it ──
    if (orderMode !== 'Market') {
      const entry = parseFloat(limitPrice);
      if (!entry || entry <= 0) { window.alert('Enter a valid price for the ' + orderMode + ' order.'); return; }
      const kind = orderMode.toLowerCase(); // 'limit' | 'stop'
      // Buy Limit below ask · Sell Limit above bid · Buy Stop above ask · Sell Stop below bid
      const rule =
        orderType === 'buy' && kind === 'limit' ? entry < ask :
        orderType === 'sell' && kind === 'limit' ? entry > bid :
        orderType === 'buy' && kind === 'stop' ? entry > ask :
        entry < bid; // sell stop
      if (!rule) {
        const hint = orderType === 'buy' && kind === 'limit' ? `below ${fmt(ask, decimals)} (ask)` :
          orderType === 'sell' && kind === 'limit' ? `above ${fmt(bid, decimals)} (bid)` :
          orderType === 'buy' && kind === 'stop' ? `above ${fmt(ask, decimals)} (ask)` :
          `below ${fmt(bid, decimals)} (bid)`;
        window.alert(`${orderType === 'buy' ? 'Buy' : 'Sell'} ${orderMode} price must be ${hint}.`);
        return;
      }
      const reqMargin = (entry * lot * contractSize(selectedSymbol.symbol)) / (trader.leverage || 100);
      const freeMargin = Math.max(0, (trader.free_margin || 0) + totalPnL);
      if (reqMargin > freeMargin) { window.alert(`Insufficient free margin.\nRequired: ${fmtUSD(reqMargin)}\nAvailable: ${fmtUSD(freeMargin)}`); return; }
      setPendingOrders(prev => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, trader_id: trader.id, symbol: selectedSymbol.symbol, type: orderType, kind, entry, lot, sl: slv, tp: tpv, created_at: new Date().toISOString() }]);
      notify(`${orderType === 'buy' ? 'Buy' : 'Sell'} ${orderMode} · ${lot} ${selectedSymbol.symbol}`, `Pending order placed @ ${fmt(entry, decimals)}`, orderType);
      setLimitPrice(''); setSl(''); setTp('');
      if (isMobile) setShowOrderDrawer(false);
      return;
    }
    // ── Market order: fill immediately (Buy at ASK, Sell at BID) ──
    const openPrice = orderType === 'buy' ? ask : bid;
    const reqMargin = (openPrice * lot * contractSize(selectedSymbol.symbol)) / (trader.leverage || 100);
    const freeMargin = Math.max(0, (trader.free_margin || 0) + totalPnL);
    if (reqMargin > freeMargin) { window.alert(`Insufficient free margin.\nRequired: ${fmtUSD(reqMargin)}\nAvailable: ${fmtUSD(freeMargin)}`); return; }
    setPlacing(true);
    if (isDemo) {
      setDemoOpen(prev => [{ id: 'd' + Date.now() + Math.random().toString(36).slice(2, 6), trader_id: 'demo', symbol: selectedSymbol.symbol, type: orderType, lot_size: lot, open_price: openPrice, stop_loss: slv, take_profit: tpv, status: 'open', opened_at: new Date().toISOString() }, ...prev]);
      notify(`${orderType === 'buy' ? 'Buy' : 'Sell'} ${lot} ${selectedSymbol.symbol}`, `Demo order filled @ ${fmt(openPrice, decimals)}`, orderType);
      setSl(''); setTp(''); setPlacing(false);
      if (isMobile) setShowOrderDrawer(false);
      return;
    }
    await supabase.from('trades').insert({ trader_id: trader.id, symbol: selectedSymbol.symbol, type: orderType, lot_size: lot, open_price: openPrice, stop_loss: slv, take_profit: tpv, status: 'open' });
    notify(`${orderType === 'buy' ? 'Buy' : 'Sell'} ${lot} ${selectedSymbol.symbol}`, `Market order filled @ ${fmt(openPrice, decimals)}`, orderType);
    setSl(''); setTp(''); setPlacing(false); fetchPositions();
    if (isMobile) setShowOrderDrawer(false);
  }
  // Monitor pending Limit/Stop orders against the live price and fill them when hit.
  const fillingRef = useRef(false);
  useEffect(() => {
    if (!trader || !pendingOrders.length || fillingRef.current) return;
    const hit = pendingOrders.find(o => {
      if (o.trader_id !== trader.id) return false;
      const mid = livePrices[o.symbol]; if (mid == null) return false;
      const h = halfSpread(o.symbol, mid, isDemo), a = mid + h, b = mid - h;
      if (o.type === 'buy' && o.kind === 'limit') return a <= o.entry;
      if (o.type === 'sell' && o.kind === 'limit') return b >= o.entry;
      if (o.type === 'buy' && o.kind === 'stop') return a >= o.entry;
      return b <= o.entry; // sell stop
    });
    if (!hit) return;
    fillingRef.current = true;
    (async () => {
      if (isDemo) {
        setDemoOpen(prev => [{ id: 'd' + Date.now() + Math.random().toString(36).slice(2, 6), trader_id: 'demo', symbol: hit.symbol, type: hit.type, lot_size: hit.lot, open_price: hit.entry, stop_loss: hit.sl ?? null, take_profit: hit.tp ?? null, status: 'open', opened_at: new Date().toISOString() }, ...prev]);
      } else {
        await supabase.from('trades').insert({ trader_id: trader.id, symbol: hit.symbol, type: hit.type, lot_size: hit.lot, open_price: hit.entry, stop_loss: hit.sl ?? null, take_profit: hit.tp ?? null, status: 'open' });
      }
      setPendingOrders(prev => prev.filter(o => o.id !== hit.id));
      notify(`${hit.type === 'buy' ? 'Buy' : 'Sell'} ${hit.lot} ${hit.symbol}`, `${hit.kind === 'limit' ? 'Limit' : 'Stop'} order filled @ ${fmt(hit.entry, symDecimals(hit.symbol, hit.entry))}`, hit.type);
      if (!isDemo) await fetchPositions();
      fillingRef.current = false;
    })();
  }, [livePrices, pendingOrders, trader]);
  const cancelPending = (id) => setPendingOrders(prev => prev.filter(o => o.id !== id));
  // Draw entry lines on the chart: solid for open positions, dashed for pending orders (current symbol).
  const priceLinesRef = useRef([]);
  useEffect(() => {
    const series = seriesRef.current; if (!series) return;
    priceLinesRef.current.forEach(pl => { try { series.removePriceLine(pl); } catch {} });
    priceLinesRef.current = [];
    const sym = selectedSymbol.symbol;
    positions.filter(p => p.symbol === sym).forEach(p => {
      try { priceLinesRef.current.push(series.createPriceLine({ price: Number(p.open_price), color: p.type === 'buy' ? C.green : C.red, lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: `${p.type === 'buy' ? 'BUY' : 'SELL'} ${p.lot_size}` })); } catch {}
    });
    pendingOrders.filter(o => o.trader_id === trader?.id && o.symbol === sym).forEach(o => {
      try { priceLinesRef.current.push(series.createPriceLine({ price: Number(o.entry), color: C.accent, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `${o.type === 'buy' ? 'BUY' : 'SELL'} ${o.kind.toUpperCase()} ${o.lot}` })); } catch {}
    });
  }, [positions, pendingOrders, selectedSymbol.symbol, trader, theme, chartLoading]);
  async function closePosition(trade) {
    if (!window.confirm(`Close ${trade.symbol} ${trade.type.toUpperCase()} @ ${trade.lot_size} lots?`)) return;
    const mid = livePrices[trade.symbol] || trade.open_price;
    const hs = halfSpread(trade.symbol, mid, isDemo);
    // Buy closes at the bid, sell closes at the ask (mirror of how it opened).
    const closePrice = trade.type === 'buy' ? mid - hs : mid + hs;
    const diff = trade.type === 'buy' ? closePrice - trade.open_price : trade.open_price - closePrice;
    const profit = diff * trade.lot_size * contractSize(trade.symbol);
    if (isDemo) {
      setDemoBalance(b => b + profit);
      setDemoOpen(prev => prev.filter(p => p.id !== trade.id));
      setDemoClosed(prev => [{ ...trade, status: 'closed', close_price: closePrice, profit, closed_at: new Date().toISOString() }, ...prev].slice(0, 20));
      notify(`Closed ${trade.type === 'buy' ? 'Buy' : 'Sell'} ${trade.lot_size} ${trade.symbol}`, `P&L ${fmtP(profit)} @ ${fmt(closePrice, symDecimals(trade.symbol, closePrice))}`, profit >= 0 ? 'buy' : 'sell');
      return;
    }
    await supabase.from('trades').update({ status: 'closed', close_price: closePrice, profit, closed_at: new Date().toISOString() }).eq('id', trade.id);
    await supabase.from('trader_accounts').update({ balance: trader.balance + profit, equity: trader.equity + profit }).eq('id', trader.id);
    notify(`Closed ${trade.type === 'buy' ? 'Buy' : 'Sell'} ${trade.lot_size} ${trade.symbol}`, `P&L ${fmtP(profit)} @ ${fmt(closePrice, symDecimals(trade.symbol, closePrice))}`, profit >= 0 ? 'buy' : 'sell');
    fetchPositions(); if (fetchTrader) fetchTrader(trader.email);
  }
  const handleSymbolSearch = (value) => {
    setSymbolSearch(value); setSearchResults([]);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!value.trim()) return;
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(value)}&outputsize=10&apikey=${TWELVE_KEY}`);
        const data = await res.json();
        if (data.data) setSearchResults(data.data.map(r => ({ symbol: r.symbol, label: r.instrument_name || r.symbol, type: r.instrument_type === 'Digital Currency' ? 'Crypto' : r.instrument_type === 'Physical Currency' ? 'Forex' : 'Stocks' })));
      } catch { } setSearchLoading(false);
    }, 400);
  };
  const decimals = symDecimals(selectedSymbol.symbol, price);
  const hs = price ? halfSpread(selectedSymbol.symbol, price, isDemo) : 0;
  const bid = price ? price - hs : null;
  const ask = price ? price + hs : null;
  const activeLabel = INTERVALS.find(i => i.value === activeInterval)?.label || '5m';
  const OrderPanelContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${C.border}` }}>
        <button onClick={() => setOrderType('buy')} style={{ padding: '12px 8px', background: orderType === 'buy' ? C.greenBg : 'transparent', border: 'none', borderBottom: orderType === 'buy' ? `2px solid ${C.green}` : '2px solid transparent', color: C.green, opacity: orderType === 'buy' ? 1 : 0.65, fontWeight: '700', cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span style={{ fontSize: '9px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ask</span>
          <span style={{ fontSize: '13px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: '700' }}>{ask ? fmt(ask, decimals) : '—'}</span>
          <span style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px' }}>BUY</span>
        </button>
        <button onClick={() => setOrderType('sell')} style={{ padding: '12px 8px', background: orderType === 'sell' ? C.redBg : 'transparent', border: 'none', borderBottom: orderType === 'sell' ? `2px solid ${C.red}` : '2px solid transparent', color: C.red, opacity: orderType === 'sell' ? 1 : 0.65, fontWeight: '700', cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span style={{ fontSize: '9px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bid</span>
          <span style={{ fontSize: '13px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: '700' }}>{bid ? fmt(bid, decimals) : '—'}</span>
          <span style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px' }}>SELL</span>
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['Market', 'Limit', 'Stop'].map(t => (
            <button key={t} onClick={() => { setOrderMode(t); if (t !== 'Market' && !limitPrice && price) setLimitPrice(fmt(price, decimals).replace(/,/g, '')); }} style={{ flex: 1, padding: '5px', background: t === orderMode ? C.accentBg : 'transparent', border: `1px solid ${t === orderMode ? C.accent : C.border2}`, borderRadius: '4px', color: t === orderMode ? C.accent : C.muted, fontSize: '10px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>{t}</button>
          ))}
        </div>
        {orderMode !== 'Market' && (
          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: C.muted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{orderType === 'buy' ? 'Buy' : 'Sell'} {orderMode} Price</label>
            <input type="number" value={limitPrice} onChange={e => setLimitPrice(e.target.value)} placeholder={price ? fmt(price, decimals).replace(/,/g, '') : '—'} style={{ width: '100%', boxSizing: 'border-box', padding: '7px 8px', background: C.bg, border: `1px solid ${C.accent}`, borderRadius: '4px', color: C.text, fontSize: '13px', fontWeight: '700', textAlign: 'center', outline: 'none', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
            <div style={{ fontSize: '9px', color: C.muted2, marginTop: '3px', textAlign: 'center' }}>
              {orderType === 'buy' && orderMode === 'Limit' ? `Fills when price drops to ${limitPrice || '…'}` :
               orderType === 'sell' && orderMode === 'Limit' ? `Fills when price rises to ${limitPrice || '…'}` :
               orderType === 'buy' && orderMode === 'Stop' ? `Fills when price rises to ${limitPrice || '…'}` :
               `Fills when price drops to ${limitPrice || '…'}`}
            </div>
          </div>
        )}
        <div>
          <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: C.muted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quantity (Lots)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button onClick={() => setLotSize(v => Math.max(0.01, parseFloat(v) - 0.01).toFixed(2))} style={{ width: '28px', height: '28px', background: C.panel2, border: `1px solid ${C.border2}`, borderRadius: '4px', color: C.text, fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
            <input type="number" value={lotSize} onChange={e => setLotSize(e.target.value)} step="0.01" min="0.01" style={{ flex: 1, padding: '6px 8px', background: C.bg, border: `1px solid ${C.border2}`, borderRadius: '4px', color: C.text, fontSize: '13px', fontWeight: '700', textAlign: 'center', outline: 'none', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
            <button onClick={() => setLotSize(v => (parseFloat(v) + 0.01).toFixed(2))} style={{ width: '28px', height: '28px', background: C.panel2, border: `1px solid ${C.border2}`, borderRadius: '4px', color: C.text, fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: C.red, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stop Loss</label>
            <input type="number" value={sl} onChange={e => setSl(e.target.value)} placeholder="—" style={{ width: '100%', boxSizing: 'border-box', padding: '6px', background: C.bg, border: '1px solid rgba(239,83,80,0.3)', borderRadius: '4px', color: C.text, fontSize: '11px', outline: 'none', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: C.green, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Take Profit</label>
            <input type="number" value={tp} onChange={e => setTp(e.target.value)} placeholder="—" style={{ width: '100%', boxSizing: 'border-box', padding: '6px', background: C.bg, border: '1px solid rgba(38,166,154,0.3)', borderRadius: '4px', color: C.text, fontSize: '11px', outline: 'none', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
          </div>
        </div>
        <div style={{ background: C.bg, borderRadius: '6px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px', border: `1px solid ${C.border}` }}>
          {[['Margin', price ? fmtUSD((price * parseFloat(lotSize || 0) * contractSize(selectedSymbol.symbol)) / (trader?.leverage || 100)) : '—'], ['Leverage', `1:${trader?.leverage || 100}`], ['Pip Value', fmtUSD(parseFloat(lotSize || 0) * contractSize(selectedSymbol.symbol) * pipSize(selectedSymbol.symbol))]].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
              <span style={{ color: C.muted }}>{l}</span>
              <span style={{ color: C.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{v}</span>
            </div>
          ))}
        </div>
        <button onClick={placeOrder} disabled={placing || !price} style={{ padding: '11px', border: 'none', borderRadius: '6px', background: placing || !price ? C.border2 : orderType === 'buy' ? C.green : C.red, color: 'white', fontSize: '13px', fontWeight: '700', cursor: placing || !price ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {placing ? 'Placing...' : orderMode === 'Market' ? `${orderType === 'buy' ? '▲ Buy' : '▼ Sell'} ${selectedSymbol.symbol}` : `Place ${orderType === 'buy' ? 'Buy' : 'Sell'} ${orderMode}`}
        </button>
        <div style={{ background: C.bg, borderRadius: '6px', padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: '5px', border: `1px solid ${C.border}` }}>
          {[{ l: 'Balance', v: fmtUSD(trader?.balance || 0) }, { l: 'Equity', v: fmtUSD((trader?.balance || 0) + totalPnL), c: totalPnL >= 0 ? C.green : C.red }, { l: 'Free Margin', v: fmtUSD(Math.max(0, (trader?.free_margin || 0) + totalPnL)) }, { l: 'Open P&L', v: fmtP(totalPnL), c: totalPnL >= 0 ? C.green : C.red }].map(({ l, v, c }) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
              <span style={{ color: C.muted }}>{l}</span>
              <span style={{ color: c || C.text, fontWeight: '600', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  const PositionsContent = () => (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {tab === 'positions' ? (
        livePositions.length === 0 ? <div style={{ padding: '20px', textAlign: 'center', color: C.muted, fontSize: '12px' }}>No open positions</div> :
          isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px' }}>
              {livePositions.map(p => (
                <div key={p.id} style={{ background: C.panel2, borderRadius: '8px', padding: '10px 12px', border: `1px solid ${C.border2}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <SymbolLogo symbol={p.symbol} size={20} />
                      <span style={{ color: C.text, fontWeight: '700' }}>{p.symbol}</span>
                      <span style={{ color: p.type === 'buy' ? C.green : C.red, fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', background: p.type === 'buy' ? C.greenBg : C.redBg, padding: '2px 6px', borderRadius: '3px' }}>{p.type}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: p.live_profit >= 0 ? C.green : C.red, fontWeight: '700', fontSize: '13px' }}>{fmtP(p.live_profit)}</span>
                      <button onClick={() => closePosition(p)} style={{ background: C.redBg, border: '1px solid rgba(239,83,80,0.3)', borderRadius: '4px', padding: '3px 8px', color: C.red, fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Close</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px' }}>
                    {[['Lots', p.lot_size], ['Open', fmt(p.open_price, decimals)], ['Current', fmt(p.current_price, decimals)]].map(([l, v]) => (
                      <div key={l}><div style={{ fontSize: '9px', color: C.muted, marginBottom: '1px' }}>{l}</div><div style={{ fontSize: '11px', color: C.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{v}</div></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Symbol', 'Type', 'Lots', 'Open', 'Current', 'P&L', 'SL', 'TP', ''].map(h => (
                  <th key={h} style={{ padding: '5px 10px', textAlign: 'left', color: C.muted, fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {livePositions.map(p => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '7px 10px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><SymbolLogo symbol={p.symbol} size={18} /><span style={{ color: C.text, fontWeight: '600' }}>{p.symbol}</span></div></td>
                    <td style={{ padding: '7px 10px' }}><span style={{ color: p.type === 'buy' ? C.green : C.red, fontWeight: '700', textTransform: 'uppercase', fontSize: '10px', background: p.type === 'buy' ? C.greenBg : C.redBg, padding: '2px 5px', borderRadius: '3px' }}>{p.type}</span></td>
                    <td style={{ padding: '7px 10px', color: C.text }}>{p.lot_size}</td>
                    <td style={{ padding: '7px 10px', color: C.muted, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{fmt(p.open_price, decimals)}</td>
                    <td style={{ padding: '7px 10px', color: C.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{fmt(p.current_price, decimals)}</td>
                    <td style={{ padding: '7px 10px', fontWeight: '700', color: p.live_profit >= 0 ? C.green : C.red }}>{fmtP(p.live_profit)}</td>
                    <td style={{ padding: '7px 10px', color: C.muted, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '10px' }}>{p.stop_loss ? fmt(p.stop_loss, decimals) : '—'}</td>
                    <td style={{ padding: '7px 10px', color: C.muted, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '10px' }}>{p.take_profit ? fmt(p.take_profit, decimals) : '—'}</td>
                    <td style={{ padding: '7px 10px' }}><button onClick={() => closePosition(p)} style={{ background: C.redBg, border: '1px solid rgba(239,83,80,0.3)', borderRadius: '3px', padding: '3px 7px', color: C.red, fontSize: '10px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Close</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
      ) : tab === 'pending' ? (
        (() => {
          const myPending = pendingOrders.filter(o => o.trader_id === trader?.id);
          if (myPending.length === 0) return <div style={{ padding: '20px', textAlign: 'center', color: C.muted, fontSize: '12px' }}>No pending orders</div>;
          return isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px' }}>
              {myPending.map(o => (
                <div key={o.id} style={{ background: C.panel2, borderRadius: '8px', padding: '10px 12px', border: `1px solid ${C.border2}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <SymbolLogo symbol={o.symbol} size={20} />
                      <span style={{ color: C.text, fontWeight: '700' }}>{o.symbol}</span>
                      <span style={{ color: o.type === 'buy' ? C.green : C.red, fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', background: o.type === 'buy' ? C.greenBg : C.redBg, padding: '2px 6px', borderRadius: '3px' }}>{o.type} {o.kind}</span>
                    </div>
                    <button onClick={() => cancelPending(o.id)} style={{ background: C.redBg, border: '1px solid rgba(239,83,80,0.3)', borderRadius: '4px', padding: '3px 8px', color: C.red, fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Cancel</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px' }}>
                    {[['Lots', o.lot], ['Entry', fmt(o.entry, symDecimals(o.symbol, o.entry))], ['Now', livePrices[o.symbol] != null ? fmt(livePrices[o.symbol], symDecimals(o.symbol, livePrices[o.symbol])) : '—']].map(([l, v]) => (
                      <div key={l}><div style={{ fontSize: '9px', color: C.muted, marginBottom: '1px' }}>{l}</div><div style={{ fontSize: '11px', color: C.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{v}</div></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Symbol', 'Order', 'Lots', 'Entry', 'Now', 'SL', 'TP', ''].map(h => (
                  <th key={h} style={{ padding: '5px 10px', textAlign: 'left', color: C.muted, fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {myPending.map(o => (
                  <tr key={o.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '7px 10px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><SymbolLogo symbol={o.symbol} size={18} /><span style={{ color: C.text, fontWeight: '600' }}>{o.symbol}</span></div></td>
                    <td style={{ padding: '7px 10px' }}><span style={{ color: o.type === 'buy' ? C.green : C.red, fontWeight: '700', textTransform: 'uppercase', fontSize: '10px', background: o.type === 'buy' ? C.greenBg : C.redBg, padding: '2px 5px', borderRadius: '3px' }}>{o.type} {o.kind}</span></td>
                    <td style={{ padding: '7px 10px', color: C.text }}>{o.lot}</td>
                    <td style={{ padding: '7px 10px', color: C.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{fmt(o.entry, symDecimals(o.symbol, o.entry))}</td>
                    <td style={{ padding: '7px 10px', color: C.muted, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{livePrices[o.symbol] != null ? fmt(livePrices[o.symbol], symDecimals(o.symbol, livePrices[o.symbol])) : '—'}</td>
                    <td style={{ padding: '7px 10px', color: C.muted, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '10px' }}>{o.sl ? fmt(o.sl, symDecimals(o.symbol, o.sl)) : '—'}</td>
                    <td style={{ padding: '7px 10px', color: C.muted, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '10px' }}>{o.tp ? fmt(o.tp, symDecimals(o.symbol, o.tp)) : '—'}</td>
                    <td style={{ padding: '7px 10px' }}><button onClick={() => cancelPending(o.id)} style={{ background: C.redBg, border: '1px solid rgba(239,83,80,0.3)', borderRadius: '3px', padding: '3px 7px', color: C.red, fontSize: '10px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Cancel</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })()
      ) : (
        (() => {
          const myPending = pendingOrders.filter(o => o.trader_id === trader?.id);
          if (history.length === 0 && myPending.length === 0) return <div style={{ padding: '20px', textAlign: 'center', color: C.muted, fontSize: '12px' }}>No trade history</div>;
          return isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px' }}>
              {myPending.map(o => (
                <div key={o.id} style={{ background: C.accentBg, borderRadius: '8px', padding: '10px 12px', border: `1px solid ${C.accent}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <SymbolLogo symbol={o.symbol} size={20} />
                      <span style={{ color: C.text, fontWeight: '700' }}>{o.symbol}</span>
                      <span style={{ color: o.type === 'buy' ? C.green : C.red, fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', background: o.type === 'buy' ? C.greenBg : C.redBg, padding: '2px 6px', borderRadius: '3px' }}>{o.type} {o.kind}</span>
                      <span style={{ color: C.accent, fontSize: '9px', fontWeight: '700', border: `1px solid ${C.accent}`, padding: '1px 5px', borderRadius: '3px' }}>PENDING</span>
                    </div>
                    <button onClick={() => cancelPending(o.id)} style={{ background: C.redBg, border: '1px solid rgba(239,83,80,0.3)', borderRadius: '4px', padding: '3px 8px', color: C.red, fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Cancel</button>
                  </div>
                  <div style={{ fontSize: '10px', color: C.muted }}>{o.lot} lots @ {fmt(o.entry, symDecimals(o.symbol, o.entry))}</div>
                </div>
              ))}
              {history.map(p => (
                <div key={p.id} style={{ background: C.panel2, borderRadius: '8px', padding: '10px 12px', border: `1px solid ${C.border2}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <SymbolLogo symbol={p.symbol} size={20} />
                      <span style={{ color: C.text, fontWeight: '700' }}>{p.symbol}</span>
                      <span style={{ color: p.type === 'buy' ? C.green : C.red, fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', background: p.type === 'buy' ? C.greenBg : C.redBg, padding: '2px 6px', borderRadius: '3px' }}>{p.type}</span>
                    </div>
                    <span style={{ color: p.profit >= 0 ? C.green : C.red, fontWeight: '700' }}>{fmtP(p.profit)}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: C.muted }}>{p.closed_at ? new Date(p.closed_at).toLocaleString() : '—'}</div>
                </div>
              ))}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Symbol', 'Type', 'Lots', 'Open', 'Close', 'P&L', 'Status / Closed At'].map(h => (
                  <th key={h} style={{ padding: '5px 10px', textAlign: 'left', color: C.muted, fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {myPending.map(o => (
                  <tr key={o.id} style={{ borderBottom: `1px solid ${C.border}`, background: C.accentBg }}>
                    <td style={{ padding: '7px 10px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><SymbolLogo symbol={o.symbol} size={18} /><span style={{ color: C.text, fontWeight: '600' }}>{o.symbol}</span></div></td>
                    <td style={{ padding: '7px 10px' }}><span style={{ color: o.type === 'buy' ? C.green : C.red, fontWeight: '700', textTransform: 'uppercase', fontSize: '10px', background: o.type === 'buy' ? C.greenBg : C.redBg, padding: '2px 5px', borderRadius: '3px' }}>{o.type} {o.kind}</span></td>
                    <td style={{ padding: '7px 10px', color: C.text }}>{o.lot}</td>
                    <td style={{ padding: '7px 10px', color: C.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{fmt(o.entry, symDecimals(o.symbol, o.entry))}</td>
                    <td style={{ padding: '7px 10px', color: C.muted2 }}>—</td>
                    <td style={{ padding: '7px 10px' }}><span style={{ color: C.accent, fontSize: '9px', fontWeight: '700', border: `1px solid ${C.accent}`, padding: '1px 5px', borderRadius: '3px' }}>PENDING</span></td>
                    <td style={{ padding: '7px 10px' }}><button onClick={() => cancelPending(o.id)} style={{ background: C.redBg, border: '1px solid rgba(239,83,80,0.3)', borderRadius: '3px', padding: '3px 7px', color: C.red, fontSize: '10px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Cancel</button></td>
                  </tr>
                ))}
                {history.map(p => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '7px 10px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><SymbolLogo symbol={p.symbol} size={18} /><span style={{ color: C.text, fontWeight: '600' }}>{p.symbol}</span></div></td>
                    <td style={{ padding: '7px 10px' }}><span style={{ color: p.type === 'buy' ? C.green : C.red, fontWeight: '700', textTransform: 'uppercase', fontSize: '10px', background: p.type === 'buy' ? C.greenBg : C.redBg, padding: '2px 5px', borderRadius: '3px' }}>{p.type}</span></td>
                    <td style={{ padding: '7px 10px', color: C.text }}>{p.lot_size}</td>
                    <td style={{ padding: '7px 10px', color: C.muted, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{fmt(p.open_price, decimals)}</td>
                    <td style={{ padding: '7px 10px', color: C.muted, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{fmt(p.close_price, decimals)}</td>
                    <td style={{ padding: '7px 10px', fontWeight: '700', color: p.profit >= 0 ? C.green : C.red }}>{fmtP(p.profit)}</td>
                    <td style={{ padding: '7px 10px', color: C.muted, fontSize: '10px' }}>{p.closed_at ? new Date(p.closed_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })()
      )}
    </div>
  );
  const toastOverlay = (
    <div style={{ position: 'fixed', top: '14px', left: '50%', transform: 'translateX(-50%)', zIndex: 3000, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', pointerEvents: 'none' }}>
      <style>{'@keyframes tstoastin{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:translateY(0)}}'}</style>
      {toasts.map(t => (
        <div key={t.id} style={{ minWidth: '250px', maxWidth: '92vw', background: C.panel, border: `1px solid ${C.border2}`, borderLeft: `3px solid ${t.side === 'buy' ? C.green : t.side === 'sell' ? C.red : C.accent}`, borderRadius: '8px', boxShadow: '0 10px 34px rgba(0,0,0,0.45)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '11px', animation: 'tstoastin 0.25s ease', fontFamily: 'Inter,sans-serif' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: '#fff', background: t.side === 'buy' ? C.green : t.side === 'sell' ? C.red : C.accent }}>{t.side === 'buy' ? '▲' : t.side === 'sell' ? '▼' : '✓'}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: C.text, whiteSpace: 'nowrap' }}>{t.title}</div>
            <div style={{ fontSize: '11px', color: C.muted, whiteSpace: 'nowrap' }}>{t.subtitle}</div>
          </div>
        </div>
      ))}
    </div>
  );
  const liveModal = showLiveModal ? (
    <div onClick={() => !liBusy && setShowLiveModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'Inter,sans-serif' }}>
      <form onClick={e => e.stopPropagation()} onSubmit={confirmLive} style={{ background: C.panel, border: `1px solid ${C.border2}`, borderRadius: '14px', width: '360px', maxWidth: '100%', padding: '26px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ background: C.green, color: '#fff', fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '5px', letterSpacing: '0.5px' }}>LIVE</span>
          <span style={{ color: C.text, fontSize: '16px', fontWeight: '700' }}>Switch to Live mode</span>
        </div>
        <div style={{ color: C.muted, fontSize: '12.5px', marginBottom: '18px', lineHeight: 1.5 }}>You're now entering Live mode with real-money spreads. Please confirm your TradeScope credentials (the login we provided when you became a client).</div>
        {liErr && <div style={{ background: 'rgba(242,54,69,0.12)', border: `1px solid ${C.red}`, color: C.red, fontSize: '12px', padding: '9px 12px', borderRadius: '8px', marginBottom: '14px' }}>{liErr}</div>}
        <label style={{ display: 'block', color: C.muted, fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>Email</label>
        <input type="email" value={liEmail} onChange={e => setLiEmail(e.target.value)} required autoFocus placeholder="you@email.com" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: C.bg, border: `1px solid ${C.border2}`, borderRadius: '8px', color: C.text, fontSize: '14px', outline: 'none', marginBottom: '14px', fontFamily: 'Inter,sans-serif' }} />
        <label style={{ display: 'block', color: C.muted, fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>Password</label>
        <input type="password" value={liPwd} onChange={e => setLiPwd(e.target.value)} required placeholder="••••••••" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: C.bg, border: `1px solid ${C.border2}`, borderRadius: '8px', color: C.text, fontSize: '14px', outline: 'none', marginBottom: '18px', fontFamily: 'Inter,sans-serif' }} />
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" onClick={() => setShowLiveModal(false)} disabled={liBusy} style={{ flex: 1, padding: '11px', background: 'transparent', border: `1px solid ${C.border2}`, borderRadius: '8px', color: C.muted, fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Cancel</button>
          <button type="submit" disabled={liBusy} style={{ flex: 1, padding: '11px', background: C.green, border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: liBusy ? 'not-allowed' : 'pointer', opacity: liBusy ? 0.7 : 1, fontFamily: 'Inter,sans-serif' }}>{liBusy ? 'Confirming…' : 'Confirm & go Live'}</button>
        </div>
      </form>
    </div>
  ) : null;
  if (isMobile) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: "'Inter',sans-serif", overflow: 'hidden' }}>
        {toastOverlay}{liveModal}
        <div style={{ height: '52px', background: C.panel, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: '8px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '22px', height: '22px', background: 'linear-gradient(135deg,#2962FF,#00B8D9)', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="11" height="11" viewBox="0 0 18 18" fill="none"><polyline points="2,12 6,7 10,10 16,4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <span style={{ color: C.text, fontWeight: '700', fontSize: '13px' }}>TradeScope</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: C.panel2, border: `1px solid ${C.border2}`, borderRadius: '6px', padding: '2px', marginLeft: '4px' }}>
              <button onClick={() => liveTrader ? setModeChoice('live') : setShowLiveModal(true)} style={{ padding: '3px 9px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Inter,sans-serif', background: !isDemo ? C.green : 'transparent', color: !isDemo ? '#fff' : C.muted }}>Live</button>
              <button onClick={() => setModeChoice('demo')} style={{ padding: '3px 9px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Inter,sans-serif', background: isDemo ? C.accent : 'transparent', color: isDemo ? '#fff' : C.muted }}>Demo</button>
            </div>
          </div>
          <div style={{ position: 'relative', flex: 1 }}>
            <button onClick={() => setShowSymbols(!showSymbols)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: C.panel2, border: `1px solid ${C.border2}`, borderRadius: '6px', padding: '5px 10px', color: C.text, cursor: 'pointer', fontSize: '13px', fontWeight: '700', width: '100%', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><SymbolLogo symbol={selectedSymbol.symbol} size={18} /><span>{selectedSymbol.symbol}</span></div>
              <ChevronDown size={12} color={C.muted} />
            </button>
            {showSymbols && (
              <div style={{ position: 'absolute', top: '38px', left: 0, right: 0, background: C.panel, border: `1px solid ${C.border2}`, borderRadius: '8px', zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                <div style={{ padding: '8px', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: C.bg, borderRadius: '6px', padding: '6px 10px' }}>
                    <Search size={12} color={C.muted} />
                    <input value={symbolSearch} onChange={e => handleSymbolSearch(e.target.value)} placeholder="Search any symbol..." autoFocus style={{ background: 'none', border: 'none', color: C.text, fontSize: '13px', outline: 'none', width: '100%', fontFamily: 'Inter,sans-serif' }} />
                    {symbolSearch && <button onClick={() => { setSymbolSearch(''); setSearchResults([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 0, display: 'flex' }}><X size={12} /></button>}
                  </div>
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {searchLoading && <div style={{ padding: '16px', textAlign: 'center', color: C.muted, fontSize: '12px' }}>Searching...</div>}
                  {!symbolSearch && DEFAULT_SYMBOLS.map(sym => (
                    <button key={sym.symbol} onClick={() => { setSelectedSymbol(sym); setShowSymbols(false); setSymbolSearch(''); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: selectedSymbol.symbol === sym.symbol ? C.accentBg : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                      <SymbolLogo symbol={sym.symbol} size={22} />
                      <span style={{ flex: 1, textAlign: 'left', fontSize: '13px', fontWeight: '600', color: selectedSymbol.symbol === sym.symbol ? C.accent : C.text }}>{sym.symbol}</span>
                      <span style={{ fontSize: '11px', color: C.muted, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{livePrices[sym.symbol] ? fmt(livePrices[sym.symbol], decimals) : sym.change}</span>
                    </button>
                  ))}
                  {searchResults.map((sym, i) => (
                    <button key={sym.symbol + '|' + i} onClick={() => { setSelectedSymbol(sym); setShowSymbols(false); setSymbolSearch(''); setSearchResults([]); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                      <SymbolLogo symbol={sym.symbol} size={22} />
                      <span style={{ flex: 1, textAlign: 'left', fontSize: '13px', fontWeight: '600', color: C.text }}>{sym.symbol}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: priceChange >= 0 ? C.green : C.red, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: 1 }}>{price ? fmt(price, decimals) : '—'}</div>
            <div style={{ fontSize: '10px', color: priceChange >= 0 ? C.green : C.red, marginTop: '1px' }}>{priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%</div>
          </div>
          <button onClick={handleSignOut} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '4px', display: 'flex', alignItems: 'center', flexShrink: 0 }}><LogOut size={16} /></button>
        </div>
        <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, display: 'flex', padding: '6px 12px', gap: '4px', flexShrink: 0, overflowX: 'auto' }}>
          {INTERVALS.map(iv => (<button key={iv.value} onClick={() => { setActiveInterval(iv.value); try{localStorage.setItem('ts_interval',iv.value);}catch{} }} style={{ padding: '4px 10px', background: activeInterval === iv.value ? C.accentBg : 'transparent', border: activeInterval === iv.value ? '1px solid rgba(41,98,255,0.4)' : '1px solid transparent', borderRadius: '4px', color: activeInterval === iv.value ? C.accent : C.muted, fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>{iv.label}</button>))}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          <div style={{ display: mobileView === 'chart' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
              {chartLoading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme === 'dark' ? 'rgba(19,23,34,0.6)' : 'rgba(255,255,255,0.55)', zIndex: 12, pointerEvents: 'none' }}>
                  <style>{'@keyframes tsspin{to{transform:rotate(360deg)}}'}</style>
                  <span style={{ width: '18px', height: '18px', border: `2px solid ${C.border2}`, borderTopColor: C.accent, borderRadius: '50%', display: 'inline-block', animation: 'tsspin 0.7s linear infinite' }} />
                </div>
              )}
            </div>
          </div>
          <div style={{ display: mobileView === 'positions' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.panel, flexShrink: 0 }}>
              {['positions', 'pending', 'history'].map(t => (<button key={t} onClick={() => setTab(t)} style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: tab === t ? `2px solid ${C.accent}` : '2px solid transparent', color: tab === t ? C.text : C.muted, fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>{t === 'positions' ? `Open (${positions.length})` : t === 'pending' ? `Pending (${pendingOrders.filter(o => o.trader_id === trader?.id).length})` : `History (${history.length})`}</button>))}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: '12px' }}>
                <span style={{ fontSize: '10px', color: C.muted }}>P&L: <span style={{ color: totalPnL >= 0 ? C.green : C.red, fontWeight: '700' }}>{fmtP(totalPnL)}</span></span>
              </div>
            </div>
            {PositionsContent()}
          </div>
        </div>
        {showOrderDrawer && (<>
          <div onClick={() => setShowOrderDrawer(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 90 }} />
          <div style={{ position: 'fixed', bottom: '56px', left: 0, right: 0, background: C.panel, border: `1px solid ${C.border2}`, borderRadius: '16px 16px 0 0', zIndex: 100, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><SymbolLogo symbol={selectedSymbol.symbol} size={22} /><span style={{ color: C.text, fontWeight: '700', fontSize: '14px' }}>Place Order · {selectedSymbol.symbol}</span></div>
              <button onClick={() => setShowOrderDrawer(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, display: 'flex' }}><X size={18} /></button>
            </div>
            {OrderPanelContent()}
          </div>
        </>)}
        <div style={{ height: '56px', background: C.panel, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', flexShrink: 0, zIndex: 50 }}>
          <button onClick={() => { setMobileView('chart'); setShowOrderDrawer(false); }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
            <BarChart2 size={18} color={mobileView === 'chart' ? C.accent : C.muted} />
            <span style={{ fontSize: '9px', color: mobileView === 'chart' ? C.accent : C.muted, fontWeight: '600', fontFamily: 'Inter,sans-serif' }}>Chart</span>
          </button>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <button onClick={() => setShowOrderDrawer(!showOrderDrawer)} style={{ width: '48px', height: '48px', background: showOrderDrawer ? C.panel2 : 'linear-gradient(135deg,#2962FF,#00B8D9)', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(41,98,255,0.3)', transform: 'translateY(-8px)' }}>
              {showOrderDrawer ? <X size={20} color="white" /> : <TrendingUp size={20} color="white" />}
            </button>
          </div>
          <button onClick={() => { setMobileView('positions'); setShowOrderDrawer(false); }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={mobileView === 'positions' ? C.accent : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
              {positions.length > 0 && <div style={{ position: 'absolute', top: '-4px', right: '-6px', background: C.accent, borderRadius: '10px', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '8px', color: 'white', fontWeight: '700' }}>{positions.length}</span></div>}
            </div>
            <span style={{ fontSize: '9px', color: mobileView === 'positions' ? C.accent : C.muted, fontWeight: '600', fontFamily: 'Inter,sans-serif' }}>Positions</span>
          </button>
        </div>
      </div>
    );
  }
  return (<>
    {toastOverlay}{liveModal}
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: "'Inter',sans-serif", overflow: 'hidden', color: C.text }}>
      <div style={{ height: '46px', background: C.panel, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 8px', gap: '4px', flexShrink: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', paddingRight: '8px', borderRight: `1px solid ${C.border}`, marginRight: '4px' }}>
          <div style={{ width: '22px', height: '22px', background: 'linear-gradient(135deg,#2962FF,#00B8D9)', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="11" height="11" viewBox="0 0 18 18" fill="none"><polyline points="2,12 6,7 10,10 16,4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <span style={{ color: C.text, fontWeight: '700', fontSize: '13px', letterSpacing: '-0.3px' }}>TradeScope</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1px', background: C.panel2, borderRadius: '5px', padding: '2px' }}>
            <button onClick={() => liveTrader ? setModeChoice('live') : setShowLiveModal(true)} style={{ padding: '2px 6px', borderRadius: '3px', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: '700', fontFamily: 'Inter,sans-serif', background: !isDemo ? C.green : 'transparent', color: !isDemo ? '#fff' : C.muted }}>Live</button>
            <button onClick={() => setModeChoice('demo')} style={{ padding: '2px 6px', borderRadius: '3px', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: '700', fontFamily: 'Inter,sans-serif', background: isDemo ? C.accent : 'transparent', color: isDemo ? '#fff' : C.muted }}>Demo</button>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowSymbols(!showSymbols)} style={{ display: 'flex', alignItems: 'center', gap: '7px', background: showSymbols ? C.panel2 : 'transparent', border: `1px solid ${showSymbols ? C.border2 : 'transparent'}`, borderRadius: '4px', padding: '4px 8px', color: C.text, cursor: 'pointer', fontSize: '13px', fontWeight: '700', fontFamily: 'Inter,sans-serif' }}>
            <SymbolLogo symbol={selectedSymbol.symbol} size={18} />
            {selectedSymbol.symbol}
            <ChevronDown size={11} color={C.muted} />
          </button>
          {showSymbols && (
            <div style={{ position: 'absolute', top: '36px', left: 0, background: C.panel, border: `1px solid ${C.border2}`, borderRadius: '8px', width: '290px', zIndex: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
              <div style={{ padding: '8px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: C.bg, borderRadius: '6px', padding: '7px 10px' }}>
                  <Search size={13} color={C.muted} />
                  <input value={symbolSearch} onChange={e => handleSymbolSearch(e.target.value)} placeholder="Search any symbol..." autoFocus style={{ background: 'none', border: 'none', color: C.text, fontSize: '13px', outline: 'none', width: '100%', fontFamily: 'Inter,sans-serif' }} />
                  {symbolSearch && <button onClick={() => { setSymbolSearch(''); setSearchResults([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 0, display: 'flex' }}><X size={11} /></button>}
                </div>
              </div>
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {searchLoading && <div style={{ padding: '16px', textAlign: 'center', color: C.muted, fontSize: '12px' }}>Searching...</div>}
                {!searchLoading && symbolSearch && searchResults.length === 0 && <div style={{ padding: '16px', textAlign: 'center', color: C.muted, fontSize: '12px' }}>No results found</div>}
                {!symbolSearch && (<>
                  <div style={{ padding: '6px 12px', fontSize: '10px', fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: '1px' }}>Popular</div>
                  {DEFAULT_SYMBOLS.map(sym => (
                    <button key={sym.symbol} onClick={() => { setSelectedSymbol(sym); setShowSymbols(false); setSymbolSearch(''); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: selectedSymbol.symbol === sym.symbol ? C.accentBg : 'transparent', border: 'none', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                      <SymbolLogo symbol={sym.symbol} size={22} />
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: selectedSymbol.symbol === sym.symbol ? C.accent : C.text }}>{sym.symbol}</div>
                        <div style={{ fontSize: '10px', color: C.muted }}>{sym.label}</div>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: C.muted, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{livePrices[sym.symbol] ? fmt(livePrices[sym.symbol], 5) : sym.change}</span>
                    </button>
                  ))}
                </>)}
                {searchResults.map((sym, i) => (
                  <button key={sym.symbol + '|' + i} onClick={() => { setSelectedSymbol(sym); setShowSymbols(false); setSymbolSearch(''); setSearchResults([]); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'transparent', border: 'none', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                    <SymbolLogo symbol={sym.symbol} size={22} />
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: C.text }}>{sym.symbol}</div>
                      <div style={{ fontSize: '10px', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{sym.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ position: 'relative', marginLeft: '4px' }}>
          <button onClick={() => setShowIntervals(!showIntervals)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: showIntervals ? C.accentBg : 'transparent', border: `1px solid ${showIntervals ? C.accent : 'transparent'}`, borderRadius: '4px', color: C.accent, fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Inter,sans-serif', letterSpacing: '0.2px' }}>
            {activeLabel}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6,9 12,15 18,9" /></svg>
          </button>
          {showIntervals && (
            <div style={{ position: 'absolute', top: '32px', left: 0, background: C.panel, border: `1px solid ${C.border2}`, borderRadius: '8px', zIndex: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', minWidth: '160px', padding: '6px' }}>
              {INTERVAL_GROUPS.map(group => (
                <div key={group.label}>
                  <div style={{ fontSize: '9px', fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: '1px', padding: '4px 8px 2px' }}>{group.label}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', padding: '2px 4px 8px' }}>
                    {group.options.map(opt => {
                      const iv = INTERVALS.find(i => i.label === opt);
                      if (!iv) return null;
                      return (<button key={iv.value} onClick={() => { setActiveInterval(iv.value); setShowIntervals(false); try { localStorage.setItem('ts_interval', iv.value); } catch { } }} style={{ padding: '4px 10px', background: activeInterval === iv.value ? C.accent : 'transparent', border: `1px solid ${activeInterval === iv.value ? C.accent : C.border2}`, borderRadius: '4px', color: activeInterval === iv.value ? 'white' : C.text, fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>{iv.label}</button>);
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ width: '1px', height: '20px', background: C.border2, margin: '0 6px' }} />
        <button onClick={() => setShowIndicators(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: activeIndicators.length > 0 ? C.accentBg : 'transparent', border: `1px solid ${activeIndicators.length > 0 ? C.accent : 'transparent'}`, borderRadius: '4px', color: activeIndicators.length > 0 ? C.accent : C.muted, fontSize: '12px', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
          Indicators{activeIndicators.length > 0 ? ` (${activeIndicators.length})` : ''}
        </button>
        <button onClick={() => { setDrawings(prev => prev.slice(0, -1)); setSelectedDrawing(null); }} disabled={drawings.length === 0}
          title="Undo (Ctrl+Z)"
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: 'transparent', border: '1px solid transparent', borderRadius: '4px', color: drawings.length === 0 ? C.muted2 : C.muted, fontSize: '11px', cursor: drawings.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7v6h6" /><path d="M3 13C5 8 9 5 14 5c4 0 7 2.5 8 6" /></svg>
          Undo
        </button>
        {selectedDrawing !== null && (
          <button onClick={() => { setDrawings(prev => prev.filter((_, i) => i !== selectedDrawing)); setSelectedDrawing(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: C.redBg, border: `1px solid rgba(239,83,80,0.3)`, borderRadius: '4px', color: C.red, fontSize: '11px', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6" /><path d="M19 6l-1 14H6L5 6" /><path d="M9 6V4h6v2" /></svg>
            Delete
          </button>
        )}
        <div style={{ marginLeft: '4px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '15px', fontWeight: '700', color: priceChange >= 0 ? C.green : C.red, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{price ? fmt(price, decimals) : '—'}</span>
          <span style={{ fontSize: '11px', color: priceChange >= 0 ? C.green : C.red }}>{priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginRight: '8px' }}>
          {[['Balance', fmtUSD(trader?.balance || 0)], ['P&L', fmtP(totalPnL), totalPnL >= 0 ? C.green : C.red], ['Equity', fmtUSD((trader?.balance || 0) + totalPnL)]].map(([l, v, c]) => (
            <div key={l} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '9px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{l}</div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: c || C.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{v}</div>
            </div>
          ))}
        </div>
        <button onClick={() => setShowOrderPanel(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', marginRight: '4px', background: showOrderPanel ? C.accent : C.green, border: 'none', borderRadius: '5px', color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Inter,sans-serif', letterSpacing: '0.3px' }}>
          <TrendingUp size={14} /> Trade
        </button>
        <button onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '4px', display: 'flex' }} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button>
        <button onClick={handleSignOut} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '4px', display: 'flex' }} title="Sign out"><LogOut size={14} /></button>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: '48px', background: C.panel, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: '1px', flexShrink: 0, overflowY: 'auto' }}>
          {LEFT_TOOLS.map((tool, i) => {
            const prev = i > 0 ? LEFT_TOOLS[i - 1].group : tool.group;
            const isMagnet = tool.title === 'Magnet';
            const isActive = isMagnet ? magnetOn : (activeTool === tool.title && tool.title !== 'Back');
            const disabled = drawings.length === 0 && tool.title === 'Back';
            return (<div key={tool.title} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {i > 0 && tool.group !== prev && <div style={{ width: '28px', height: '1px', background: C.border2, margin: '4px 0' }} />}
              <button onClick={() => {
                if (tool.title === 'Back') {
                  setDrawings(prev => prev.length === 0 ? prev : prev.slice(0, -1));
                  setSelectedDrawing(null);
                } else if (isMagnet) {
                  setMagnetOn(v => !v);
                } else {
                  setActiveTool(tool.title);
                }
              }} title={isMagnet ? 'Magnet (snap to OHLC)' : tool.title} aria-label={tool.title} aria-pressed={isActive} style={{ width: '36px', height: '36px', background: isActive ? C.accentBg : 'transparent', border: 'none', borderRadius: '6px', color: disabled ? C.muted2 : isActive ? C.accent : C.muted, cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                {tool.icon}
              </button>
            </div>);
          })}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
            <canvas
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: canvasCursor(), pointerEvents: activeTool === 'Crosshair' || activeTool === 'Cursor' ? 'none' : 'all', zIndex: 10 }}
            />
            {/* TradingView-style quick Sell/Buy buttons, top-left of the chart — open the order panel pre-set to that side */}
            <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 15, display: 'flex', alignItems: 'stretch', pointerEvents: 'none', fontFamily: 'Inter,sans-serif' }}>
              <button onClick={() => { setOrderType('sell'); setShowOrderPanel(true); }} title="Sell" style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', padding: '5px 12px', background: C.redBg, border: `1px solid ${C.red}`, borderRadius: '5px', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: C.red, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{bid ? fmt(bid, decimals) : '—'}</span>
                <span style={{ fontSize: '9px', fontWeight: '700', color: C.red, letterSpacing: '0.5px' }}>SELL</span>
              </button>
              <div style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', fontSize: '10px', fontWeight: '600', color: C.muted }}>{(bid && ask) ? ((ask - bid) / pipSize(selectedSymbol.symbol)).toFixed(1) : ''}</div>
              <button onClick={() => { setOrderType('buy'); setShowOrderPanel(true); }} title="Buy" style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', padding: '5px 12px', background: C.greenBg, border: `1px solid ${C.green}`, borderRadius: '5px', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: C.green, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{ask ? fmt(ask, decimals) : '—'}</span>
                <span style={{ fontSize: '9px', fontWeight: '700', color: C.green, letterSpacing: '0.5px' }}>BUY</span>
              </button>
            </div>
            {activeTool === 'Cursor' && (
              <div
                onClick={handleCanvasMouseDown}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'default', zIndex: 11, background: 'transparent' }}
              />
            )}
            {chartLoading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme === 'dark' ? 'rgba(19,23,34,0.6)' : 'rgba(255,255,255,0.55)', zIndex: 12, pointerEvents: 'none' }}>
                <style>{'@keyframes tsspin{to{transform:rotate(360deg)}}'}</style>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: C.muted, fontSize: '12px', fontFamily: 'Inter,sans-serif' }}>
                  <span style={{ width: '15px', height: '15px', border: `2px solid ${C.border2}`, borderTopColor: C.accent, borderRadius: '50%', display: 'inline-block', animation: 'tsspin 0.7s linear infinite' }} />
                  Loading {selectedSymbol.symbol}…
                </div>
              </div>
            )}
          </div>
          {showOrderPanel && showPositions && (
          <div style={{ position: 'absolute', left: '12px', right: '12px', bottom: '12px', height: '210px', background: C.panel, border: `1px solid ${C.border2}`, borderRadius: '8px', boxShadow: '0 8px 30px rgba(0,0,0,0.45)', zIndex: 40, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0, alignItems: 'center', background: C.panel }}>
              {['positions', 'pending', 'history'].map(t => (<button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: tab === t ? `2px solid ${C.accent}` : '2px solid transparent', color: tab === t ? C.text : C.muted, fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>{t === 'positions' ? `Open Positions (${positions.length})` : t === 'pending' ? `Pending (${pendingOrders.filter(o => o.trader_id === trader?.id).length})` : `History (${history.length})`}</button>))}
              <div style={{ marginLeft: 'auto', paddingRight: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '11px', color: C.muted }}>P&L: <span style={{ color: totalPnL >= 0 ? C.green : C.red, fontWeight: '700' }}>{fmtP(totalPnL)}</span></span>
                <button onClick={() => setShowPositions(false)} title="Hide positions" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, display: 'flex', padding: 0 }}><X size={15} /></button>
              </div>
            </div>
            {PositionsContent()}
          </div>
          )}
          {showOrderPanel && !showPositions && (
            <button onClick={() => setShowPositions(true)} style={{ position: 'absolute', left: '12px', bottom: '12px', zIndex: 40, background: C.panel, border: `1px solid ${C.border2}`, borderRadius: '6px', boxShadow: '0 4px 14px rgba(0,0,0,0.4)', padding: '7px 12px', color: C.text, fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <BarChart2 size={13} color={C.accent} /> Positions ({positions.length}) · History
            </button>
          )}
        </div>
        {showOrderPanel && (
        <div style={{ width: '288px', background: C.panel, borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><SymbolLogo symbol={selectedSymbol.symbol} size={18} /><span style={{ color: C.text, fontWeight: '700', fontSize: '13px' }}>{selectedSymbol.symbol}</span></div>
            <button onClick={() => setShowOrderPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, display: 'flex' }} title="Close"><X size={16} /></button>
          </div>
          {OrderPanelContent()}
        </div>
        )}
        {watchlistCollapsed ? (
          <div onClick={() => setWatchlistCollapsed(false)} role="button" tabIndex={0} aria-label="Show watchlist" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setWatchlistCollapsed(false); } }} title="Show watchlist" style={{ width: '36px', flexShrink: 0, background: C.panel, borderLeft: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '11px', fontWeight: '700', color: C.muted, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Watchlist</span>
          </div>
        ) : (
        <div style={{ width: '320px', background: C.panel, borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: C.text }}>Watchlist</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ position: 'relative', display: 'flex' }}>
                <button onClick={() => setShowAddSymbol(v => !v)} title="Add symbol" aria-label="Add symbol to watchlist" style={{ background: showAddSymbol ? C.accentBg : 'none', border: 'none', cursor: 'pointer', color: showAddSymbol ? C.accent : C.muted, display: 'flex', padding: '3px', borderRadius: '5px' }}><Plus size={15} /></button>
                {showAddSymbol && (<>
                  <div onClick={() => { setShowAddSymbol(false); setSymbolSearch(''); setSearchResults([]); }} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '270px', maxHeight: '420px', display: 'flex', flexDirection: 'column', background: C.panel, border: `1px solid ${C.border2}`, borderRadius: '8px', boxShadow: '0 10px 34px rgba(0,0,0,0.45)', zIndex: 61, overflow: 'hidden' }}>
                    <div style={{ padding: '10px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: C.panel2, borderRadius: '7px', padding: '7px 10px' }}>
                        <Search size={14} color={C.muted} />
                        <input value={symbolSearch} onChange={e => handleSymbolSearch(e.target.value)} placeholder="Search any asset…" autoFocus style={{ background: 'none', border: 'none', outline: 'none', fontSize: '13px', color: C.text, width: '100%', fontFamily: 'Inter,sans-serif' }} />
                        {symbolSearch && <X size={14} color={C.muted} style={{ cursor: 'pointer' }} onClick={() => { setSymbolSearch(''); setSearchResults([]); }} />}
                      </div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                      {symbolSearch.trim() ? (
                        searchLoading ? <div style={{ padding: '16px', textAlign: 'center', color: C.muted, fontSize: '12px' }}>Searching…</div>
                        : searchResults.length === 0 ? <div style={{ padding: '16px', textAlign: 'center', color: C.muted, fontSize: '12px' }}>No results found</div>
                        : searchResults.map((res, i) => {
                          const inList = watchSyms.includes(res.symbol);
                          return (<button key={res.symbol + '|' + i} onClick={() => inList ? setWatchSyms(p => p.filter(s => s !== res.symbol)) : addSearchedSymbol(res)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                            <SymbolLogo symbol={res.symbol} size={22} />
                            <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
                              <div style={{ fontSize: '12px', fontWeight: '600', color: C.text }}>{res.symbol}</div>
                              <div style={{ fontSize: '10px', color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.label}</div>
                            </div>
                            {inList ? <Check size={15} color={C.accent} /> : <Plus size={15} color={C.muted2} />}
                          </button>);
                        })
                      ) : (<>
                        {['Forex', 'Crypto', 'Stocks', 'Indices'].map(group => {
                          const gs = watchPool.filter(s => s.type === group);
                          if (!gs.length) return null;
                          return (<div key={group}>
                            <div style={{ padding: '5px 12px', fontSize: '9px', fontWeight: '700', color: C.muted2, textTransform: 'uppercase', letterSpacing: '0.8px', background: C.panel2 }}>{group}</div>
                            {gs.map(sym => {
                              const inList = watchSyms.includes(sym.symbol);
                              return (<button key={sym.symbol} onClick={() => toggleWatch(sym.symbol)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                                <SymbolLogo symbol={sym.symbol} size={22} />
                                <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
                                  <div style={{ fontSize: '12px', fontWeight: '600', color: C.text }}>{sym.symbol}</div>
                                  <div style={{ fontSize: '10px', color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sym.label}</div>
                                </div>
                                {inList ? <Check size={15} color={C.accent} /> : <Plus size={15} color={C.muted2} />}
                              </button>);
                            })}
                          </div>);
                        })}
                      </>)}
                    </div>
                  </div>
                </>)}
              </div>
              <button onClick={() => setWatchlistCollapsed(true)} title="Hide watchlist" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, display: 'flex', padding: 0 }}><ChevronRight size={16} /></button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', padding: '7px 14px', gap: '10px', borderBottom: `1px solid ${C.border}` }}>
            {['Symbol', 'Last', 'Chg', 'Chg%'].map(h => (<span key={h} style={{ fontSize: '10px', color: C.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: h !== 'Symbol' ? 'right' : 'left' }}>{h}</span>))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {watchSyms.length === 0 && (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: C.muted, fontSize: '12px' }}>
                Your watchlist is empty.<br />Tap <Plus size={12} style={{ verticalAlign: 'middle' }} /> to add assets.
              </div>
            )}
            {['Forex', 'Crypto', 'Stocks', 'Indices'].map(group => {
              const syms = watchPool.filter(s => s.type === group && watchSyms.includes(s.symbol));
              if (!syms.length) return null;
              return (<div key={group}>
                <div style={{ padding: '7px 14px', fontSize: '10px', fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: '1px', background: C.panel2, borderBottom: `1px solid ${C.border}` }}>{group}</div>
                {syms.map(sym => {
                  const lp = livePrices[sym.symbol];
                  const q = quotes[sym.symbol];
                  const last = lp ?? q?.close ?? null;
                  const dec = symDecimals(sym.symbol, last);
                  const chg = dayChangePct(sym.symbol, lp, q);
                  const chgAbs = (last != null && q?.prevClose) ? last - q.prevClose : null;
                  return (<button key={sym.symbol} onClick={() => setSelectedSymbol(sym)} style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr auto auto auto', padding: '10px 14px', gap: '10px', alignItems: 'center', background: selectedSymbol.symbol === sym.symbol ? C.accentBg : 'transparent', border: 'none', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', overflow: 'hidden' }}>
                      <SymbolLogo symbol={sym.symbol} size={26} />
                      <span style={{ fontSize: '13px', fontWeight: '600', color: selectedSymbol.symbol === sym.symbol ? C.accent : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sym.symbol}</span>
                    </div>
                    <span style={{ fontSize: '12px', color: C.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', textAlign: 'right' }}>{last != null ? fmt(last, dec) : '—'}</span>
                    <span style={{ fontSize: '12px', color: chgAbs == null ? C.muted : chgAbs >= 0 ? C.green : C.red, fontWeight: '600', textAlign: 'right', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{chgAbs == null ? '—' : `${chgAbs >= 0 ? '+' : ''}${chgAbs.toFixed(dec >= 4 ? 4 : 2)}`}</span>
                    <span style={{ fontSize: '12px', color: chg == null ? C.muted : chg >= 0 ? C.green : C.red, fontWeight: '600', textAlign: 'right', minWidth: '48px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{chg == null ? '—' : `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`}</span>
                  </button>);
                })}
              </div>);
            })}
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, background: C.bg, overflowY: 'auto', maxHeight: detailExpanded ? '560px' : 'none', flexShrink: 0 }}>
            <div onClick={() => setDetailExpanded(v => !v)} role="button" tabIndex={0} aria-expanded={detailExpanded} aria-label={detailExpanded ? 'Collapse details' : 'Expand details'} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailExpanded(v => !v); } }} style={{ padding: '10px 12px 8px', cursor: 'pointer', position: 'relative' }}>
              <ChevronDown size={18} color={C.muted} style={{ position: 'absolute', top: '12px', right: '12px', transform: detailExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', paddingRight: '22px' }}>
                <SymbolLogo symbol={selectedSymbol.symbol} size={26} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: C.text }}>{selectedSymbol.symbol}</div>
                  <div style={{ fontSize: '10px', color: C.muted }}>{selectedSymbol.label}</div>
                </div>
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: priceChange >= 0 ? C.green : C.red, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: 1, letterSpacing: '-0.5px' }}>{price ? fmt(price, decimals) : '—'}</div>
              <div style={{ fontSize: '11px', color: priceChange >= 0 ? C.green : C.red, marginTop: '2px', fontWeight: '600' }}>{priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: quotes[selectedSymbol.symbol]?.isOpen === false ? C.muted2 : C.green }} />
                <span style={{ fontSize: '10px', color: C.muted, fontWeight: '500' }}>{quotes[selectedSymbol.symbol]?.isOpen === false ? 'Market closed' : 'Market open'}</span>
              </div>
            </div>
            {detailExpanded && (<>
            <div style={{ padding: '0 12px 12px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: C.text, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '8px' }}>Performance</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px' }}>
                {[{ label: '1D', value: dayChangePct(selectedSymbol.symbol, price, quotes[selectedSymbol.symbol]) ?? priceChange }, { label: '1W', value: perf['1W'] ?? null }, { label: '1M', value: perf['1M'] ?? null }, { label: '3M', value: perf['3M'] ?? null }, { label: '6M', value: perf['6M'] ?? null }, { label: '1Y', value: perf['1Y'] ?? null }].map(({ label, value }) => (
                  <div key={label} style={{ background: value == null ? C.panel : value >= 0 ? 'rgba(38,166,154,0.1)' : 'rgba(239,83,80,0.1)', borderRadius: '5px', padding: '5px 6px', textAlign: 'center', border: `1px solid ${value == null ? C.border : value >= 0 ? 'rgba(38,166,154,0.25)' : 'rgba(239,83,80,0.25)'}` }}>
                    <div style={{ fontSize: '9px', color: C.muted, marginBottom: '2px', fontWeight: '600' }}>{label}</div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: value == null ? C.muted2 : value >= 0 ? C.green : C.red }}>{value == null ? '—' : `${value >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '4px 12px 16px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: C.text, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '4px' }}>Technicals</div>
              {technical ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <svg width="190" height="108" viewBox="0 0 200 112">
                    <path d="M20 100 A80 80 0 0 1 35.3 53" fill="none" stroke={C.red} strokeWidth="11" strokeLinecap="round" />
                    <path d="M35.3 53 A80 80 0 0 1 75.3 23.9" fill="none" stroke="rgba(239,83,80,0.5)" strokeWidth="11" />
                    <path d="M75.3 23.9 A80 80 0 0 1 124.7 23.9" fill="none" stroke={C.muted2} strokeWidth="11" />
                    <path d="M124.7 23.9 A80 80 0 0 1 164.7 53" fill="none" stroke="rgba(38,166,154,0.5)" strokeWidth="11" />
                    <path d="M164.7 53 A80 80 0 0 1 180 100" fill="none" stroke={C.green} strokeWidth="11" strokeLinecap="round" />
                    <line x1="100" y1="100" x2={100 + 62 * Math.cos((90 - technical.score * 90) * Math.PI / 180)} y2={100 - 62 * Math.sin((90 - technical.score * 90) * Math.PI / 180)} stroke={C.text} strokeWidth="3" strokeLinecap="round" />
                    <circle cx="100" cy="100" r="6" fill={C.text} />
                    <text x="16" y="110" fill={C.muted} fontSize="9" fontFamily="Inter,sans-serif">Strong sell</text>
                    <text x="184" y="110" fill={C.muted} fontSize="9" fontFamily="Inter,sans-serif" textAnchor="end">Strong buy</text>
                  </svg>
                  <div style={{ fontSize: '16px', fontWeight: '700', marginTop: '-8px', color: technical.label.includes('buy') ? C.green : technical.label.includes('sell') ? C.red : C.muted }}>{technical.label}</div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '10px', fontWeight: '600' }}>
                    <span style={{ color: C.red }}>Sell {technical.sell}</span>
                    <span style={{ color: C.muted }}>Neutral {technical.neutral}</span>
                    <span style={{ color: C.green }}>Buy {technical.buy}</span>
                  </div>
                </div>
              ) : <div style={{ fontSize: '11px', color: C.muted2, textAlign: 'center', padding: '14px' }}>—</div>}
            </div>
            </>)}
          </div>
        </div>
        )}
      </div>
    </div>
    {showIndicators && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowIndicators(false)}>
        <div onClick={e => e.stopPropagation()} style={{ background: C.panel, borderRadius: '12px', width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', fontFamily: 'Inter,sans-serif', overflow: 'hidden', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: '16px', fontWeight: '700', color: C.text }}>Indicators</span>
            <button onClick={() => setShowIndicators(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, display: 'flex' }}><X size={18} /></button>
          </div>
          <div style={{ padding: '12px 24px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: C.panel2, borderRadius: '8px', padding: '8px 12px' }}>
              <Search size={14} color={C.muted} />
              <input placeholder="Search indicators..." autoFocus style={{ background: 'none', border: 'none', outline: 'none', fontSize: '13px', color: C.text, width: '100%', fontFamily: 'Inter,sans-serif' }} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {[
              { group: 'Moving Averages', items: ['Simple Moving Average (SMA)', 'Exponential Moving Average (EMA)', 'Weighted Moving Average (WMA)', 'Hull Moving Average (HMA)', 'VWAP'] },
              { group: 'Momentum', items: ['RSI', 'MACD', 'Stochastic Oscillator', 'CCI', 'Williams %R'] },
              { group: 'Volatility', items: ['Bollinger Bands', 'ATR', 'Keltner Channels', 'Donchian Channels'] },
              { group: 'Volume', items: ['Volume', 'OBV', 'MFI', 'VWAP'] },
              { group: 'Trend', items: ['Ichimoku Cloud', 'Parabolic SAR', 'ADX', 'Supertrend'] },
            ].map(({ group, items }) => (
              <div key={group}>
                <div style={{ padding: '8px 24px 4px', fontSize: '10px', fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{group}</div>
                {items.map(item => {
                  const active = activeIndicators.includes(item);
                  return (
                    <button key={item} onClick={() => setActiveIndicators(prev => active ? prev.filter(i => i !== item) : [...prev, item])}
                      style={{ width: '100%', padding: '9px 24px', background: active ? C.accentBg : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'Inter,sans-serif' }}>
                      <span style={{ fontSize: '13px', color: active ? C.accent : C.text, fontWeight: active ? '600' : '400' }}>{item}</span>
                      {active && <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </div>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {activeIndicators.length > 0 && (
            <div style={{ padding: '12px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: C.muted }}>{activeIndicators.length} selected</span>
              <button onClick={() => setActiveIndicators([])} style={{ fontSize: '12px', color: C.red, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Clear all</button>
            </div>
          )}
        </div>
      </div>
    )}
  </>);
}
