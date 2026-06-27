import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, TrendingUp, X, ChevronDown, Search, BarChart2, Plus } from 'lucide-react';

const POLYGON_KEY = 'k7VULVk63WhJApEdYJ3A0omYmbHauwPi';
const TWELVE_KEY  = '05ee6ae8c5ca41c0a9556a99c91debf9';

const C = {
  bg:'#131722',panel:'#1e222d',panel2:'#2a2e39',border:'#2a2e39',border2:'#363a45',
  text:'#d1d4dc',muted:'#787b86',muted2:'#4a4e5a',accent:'#2962ff',
  green:'#26a69a',red:'#ef5350',
  greenBg:'rgba(38,166,154,0.15)',redBg:'rgba(239,83,80,0.15)',accentBg:'rgba(41,98,255,0.15)',
};

const SYMBOL_META = {
  'EUR/USD':{ bg:'#1a6dd4',short:'€', wsUrl:'wss://socket.polygon.io/forex',  channel:'CA.EURUSD',  ev:'CA',  pair:'EURUSD',  polyTicker:'C:EURUSD',  polyType:'forex'  },
  'GBP/USD':{ bg:'#7b4ea0',short:'£', wsUrl:'wss://socket.polygon.io/forex',  channel:'CA.GBPUSD',  ev:'CA',  pair:'GBPUSD',  polyTicker:'C:GBPUSD',  polyType:'forex'  },
  'USD/JPY':{ bg:'#c0392b',short:'¥', wsUrl:'wss://socket.polygon.io/forex',  channel:'CA.USDJPY',  ev:'CA',  pair:'USDJPY',  polyTicker:'C:USDJPY',  polyType:'forex'  },
  'XAU/USD':{ bg:'#d4a017',short:'AU',wsUrl:'wss://socket.polygon.io/forex',  channel:'CA.XAUUSD',  ev:'CA',  pair:'XAUUSD',  polyTicker:'C:XAUUSD',  polyType:'forex'  },
  'BTC/USD':{ bg:'#f7931a',short:'₿', wsUrl:'wss://socket.polygon.io/crypto', channel:'XAS.BTC-USD',ev:'XAS', pair:'BTC-USD', polyTicker:'X:BTCUSD',  polyType:'crypto' },
  'ETH/USD':{ bg:'#627eea',short:'Ξ', wsUrl:'wss://socket.polygon.io/crypto', channel:'XAS.ETH-USD',ev:'XAS', pair:'ETH-USD', polyTicker:'X:ETHUSD',  polyType:'crypto' },
  'AAPL':   { bg:'#555555',short:'',  wsUrl:'wss://socket.polygon.io/stocks', channel:'A.AAPL',     ev:'A',   pair:'AAPL',    polyTicker:null,         polyType:'stocks' },
  'TSLA':   { bg:'#e31937',short:'T', wsUrl:'wss://socket.polygon.io/stocks', channel:'A.TSLA',     ev:'A',   pair:'TSLA',    polyTicker:null,         polyType:'stocks' },
  'NVDA':   { bg:'#76b900',short:'N', wsUrl:'wss://socket.polygon.io/stocks', channel:'A.NVDA',     ev:'A',   pair:'NVDA',    polyTicker:null,         polyType:'stocks' },
  'MSFT':   { bg:'#00a4ef',short:'M', wsUrl:'wss://socket.polygon.io/stocks', channel:'A.MSFT',     ev:'A',   pair:'MSFT',    polyTicker:null,         polyType:'stocks' },
  'SPY':    { bg:'#e31837',short:'S', wsUrl:'wss://socket.polygon.io/stocks', channel:'A.SPY',      ev:'A',   pair:'SPY',     polyTicker:null,         polyType:'stocks' },
  'QQQ':    { bg:'#0068ff',short:'Q', wsUrl:'wss://socket.polygon.io/stocks', channel:'A.QQQ',      ev:'A',   pair:'QQQ',     polyTicker:null,         polyType:'stocks' },
};

// Convert our interval to Polygon multiplier/timespan
function toPolygonInterval(interval) {
  const map = {
    '1min':   { multiplier:1,  timespan:'minute' },
    '5min':   { multiplier:5,  timespan:'minute' },
    '15min':  { multiplier:15, timespan:'minute' },
    '1h':     { multiplier:1,  timespan:'hour'   },
    '4h':     { multiplier:4,  timespan:'hour'   },
    '1day':   { multiplier:1,  timespan:'day'    },
    '1week':  { multiplier:1,  timespan:'week'   },
    '1month': { multiplier:1,  timespan:'month'  },
    '3month': { multiplier:3,  timespan:'month'  },
    '6month': { multiplier:6,  timespan:'month'  },
    '1year':  { multiplier:1,  timespan:'year'   },
  };
  return map[interval] || { multiplier:5, timespan:'minute' };
}

// How many days back to fetch based on interval
function daysBack(interval) {
  const map = {
    '1min':'2', '5min':'7', '15min':'14', '1h':'60',
    '4h':'120', '1day':'365', '1week':'730',
    '1month':'1825', '3month':'1825', '6month':'3650', '1year':'3650',
  };
  return map[interval] || '7';
}

function SymbolLogo({ symbol, size = 20 }) {
  const meta = SYMBOL_META[symbol] || { bg:'#787b86', short: symbol?.[0]||'?' };
  return (
    <div style={{ width:size,height:size,borderRadius:'50%',background:meta.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:size*0.42,fontWeight:'700',color:'white',fontFamily:'Inter,sans-serif',letterSpacing:'-0.5px' }}>
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
  { icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l15 9-7 2-3 7z"/></svg>, title:'Cursor', group:1 },
  { icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="2"/><line x1="12" y1="2" x2="12" y2="7"/><line x1="12" y1="17" x2="12" y2="22"/><line x1="2" y1="12" x2="7" y2="12"/><line x1="17" y1="12" x2="22" y2="12"/></svg>, title:'Crosshair', group:1 },
  { icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="4" y1="20" x2="20" y2="4"/><circle cx="4" cy="20" r="2" fill="currentColor" stroke="none"/><circle cx="20" cy="4" r="2" fill="currentColor" stroke="none"/></svg>, title:'Trend Line', group:2 },
  { icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="2" y1="12" x2="22" y2="12"/><polyline points="18,8 22,12 18,16"/></svg>, title:'Horizontal Ray', group:2 },
  { icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="2" y1="12" x2="22" y2="12" strokeDasharray="3 2"/></svg>, title:'Horizontal Line', group:2 },
  { icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="2" x2="12" y2="22" strokeDasharray="3 2"/></svg>, title:'Vertical Line', group:2 },
  { icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="18" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="0" opacity="0.5" strokeDasharray="3 2"/></svg>, title:'Parallel Channel', group:2 },
  { icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="5" x2="21" y2="5"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="3" y1="20" x2="21" y2="20"/><line x1="3" y1="3" x2="3" y2="22" strokeWidth="1.2"/></svg>, title:'Fib Retracement', group:3 },
  { icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="1"/></svg>, title:'Rectangle', group:4 },
  { icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><ellipse cx="12" cy="12" rx="9" ry="6"/></svg>, title:'Ellipse', group:4 },
  { icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12,3 22,21 2,21"/></svg>, title:'Triangle', group:4 },
  { icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="12" y1="7" x2="12" y2="20"/></svg>, title:'Text', group:5 },
  { icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2.5"/></svg>, title:'Note', group:5 },
  { icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="8" x2="2" y2="16"/><line x1="22" y1="8" x2="22" y2="16"/><line x1="12" y1="9" x2="12" y2="15"/></svg>, title:'Measure', group:6 },
  { icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10" cy="10" r="6"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="7" y1="10" x2="13" y2="10"/><line x1="10" y1="7" x2="10" y2="13"/></svg>, title:'Zoom', group:6 },
  { icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 3h4v9a2 2 0 004 0V3h4v9a6 6 0 01-12 0z"/><line x1="6" y1="21" x2="10" y2="21"/><line x1="14" y1="21" x2="18" y2="21"/></svg>, title:'Magnet', group:7 },
  { icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>, title:'Remove All', group:8 },
];

function fmt(n,d=5){return n!=null?Number(n).toFixed(d):'—';}
function fmtP(n){return n>=0?`+$${n.toFixed(2)}`:`-$${Math.abs(n).toFixed(2)}`;}

function useIsMobile(){
  const[v,set]=useState(window.innerWidth<768);
  useEffect(()=>{const h=()=>set(window.innerWidth<768);window.addEventListener('resize',h);return()=>window.removeEventListener('resize',h);},[]);
  return v;
}

function usePolygonPrices(symbols){
  const[prices,setPrices]=useState({});
  const wsRefs=useRef({});

  useEffect(()=>{
    if(!symbols.length) return;

    // Initial price fetch from Twelve Data (last known prices for all symbols)
    (async()=>{
      try{
        const batch1=symbols.slice(0,8);
        const res1=await fetch(`https://api.twelvedata.com/price?symbol=${batch1.join(',')}&apikey=${TWELVE_KEY}`);
        const data1=await res1.json();
        if(batch1.length===1&&data1.price) setPrices(p=>({...p,[batch1[0]]:parseFloat(data1.price)}));
        else batch1.forEach(s=>{if(data1[s]?.price) setPrices(p=>({...p,[s]:parseFloat(data1[s].price)}));});
        // Batch 2 after 5s
        const batch2=symbols.slice(8);
        if(batch2.length) setTimeout(async()=>{
          try{
            const res2=await fetch(`https://api.twelvedata.com/price?symbol=${batch2.join(',')}&apikey=${TWELVE_KEY}`);
            const data2=await res2.json();
            if(batch2.length===1&&data2.price) setPrices(p=>({...p,[batch2[0]]:parseFloat(data2.price)}));
            else batch2.forEach(s=>{if(data2[s]?.price) setPrices(p=>({...p,[s]:parseFloat(data2[s].price)}));});
          }catch{}
        },1500);
      }catch{}
    })();

    const groups={};
    symbols.forEach(sym=>{
      const meta=SYMBOL_META[sym];
      if(!meta) return;
      if(!groups[meta.wsUrl]) groups[meta.wsUrl]=[];
      groups[meta.wsUrl].push(sym);
    });

    Object.entries(groups).forEach(([url,syms])=>{
      if(wsRefs.current[url]) wsRefs.current[url].close();
      const ws=new WebSocket(url);
      wsRefs.current[url]=ws;
      ws.onopen=()=>ws.send(JSON.stringify({action:'auth',params:POLYGON_KEY}));
      ws.onmessage=(evt)=>{
        try{
          const msgs=JSON.parse(evt.data);
          msgs.forEach(msg=>{
            if(msg.ev==='status'&&msg.status==='auth_success'){
              const channels=syms.map(s=>SYMBOL_META[s]?.channel).filter(Boolean);
              ws.send(JSON.stringify({action:'subscribe',params:channels.join(',')}));
            }
            if(msg.ev==='CA'){
              const sym=Object.keys(SYMBOL_META).find(s=>SYMBOL_META[s].pair===msg.pair);
              if(sym) setPrices(p=>({...p,[sym]:msg.c||msg.a}));
            }
            if(msg.ev==='XAS'){
              const sym=Object.keys(SYMBOL_META).find(s=>SYMBOL_META[s].pair===msg.pair);
              if(sym) setPrices(p=>({...p,[sym]:msg.c||msg.ep||msg.a}));
            }
            if(msg.ev==='A'){
              const sym=Object.keys(SYMBOL_META).find(s=>SYMBOL_META[s].pair===msg.sym);
              if(sym) setPrices(p=>({...p,[sym]:msg.c||msg.a}));
            }
          });
        }catch{}
      };
      ws.onerror=(e)=>console.warn('WS error:',url,e);
      ws.onclose=()=>{
        if(wsRefs.current[url+'_stopped']) return;
        const attempt=(wsRefs.current[url+'_attempt']||0)+1;
        wsRefs.current[url+'_attempt']=attempt;
        const delay=Math.min(1000*Math.pow(2,attempt-1),30000);
        console.log(`WS reconnecting ${url} in ${delay}ms (attempt ${attempt})`);
        wsRefs.current[url+'_timer']=setTimeout(()=>{
          if(wsRefs.current[url+'_stopped']) return;
          const ws2=new WebSocket(url);
          wsRefs.current[url]=ws2;
          ws2.onopen=()=>ws2.send(JSON.stringify({action:'auth',params:POLYGON_KEY}));
          ws2.onmessage=ws.onmessage;
          ws2.onerror=ws.onerror;
          ws2.onclose=ws.onclose;
        },delay);
      };
    });

    return()=>{
      Object.keys(wsRefs.current).forEach(k=>{
        if(k.endsWith('_timer')) clearTimeout(wsRefs.current[k]);
        if(k.endsWith('_stopped')||k.endsWith('_timer')||k.endsWith('_attempt')) return;
        wsRefs.current[k+'_stopped']=true;
        const ws=wsRefs.current[k];
        if(ws&&ws.close){ws.onclose=null;ws.close();}
      });
      wsRefs.current={};
    };
  },[symbols.join(',')]);

  return prices;
}

export default function Platform() {
  const{trader,signOut,fetchTrader}=useAuth();
  const isMobile=useIsMobile();
  const chartContainerRef=useRef();
  const chartRef=useRef();
  const seriesRef=useRef();
  const volumeSeriesRef=useRef();

  const[selectedSymbol,setSelectedSymbol]=useState(DEFAULT_SYMBOLS[0]);
  const[activeInterval,setActiveInterval]=useState('5min');
  const[showIntervals,setShowIntervals]=useState(false);
  const[priceChange,setPriceChange]=useState(0);
  const[positions,setPositions]=useState([]);
  const[history,setHistory]=useState([]);
  const[orderType,setOrderType]=useState('buy');
  const[lotSize,setLotSize]=useState('0.01');
  const[sl,setSl]=useState('');
  const[tp,setTp]=useState('');
  const[placing,setPlacing]=useState(false);
  const[tab,setTab]=useState('positions');
  const[symbolSearch,setSymbolSearch]=useState('');
  const[showSymbols,setShowSymbols]=useState(false);
  const[searchResults,setSearchResults]=useState([]);
  const[searchLoading,setSearchLoading]=useState(false);
  const symbolDropdownRef=useRef(null);
  const intervalDropdownRef=useRef(null);
  const[activeTool,setActiveTool]=useState('Crosshair');
  const[mobileView,setMobileView]=useState('chart');
  const[showOrderDrawer,setShowOrderDrawer]=useState(false);
  const[openPrices,setOpenPrices]=useState({});
  const[candlePrice,setCandlePrice]=useState(null);
  const[drawingsBySymbol,setDrawingsBySymbol]=useState({});
  const drawings=drawingsBySymbol[selectedSymbol.symbol]||[];
  const setDrawings=(updater)=>{
    setDrawingsBySymbol(prev=>{
      const sym=selectedSymbol.symbol;
      const current=prev[sym]||[];
      const next=typeof updater==='function'?updater(current):updater;
      return{...prev,[sym]:next};
    });
  };
  const[undoStack,setUndoStack]=useState([]); // history of drawings arrays
  const[selectedDrawing,setSelectedDrawing]=useState(null); // index of selected drawing
  const[activeDrawing,setActiveDrawing]=useState(null); // {type, points:[]}
  const canvasRef=useRef(null);
  const isDrawing=useRef(false);
  const searchTimer=useRef(null);

  const allSymbols=DEFAULT_SYMBOLS.map(s=>s.symbol);
  const livePrices=usePolygonPrices(allSymbols);
  const price=livePrices[selectedSymbol.symbol]||candlePrice||null;

  useEffect(()=>{
    if(!chartContainerRef.current) return;
    const chart=createChart(chartContainerRef.current,{
      layout:{background:{color:C.bg},textColor:C.muted},
      grid:{vertLines:{color:'#1e222d'},horzLines:{color:'#1e222d'}},
      crosshair:{mode:1},rightPriceScale:{borderColor:C.border2},
      timeScale:{borderColor:C.border2,timeVisible:true},
      width:chartContainerRef.current.clientWidth,height:chartContainerRef.current.clientHeight,
    });
    const series=chart.addCandlestickSeries({upColor:C.green,downColor:C.red,borderUpColor:C.green,borderDownColor:C.red,wickUpColor:C.green,wickDownColor:C.red});
    const volSeries=chart.addHistogramSeries({color:'rgba(38,166,154,0.3)',priceFormat:{type:'volume'},priceScaleId:'volume',scaleMargins:{top:0.85,bottom:0}});
    chartRef.current=chart;seriesRef.current=series;volumeSeriesRef.current=volSeries;
    const ro=new ResizeObserver(()=>{if(chartContainerRef.current) chart.applyOptions({width:chartContainerRef.current.clientWidth,height:chartContainerRef.current.clientHeight});});
    ro.observe(chartContainerRef.current);
    return()=>{chart.remove();ro.disconnect();};
  },[]);

  // ── Click-outside to close dropdowns ──
  useEffect(()=>{
    const handler=(e)=>{
      if(symbolDropdownRef.current&&!symbolDropdownRef.current.contains(e.target)) setShowSymbols(false);
      if(intervalDropdownRef.current&&!intervalDropdownRef.current.contains(e.target)) setShowIntervals(false);
    };
    // Use capture phase so clicks on canvas (pointerEvents:none) still trigger
    document.addEventListener('mousedown',handler,true);
    return()=>document.removeEventListener('mousedown',handler,true);
  },[]);

  // ── Fetch daily open prices for watchlist % change ──
  useEffect(()=>{
    const fetchDailyOpens=async()=>{
      const forexCrypto=DEFAULT_SYMBOLS.filter(s=>SYMBOL_META[s.symbol]?.polyTicker);
      const today=new Date().toISOString().slice(0,10);
      const yesterday=new Date(Date.now()-2*24*60*60*1000).toISOString().slice(0,10);
      const results={};
      await Promise.all(forexCrypto.map(async(sym)=>{
        try{
          const meta=SYMBOL_META[sym.symbol];
          const url=`https://api.polygon.io/v2/aggs/ticker/${meta.polyTicker}/range/1/day/${yesterday}/${today}?adjusted=true&sort=desc&limit=2&apiKey=${POLYGON_KEY}`;
          const res=await fetch(url);
          const data=await res.json();
          if(data.results?.length) results[sym.symbol]=data.results[0].o;
        }catch{}
      }));
      setOpenPrices(results);
    };
    fetchDailyOpens();
  },[]);


  // ── Canvas drawing helpers ──
  const getCanvasPoint=(e)=>{
    const canvas=canvasRef.current;
    if(!canvas) return null;
    const rect=canvas.getBoundingClientRect();
    return{x:e.clientX-rect.left, y:e.clientY-rect.top};
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

      if(d.type==='Trend Line'||d.type==='Horizontal Ray'||d.type==='Horizontal Line'||d.type==='Vertical Line'||d.type==='Parallel Channel'){
        if(d.points.length>=2){
          const[p1,p2]=d.points;
          if(d.type==='Horizontal Line'){
            ctx.beginPath();ctx.moveTo(0,p1.y);ctx.lineTo(canvas.width,p1.y);ctx.stroke();
          } else if(d.type==='Vertical Line'){
            ctx.beginPath();ctx.moveTo(p1.x,0);ctx.lineTo(p1.x,canvas.height);ctx.stroke();
          } else if(d.type==='Horizontal Ray'){
            ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(canvas.width,p1.y);ctx.stroke();
          } else {
            ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();
          }
          // Draw endpoint dots
          ctx.fillStyle=d.color||'#2962ff';
          [p1,p2].forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();});
        }
      }

      if(d.type==='Rectangle'){
        if(d.points.length>=2){
          const[p1,p2]=d.points;
          ctx.beginPath();
          ctx.rect(p1.x,p1.y,p2.x-p1.x,p2.y-p1.y);
          ctx.stroke();
          ctx.fillStyle='rgba(41,98,255,0.05)';
          ctx.fill();
        }
      }

      if(d.type==='Ellipse'){
        if(d.points.length>=2){
          const[p1,p2]=d.points;
          const cx=(p1.x+p2.x)/2, cy=(p1.y+p2.y)/2;
          const rx=Math.abs(p2.x-p1.x)/2, ry=Math.abs(p2.y-p1.y)/2;
          ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.stroke();
        }
      }

      if(d.type==='Triangle'){
        if(d.points.length>=3){
          const[p1,p2,p3]=d.points;
          ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.lineTo(p3.x,p3.y);ctx.closePath();ctx.stroke();
        } else if(d.points.length===2){
          const[p1,p2]=d.points;
          ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();
        }
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

      if(d.type==='Measure'){
        if(d.points.length>=2){
          const[p1,p2]=d.points;
          ctx.strokeStyle='#ff9800';ctx.lineWidth=1;ctx.setLineDash([]);
          ctx.beginPath();ctx.rect(p1.x,p1.y,p2.x-p1.x,p2.y-p1.y);ctx.stroke();
          ctx.fillStyle='rgba(255,152,0,0.1)';ctx.fill();
          const w=Math.abs(p2.x-p1.x).toFixed(0),h=Math.abs(p2.y-p1.y).toFixed(0);
          ctx.fillStyle='#ff9800';ctx.font='11px Inter,sans-serif';
          ctx.fillText(`${w}×${h}px`,(p1.x+p2.x)/2-20,(p1.y+p2.y)/2);
        }
      }
    });
  },[drawings,activeDrawing,selectedDrawing]);

  useEffect(()=>{redrawCanvas();},[redrawCanvas]);

  // ── Undo with Ctrl+Z, Delete selected with Delete/Backspace ──
  useEffect(()=>{
    const handleKeyDown=(e)=>{
      if((e.metaKey||e.ctrlKey)&&e.key==='z'){
        e.preventDefault();
        setDrawings(prev=>{
          if(prev.length===0) return prev;
          const next=prev.slice(0,-1);
          return next;
        });
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

  // ── Hit detection: find if a point is near a drawing ──
  const hitTest=(pt,drawing)=>{
    if(!drawing.points||drawing.points.length<2) return false;
    const[p1,p2]=drawing.points;
    const THRESHOLD=15;
    if(drawing.type==='Horizontal Line'||drawing.type==='Horizontal Ray'){
      return Math.abs(pt.y-p1.y)<THRESHOLD;
    }
    if(drawing.type==='Vertical Line'){
      return Math.abs(pt.x-p1.x)<THRESHOLD;
    }
    // Distance from point to line segment
    const dx=p2.x-p1.x, dy=p2.y-p1.y;
    const len=Math.sqrt(dx*dx+dy*dy);
    if(len===0) return false;
    const t=Math.max(0,Math.min(1,((pt.x-p1.x)*dx+(pt.y-p1.y)*dy)/(len*len)));
    const projX=p1.x+t*dx, projY=p1.y+t*dy;
    const dist=Math.sqrt((pt.x-projX)**2+(pt.y-projY)**2);
    return dist<THRESHOLD;
  };

  // Resize canvas when container resizes
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
    if(activeTool==='Crosshair'||activeTool==='Zoom'||activeTool==='Magnet') return;
    if(activeTool==='Cursor'){
      // Hit test to select a drawing
      const pt=getCanvasPoint(e);
      if(!pt) return;
      let found=null;
      for(let i=drawings.length-1;i>=0;i--){
        if(hitTest(pt,drawings[i])){found=i;break;}
      }
      setSelectedDrawing(found);
      return;
    }
    const pt=getCanvasPoint(e);
    if(!pt) return;
    isDrawing.current=true;
    if(activeTool==='Triangle'&&activeDrawing?.type==='Triangle'&&activeDrawing.points.length===2){
      // Third point for triangle
      setDrawings(prev=>[...prev,{...activeDrawing,points:[...activeDrawing.points,pt]}]);
      setActiveDrawing(null);
      isDrawing.current=false;
    } else {
      setActiveDrawing({type:activeTool,points:[pt,pt],color:'#2962ff',lineWidth:1.5});
    }
  };

  const handleCanvasMouseMove=(e)=>{
    if(!isDrawing.current||!activeDrawing) return;
    const pt=getCanvasPoint(e);
    if(!pt) return;
    setActiveDrawing(prev=>({...prev,points:[prev.points[0],pt]}));
  };

  const handleCanvasMouseUp=(e)=>{
    if(!isDrawing.current||!activeDrawing) return;
    const pt=getCanvasPoint(e);
    if(!pt) return;
    if(activeTool==='Triangle'){
      // Keep active for 3rd point
      setActiveDrawing(prev=>({...prev,points:[prev.points[0],pt]}));
      isDrawing.current=false;
    } else {
      setDrawings(prev=>[...prev,{...activeDrawing,points:[activeDrawing.points[0],pt]}]);
      setSelectedDrawing(null);
      setActiveDrawing(null);
      isDrawing.current=false;
    }
  };

  const canvasCursor=()=>{
    if(activeTool==='Cursor') return 'default';
    if(activeTool==='Crosshair') return 'crosshair';
    if(activeTool==='Zoom') return 'zoom-in';
    if(activeTool==='Remove All') return 'default';
    return 'crosshair';
  };

  const fetchCandles=useCallback(async()=>{
    const meta=SYMBOL_META[selectedSymbol.symbol];
    try{
      if(meta?.polyTicker){
        // ── POLYGON (Forex + Crypto) ──
        const{multiplier,timespan}=toPolygonInterval(activeInterval);
        const to=new Date().toISOString().slice(0,10);
        const from=new Date(Date.now()-parseInt(daysBack(activeInterval))*24*60*60*1000).toISOString().slice(0,10);
        const url=`https://api.polygon.io/v2/aggs/ticker/${meta.polyTicker}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=500&apiKey=${POLYGON_KEY}`;
        const res=await fetch(url);
        const data=await res.json();
        if(!data.results?.length) return;
        const candles=data.results.map(v=>({
          time:Math.floor(v.t/1000),
          open:v.o,high:v.h,low:v.l,close:v.c,
        }));
        const volumes=data.results.map(v=>({
          time:Math.floor(v.t/1000),
          value:v.v||0,
          color:v.c>=v.o?'rgba(38,166,154,0.4)':'rgba(239,83,80,0.4)',
        }));
        seriesRef.current?.setData(candles);
        volumeSeriesRef.current?.setData(volumes);
        const last=candles[candles.length-1];
        const prev=candles[candles.length-2];
        setCandlePrice(last.close);
        if(prev) setPriceChange(((last.close-prev.close)/prev.close)*100);
      } else {
        // ── TWELVE DATA (Stocks) ──
        const res=await fetch(`https://api.twelvedata.com/time_series?symbol=${selectedSymbol.symbol}&interval=${activeInterval}&outputsize=200&apikey=${TWELVE_KEY}`);
        const data=await res.json();
        if(!data.values?.length) return;
        const sorted=[...data.values].reverse();
        const candles=sorted.map(v=>({time:Math.floor(new Date(v.datetime).getTime()/1000),open:parseFloat(v.open),high:parseFloat(v.high),low:parseFloat(v.low),close:parseFloat(v.close)}));
        const volumes=sorted.map(v=>({time:Math.floor(new Date(v.datetime).getTime()/1000),value:parseFloat(v.volume)||0,color:parseFloat(v.close)>=parseFloat(v.open)?'rgba(38,166,154,0.4)':'rgba(239,83,80,0.4)'}));
        seriesRef.current?.setData(candles);
        volumeSeriesRef.current?.setData(volumes);
        const last=candles[candles.length-1];
        const prev=candles[candles.length-2];
        setCandlePrice(last.close);
        if(prev) setPriceChange(((last.close-prev.close)/prev.close)*100);
      }
    }catch(e){console.error(e);}
  },[selectedSymbol,activeInterval]);
  useEffect(()=>{fetchCandles();},[fetchCandles]);

  const selectedLivePrice=livePrices[selectedSymbol.symbol];
  useEffect(()=>{
    if(selectedLivePrice&&candlePrice) setPriceChange(((selectedLivePrice-candlePrice)/candlePrice)*100);
  },[selectedLivePrice,candlePrice]);

  async function fetchPositions(){
    if(!trader) return;
    const{data:open}=await supabase.from('trades').select('*').eq('trader_id',trader.id).eq('status','open').order('opened_at',{ascending:false});
    const{data:closed}=await supabase.from('trades').select('*').eq('trader_id',trader.id).eq('status','closed').order('closed_at',{ascending:false}).limit(20);
    setPositions(open||[]);setHistory(closed||[]);
  }
  useEffect(()=>{fetchPositions();},[trader]);

  // ── P&L calculation per asset type ──
  function calcProfit(trade, currentPrice) {
    const pip = trade.type==='buy' ? currentPrice - trade.open_price : trade.open_price - currentPrice;
    const meta = SYMBOL_META[trade.symbol];
    const type = meta?.polyType || 'forex';
    if (type==='crypto') {
      // Crypto: profit = pip * lot_size (1 lot = 1 coin)
      return pip * trade.lot_size;
    } else if (type==='stocks') {
      // Stocks: profit = pip * lot_size * 100 (1 lot = 100 shares)
      return pip * trade.lot_size * 100;
    } else {
      // Forex/Gold: standard pip value
      const isJPY = trade.symbol.includes('JPY');
      const isGold = trade.symbol.includes('XAU');
      const contractSize = isGold ? 100 : 100000;
      const pipSize = isJPY ? 0.01 : isGold ? 0.1 : 0.0001;
      return (pip / pipSize) * pipSize * contractSize * trade.lot_size;
    }
  }

  const livePositions=positions.map(p=>{
    const cur=livePrices[p.symbol]||p.open_price;
    const pip=p.type==='buy'?cur-p.open_price:p.open_price-cur;
    return{...p,live_profit:calcProfit(p, cur),current_price:cur};
  });
  const totalPnL=livePositions.reduce((s,p)=>s+(p.live_profit||0),0);

  async function placeOrder(){
    if(!trader||!price) return;
    const lots=parseFloat(lotSize)||0.01;
    if(lots<=0){alert('Lot size must be greater than 0');return;}
    setPlacing(true);
    await supabase.from('trades').insert({trader_id:trader.id,symbol:selectedSymbol.symbol,type:orderType,lot_size:lots,open_price:price,stop_loss:sl?parseFloat(sl):null,take_profit:tp?parseFloat(tp):null,status:'open'});
    setSl('');setTp('');setPlacing(false);fetchPositions();
    if(isMobile) setShowOrderDrawer(false);
  }

  async function closePosition(trade){
    const closePrice=livePrices[trade.symbol]||trade.open_price;
    const pip=trade.type==='buy'?closePrice-trade.open_price:trade.open_price-closePrice;
    const profit=calcProfit(trade, closePrice);
    await supabase.from('trades').update({status:'closed',close_price:closePrice,profit,closed_at:new Date().toISOString()}).eq('id',trade.id);
    await supabase.from('trader_accounts').update({balance:trader.balance+profit,equity:trader.equity+profit}).eq('id',trader.id);
    fetchPositions();if(fetchTrader) fetchTrader(trader.email);
  }

  const handleSymbolSearch=(value)=>{
    setSymbolSearch(value);setSearchResults([]);
    if(searchTimer.current) clearTimeout(searchTimer.current);
    if(!value.trim()) return;
    setSearchLoading(true);
    searchTimer.current=setTimeout(async()=>{
      try{
        const res=await fetch(`https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(value)}&outputsize=10&apikey=${TWELVE_KEY}`);
        const data=await res.json();
        if(data.data) setSearchResults(data.data.map(r=>({symbol:r.symbol,label:r.instrument_name||r.symbol,type:r.instrument_type==='Digital Currency'?'Crypto':r.instrument_type==='Physical Currency'?'Forex':'Stocks'})));
      }catch{}setSearchLoading(false);
    },400);
  };

  const decimals=selectedSymbol.type==='Stocks'?2:selectedSymbol.symbol.includes('JPY')?3:5;
  const spread=(()=>{
    const sym=selectedSymbol.symbol;
    if(sym.includes('JPY')) return 0.02;
    if(sym.includes('XAU')) return 0.30;
    if(sym==='BTC/USD') return 5.0;
    if(sym==='ETH/USD') return 1.0;
    if(selectedSymbol.type==='Stocks'||selectedSymbol.type==='Indices') return 0.02;
    return 0.00002; // standard forex
  })();
  const bid=price?price-spread/2:null;
  const ask=price?price+spread/2:null;
  const activeLabel=INTERVALS.find(i=>i.value===activeInterval)?.label||'5m';

  const orderPanelContent=(
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',borderBottom:`1px solid ${C.border}`}}>
        <button onClick={()=>setOrderType('buy')} style={{padding:'12px 8px',background:orderType==='buy'?C.greenBg:'transparent',border:'none',borderBottom:orderType==='buy'?`2px solid ${C.green}`:'2px solid transparent',color:orderType==='buy'?C.green:C.muted,fontWeight:'700',cursor:'pointer',fontFamily:'Inter,sans-serif',display:'flex',flexDirection:'column',alignItems:'center',gap:'2px'}}>
          <span style={{fontSize:'9px',opacity:0.7,textTransform:'uppercase',letterSpacing:'0.5px'}}>Bid</span>
          <span style={{fontSize:'13px',fontFamily:'monospace',fontWeight:'700'}}>{bid?fmt(bid,decimals):'—'}</span>
          <span style={{fontSize:'12px',fontWeight:'800',letterSpacing:'0.5px'}}>BUY</span>
        </button>
        <button onClick={()=>setOrderType('sell')} style={{padding:'12px 8px',background:orderType==='sell'?C.redBg:'transparent',border:'none',borderBottom:orderType==='sell'?`2px solid ${C.red}`:'2px solid transparent',color:orderType==='sell'?C.red:C.muted,fontWeight:'700',cursor:'pointer',fontFamily:'Inter,sans-serif',display:'flex',flexDirection:'column',alignItems:'center',gap:'2px'}}>
          <span style={{fontSize:'9px',opacity:0.7,textTransform:'uppercase',letterSpacing:'0.5px'}}>Ask</span>
          <span style={{fontSize:'13px',fontFamily:'monospace',fontWeight:'700'}}>{ask?fmt(ask,decimals):'—'}</span>
          <span style={{fontSize:'12px',fontWeight:'800',letterSpacing:'0.5px'}}>SELL</span>
        </button>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'12px',display:'flex',flexDirection:'column',gap:'10px'}}>
        <div style={{display:'flex',gap:'4px'}}>
          {['Market','Limit','Stop'].map(t=>(
            <button key={t} style={{flex:1,padding:'5px',background:t==='Market'?C.accentBg:'transparent',border:`1px solid ${t==='Market'?C.accent:C.border2}`,borderRadius:'4px',color:t==='Market'?C.accent:C.muted,fontSize:'10px',fontWeight:'600',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{t}</button>
          ))}
        </div>
        <div>
          <label style={{display:'block',fontSize:'10px',fontWeight:'600',color:C.muted,marginBottom:'4px',textTransform:'uppercase',letterSpacing:'0.5px'}}>Quantity (Lots)</label>
          <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
            <button onClick={()=>setLotSize(v=>Math.max(0.01,parseFloat(v)-0.01).toFixed(2))} style={{width:'28px',height:'28px',background:C.panel2,border:`1px solid ${C.border2}`,borderRadius:'4px',color:C.text,fontSize:'16px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>−</button>
            <input type="number" value={lotSize} onChange={e=>{const v=parseFloat(e.target.value);if(!isNaN(v)&&v>0) setLotSize(e.target.value);else if(e.target.value==='') setLotSize('0.01');}} step="0.01" min="0.01" style={{flex:1,padding:'6px 8px',background:C.bg,border:`1px solid ${C.border2}`,borderRadius:'4px',color:C.text,fontSize:'13px',fontWeight:'700',textAlign:'center',outline:'none',fontFamily:'monospace'}}/>
            <button onClick={()=>setLotSize(v=>(parseFloat(v)+0.01).toFixed(2))} style={{width:'28px',height:'28px',background:C.panel2,border:`1px solid ${C.border2}`,borderRadius:'4px',color:C.text,fontSize:'16px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>+</button>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
          <div>
            <label style={{display:'block',fontSize:'10px',fontWeight:'600',color:C.red,marginBottom:'4px',textTransform:'uppercase',letterSpacing:'0.5px'}}>Stop Loss</label>
            <input type="number" value={sl} onChange={e=>setSl(e.target.value)} placeholder="—" style={{width:'100%',boxSizing:'border-box',padding:'6px',background:C.bg,border:'1px solid rgba(239,83,80,0.3)',borderRadius:'4px',color:C.text,fontSize:'11px',outline:'none',fontFamily:'monospace'}}/>
          </div>
          <div>
            <label style={{display:'block',fontSize:'10px',fontWeight:'600',color:C.green,marginBottom:'4px',textTransform:'uppercase',letterSpacing:'0.5px'}}>Take Profit</label>
            <input type="number" value={tp} onChange={e=>setTp(e.target.value)} placeholder="—" style={{width:'100%',boxSizing:'border-box',padding:'6px',background:C.bg,border:'1px solid rgba(38,166,154,0.3)',borderRadius:'4px',color:C.text,fontSize:'11px',outline:'none',fontFamily:'monospace'}}/>
          </div>
        </div>
        <div style={{background:C.bg,borderRadius:'6px',padding:'8px 10px',display:'flex',flexDirection:'column',gap:'4px',border:`1px solid ${C.border}`}}>
          {[['Margin',`$${price?((price*parseFloat(lotSize||0)*100000)/(trader?.leverage||100)).toFixed(2):'—'}`],['Leverage',`1:${trader?.leverage||100}`],['Pip Value',`$${(parseFloat(lotSize||0)*10).toFixed(2)}`]].map(([l,v])=>(
            <div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:'10px'}}>
              <span style={{color:C.muted}}>{l}</span>
              <span style={{color:C.text,fontFamily:'monospace'}}>{v}</span>
            </div>
          ))}
        </div>
        <button onClick={placeOrder} disabled={placing||!price} style={{padding:'11px',border:'none',borderRadius:'6px',background:placing||!price?C.border2:orderType==='buy'?C.green:C.red,color:'white',fontSize:'13px',fontWeight:'700',cursor:placing||!price?'not-allowed':'pointer',fontFamily:'Inter,sans-serif',textTransform:'uppercase',letterSpacing:'0.5px'}}>
          {placing?'Placing...':`${orderType==='buy'?'▲ Buy':'▼ Sell'} ${selectedSymbol.symbol}`}
        </button>
      </div>
      <div style={{padding:'10px 12px',borderTop:`1px solid ${C.border}`,display:'flex',flexDirection:'column',gap:'4px'}}>
        {[{l:'Balance',v:`$${(trader?.balance||0).toFixed(2)}`},{l:'Equity',v:`$${((trader?.balance||0)+totalPnL).toFixed(2)}`,c:totalPnL>=0?C.green:C.red},{l:'Free Margin',v:`$${Math.max(0,(trader?.free_margin||0)+totalPnL).toFixed(2)}`},{l:'Open P&L',v:fmtP(totalPnL),c:totalPnL>=0?C.green:C.red}].map(({l,v,c})=>(
          <div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:'10px'}}>
            <span style={{color:C.muted}}>{l}</span>
            <span style={{color:c||C.text,fontWeight:'600',fontFamily:'monospace'}}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const positionsContent=(
    <div style={{overflowY:'auto',flex:1}}>
      {tab==='positions'?(
        livePositions.length===0?<div style={{padding:'20px',textAlign:'center',color:C.muted,fontSize:'12px'}}>No open positions</div>:
        isMobile?(
          <div style={{display:'flex',flexDirection:'column',gap:'6px',padding:'8px'}}>
            {livePositions.map(p=>(
              <div key={p.id} style={{background:C.panel2,borderRadius:'8px',padding:'10px 12px',border:`1px solid ${C.border2}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <SymbolLogo symbol={p.symbol} size={20}/>
                    <span style={{color:C.text,fontWeight:'700'}}>{p.symbol}</span>
                    <span style={{color:p.type==='buy'?C.green:C.red,fontSize:'10px',fontWeight:'700',textTransform:'uppercase',background:p.type==='buy'?C.greenBg:C.redBg,padding:'2px 6px',borderRadius:'3px'}}>{p.type}</span>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <span style={{color:p.live_profit>=0?C.green:C.red,fontWeight:'700',fontSize:'13px'}}>{fmtP(p.live_profit)}</span>
                    <button onClick={()=>closePosition(p)} style={{background:C.redBg,border:'1px solid rgba(239,83,80,0.3)',borderRadius:'4px',padding:'3px 8px',color:C.red,fontSize:'11px',fontWeight:'600',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Close</button>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'6px'}}>
                  {[['Lots',p.lot_size],['Open',fmt(p.open_price,decimals)],['Current',fmt(p.current_price,decimals)]].map(([l,v])=>(
                    <div key={l}><div style={{fontSize:'9px',color:C.muted,marginBottom:'1px'}}>{l}</div><div style={{fontSize:'11px',color:C.text,fontFamily:'monospace'}}>{v}</div></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ):(
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
            <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
              {['Symbol','Type','Lots','Open','Current','P&L','SL','TP',''].map(h=>(
                <th key={h} style={{padding:'5px 10px',textAlign:'left',color:C.muted,fontWeight:'600',fontSize:'10px',textTransform:'uppercase',letterSpacing:'0.5px',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {livePositions.map(p=>(
                <tr key={p.id} style={{borderBottom:`1px solid ${C.border}`}}>
                  <td style={{padding:'7px 10px'}}><div style={{display:'flex',alignItems:'center',gap:'6px'}}><SymbolLogo symbol={p.symbol} size={18}/><span style={{color:C.text,fontWeight:'600'}}>{p.symbol}</span></div></td>
                  <td style={{padding:'7px 10px'}}><span style={{color:p.type==='buy'?C.green:C.red,fontWeight:'700',textTransform:'uppercase',fontSize:'10px',background:p.type==='buy'?C.greenBg:C.redBg,padding:'2px 5px',borderRadius:'3px'}}>{p.type}</span></td>
                  <td style={{padding:'7px 10px',color:C.text}}>{p.lot_size}</td>
                  <td style={{padding:'7px 10px',color:C.muted,fontFamily:'monospace'}}>{fmt(p.open_price,decimals)}</td>
                  <td style={{padding:'7px 10px',color:C.text,fontFamily:'monospace'}}>{fmt(p.current_price,decimals)}</td>
                  <td style={{padding:'7px 10px',fontWeight:'700',color:p.live_profit>=0?C.green:C.red}}>{fmtP(p.live_profit)}</td>
                  <td style={{padding:'7px 10px',color:C.muted,fontFamily:'monospace',fontSize:'10px'}}>{p.stop_loss?fmt(p.stop_loss,decimals):'—'}</td>
                  <td style={{padding:'7px 10px',color:C.muted,fontFamily:'monospace',fontSize:'10px'}}>{p.take_profit?fmt(p.take_profit,decimals):'—'}</td>
                  <td style={{padding:'7px 10px'}}><button onClick={()=>closePosition(p)} style={{background:C.redBg,border:'1px solid rgba(239,83,80,0.3)',borderRadius:'3px',padding:'3px 7px',color:C.red,fontSize:'10px',fontWeight:'600',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Close</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ):(
        history.length===0?<div style={{padding:'20px',textAlign:'center',color:C.muted,fontSize:'12px'}}>No trade history</div>:
        isMobile?(
          <div style={{display:'flex',flexDirection:'column',gap:'6px',padding:'8px'}}>
            {history.map(p=>(
              <div key={p.id} style={{background:C.panel2,borderRadius:'8px',padding:'10px 12px',border:`1px solid ${C.border2}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <SymbolLogo symbol={p.symbol} size={20}/>
                    <span style={{color:C.text,fontWeight:'700'}}>{p.symbol}</span>
                    <span style={{color:p.type==='buy'?C.green:C.red,fontSize:'10px',fontWeight:'700',textTransform:'uppercase',background:p.type==='buy'?C.greenBg:C.redBg,padding:'2px 6px',borderRadius:'3px'}}>{p.type}</span>
                  </div>
                  <span style={{color:p.profit>=0?C.green:C.red,fontWeight:'700'}}>{fmtP(p.profit)}</span>
                </div>
                <div style={{fontSize:'10px',color:C.muted}}>{p.closed_at?new Date(p.closed_at).toLocaleString():'—'}</div>
              </div>
            ))}
          </div>
        ):(
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
            <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
              {['Symbol','Type','Lots','Open','Close','P&L','Closed At'].map(h=>(
                <th key={h} style={{padding:'5px 10px',textAlign:'left',color:C.muted,fontWeight:'600',fontSize:'10px',textTransform:'uppercase',letterSpacing:'0.5px'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {history.map(p=>(
                <tr key={p.id} style={{borderBottom:`1px solid ${C.border}`}}>
                  <td style={{padding:'7px 10px'}}><div style={{display:'flex',alignItems:'center',gap:'6px'}}><SymbolLogo symbol={p.symbol} size={18}/><span style={{color:C.text,fontWeight:'600'}}>{p.symbol}</span></div></td>
                  <td style={{padding:'7px 10px'}}><span style={{color:p.type==='buy'?C.green:C.red,fontWeight:'700',textTransform:'uppercase',fontSize:'10px',background:p.type==='buy'?C.greenBg:C.redBg,padding:'2px 5px',borderRadius:'3px'}}>{p.type}</span></td>
                  <td style={{padding:'7px 10px',color:C.text}}>{p.lot_size}</td>
                  <td style={{padding:'7px 10px',color:C.muted,fontFamily:'monospace'}}>{fmt(p.open_price,decimals)}</td>
                  <td style={{padding:'7px 10px',color:C.muted,fontFamily:'monospace'}}>{fmt(p.close_price,decimals)}</td>
                  <td style={{padding:'7px 10px',fontWeight:'700',color:p.profit>=0?C.green:C.red}}>{fmtP(p.profit)}</td>
                  <td style={{padding:'7px 10px',color:C.muted,fontSize:'10px'}}>{p.closed_at?new Date(p.closed_at).toLocaleString():'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );

  if(isMobile){return(
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',background:C.bg,fontFamily:"'Inter',sans-serif",overflow:'hidden'}}>
      <div style={{height:'52px',background:C.panel,borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',padding:'0 12px',gap:'8px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
          <div style={{width:'22px',height:'22px',background:'linear-gradient(135deg,#2962FF,#00B8D9)',borderRadius:'5px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <svg width="11" height="11" viewBox="0 0 18 18" fill="none"><polyline points="2,12 6,7 10,10 16,4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{color:C.text,fontWeight:'700',fontSize:'13px'}}>TradeScope</span>
        </div>
        <div ref={symbolDropdownRef} style={{position:'relative',flex:1}}>
          <button onClick={()=>setShowSymbols(!showSymbols)} style={{display:'flex',alignItems:'center',gap:'6px',background:C.panel2,border:`1px solid ${C.border2}`,borderRadius:'6px',padding:'5px 10px',color:C.text,cursor:'pointer',fontSize:'13px',fontWeight:'700',width:'100%',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:'7px'}}><SymbolLogo symbol={selectedSymbol.symbol} size={18}/><span>{selectedSymbol.symbol}</span></div>
            <ChevronDown size={12} color={C.muted}/>
          </button>
          {showSymbols&&(
            <div style={{position:'absolute',top:'38px',left:0,right:0,background:C.panel,border:`1px solid ${C.border2}`,borderRadius:'8px',zIndex:200,boxShadow:'0 8px 32px rgba(0,0,0,0.6)'}}>
              <div style={{padding:'8px',borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px',background:C.bg,borderRadius:'6px',padding:'6px 10px'}}>
                  <Search size={12} color={C.muted}/>
                  <input value={symbolSearch} onChange={e=>handleSymbolSearch(e.target.value)} placeholder="Search any symbol..." autoFocus style={{background:'none',border:'none',color:C.text,fontSize:'13px',outline:'none',width:'100%',fontFamily:'Inter,sans-serif'}}/>
                  {symbolSearch&&<button onClick={()=>{setSymbolSearch('');setSearchResults([]);}} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,padding:0,display:'flex'}}><X size={12}/></button>}
                </div>
              </div>
              <div style={{maxHeight:'300px',overflowY:'auto'}}>
                {searchLoading&&<div style={{padding:'16px',textAlign:'center',color:C.muted,fontSize:'12px'}}>Searching...</div>}
                {!symbolSearch&&DEFAULT_SYMBOLS.map(sym=>(
                  <button key={sym.symbol} onClick={()=>{setSelectedSymbol(sym);setShowSymbols(false);setSymbolSearch('');}} style={{width:'100%',display:'flex',alignItems:'center',gap:'10px',padding:'9px 12px',background:selectedSymbol.symbol===sym.symbol?C.accentBg:'transparent',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                    <SymbolLogo symbol={sym.symbol} size={22}/>
                    <span style={{flex:1,textAlign:'left',fontSize:'13px',fontWeight:'600',color:selectedSymbol.symbol===sym.symbol?C.accent:C.text}}>{sym.symbol}</span>
                    <span style={{fontSize:'11px',color:C.muted,fontFamily:'monospace'}}>{livePrices[sym.symbol]?fmt(livePrices[sym.symbol],decimals):sym.change}</span>
                  </button>
                ))}
                {searchResults.map(sym=>(
                  <button key={sym.symbol} onClick={()=>{setSelectedSymbol(sym);setShowSymbols(false);setSymbolSearch('');setSearchResults([]);}} style={{width:'100%',display:'flex',alignItems:'center',gap:'10px',padding:'9px 12px',background:'transparent',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                    <SymbolLogo symbol={sym.symbol} size={22}/>
                    <span style={{flex:1,textAlign:'left',fontSize:'13px',fontWeight:'600',color:C.text}}>{sym.symbol}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{textAlign:'right',flexShrink:0}}>
          <div style={{fontSize:'15px',fontWeight:'700',color:priceChange>=0?C.green:C.red,fontFamily:'monospace',lineHeight:1}}>{price?fmt(price,decimals):'—'}</div>
          <div style={{fontSize:'10px',color:priceChange>=0?C.green:C.red,marginTop:'1px'}}>{priceChange>=0?'▲':'▼'} {Math.abs(priceChange).toFixed(2)}%</div>
        </div>
        <button onClick={signOut} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,padding:'4px',display:'flex',alignItems:'center',flexShrink:0}}><LogOut size={16}/></button>
      </div>
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,display:'flex',padding:'6px 12px',gap:'4px',flexShrink:0,overflowX:'auto'}}>
        {INTERVALS.map(iv=>(<button key={iv.value} onClick={()=>setActiveInterval(iv.value)} style={{padding:'4px 10px',background:activeInterval===iv.value?C.accentBg:'transparent',border:activeInterval===iv.value?'1px solid rgba(41,98,255,0.4)':'1px solid transparent',borderRadius:'4px',color:activeInterval===iv.value?C.accent:C.muted,fontSize:'11px',fontWeight:'600',cursor:'pointer',fontFamily:'Inter,sans-serif',whiteSpace:'nowrap',flexShrink:0}}>{iv.label}</button>))}
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{display:mobileView==='chart'?'flex':'none',flex:1,flexDirection:'column',overflow:'hidden'}}>
          <div ref={chartContainerRef} style={{flex:1}}/>
        </div>
        <div style={{display:mobileView==='positions'?'flex':'none',flex:1,flexDirection:'column',overflow:'hidden'}}>
          <div style={{display:'flex',borderBottom:`1px solid ${C.border}`,background:C.panel,flexShrink:0}}>
            {['positions','history'].map(t=>(<button key={t} onClick={()=>setTab(t)} style={{padding:'10px 16px',background:'none',border:'none',borderBottom:tab===t?`2px solid ${C.accent}`:'2px solid transparent',color:tab===t?C.text:C.muted,fontSize:'11px',fontWeight:'600',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{t==='positions'?`Open (${positions.length})`:`History (${history.length})`}</button>))}
            <div style={{marginLeft:'auto',display:'flex',alignItems:'center',paddingRight:'12px'}}>
              <span style={{fontSize:'10px',color:C.muted}}>P&L: <span style={{color:totalPnL>=0?C.green:C.red,fontWeight:'700'}}>{fmtP(totalPnL)}</span></span>
            </div>
          </div>
          {positionsContent}
        </div>
      </div>
      {showOrderDrawer&&(<>
        <div onClick={()=>setShowOrderDrawer(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:90}}/>
        <div style={{position:'fixed',bottom:'56px',left:0,right:0,background:C.panel,border:`1px solid ${C.border2}`,borderRadius:'16px 16px 0 0',zIndex:100,maxHeight:'85vh',display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:`1px solid ${C.border}`}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}><SymbolLogo symbol={selectedSymbol.symbol} size={22}/><span style={{color:C.text,fontWeight:'700',fontSize:'14px'}}>Place Order · {selectedSymbol.symbol}</span></div>
            <button onClick={()=>setShowOrderDrawer(false)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,display:'flex'}}><X size={18}/></button>
          </div>
          {orderPanelContent}
        </div>
      </>)}
      <div style={{height:'56px',background:C.panel,borderTop:`1px solid ${C.border}`,display:'flex',alignItems:'center',flexShrink:0,zIndex:50}}>
        <button onClick={()=>{setMobileView('chart');setShowOrderDrawer(false);}} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',background:'none',border:'none',cursor:'pointer',padding:'8px'}}>
          <BarChart2 size={18} color={mobileView==='chart'?C.accent:C.muted}/>
          <span style={{fontSize:'9px',color:mobileView==='chart'?C.accent:C.muted,fontWeight:'600',fontFamily:'Inter,sans-serif'}}>Chart</span>
        </button>
        <div style={{flex:1,display:'flex',justifyContent:'center'}}>
          <button onClick={()=>setShowOrderDrawer(!showOrderDrawer)} style={{width:'48px',height:'48px',background:showOrderDrawer?C.panel2:'linear-gradient(135deg,#2962FF,#00B8D9)',border:'none',borderRadius:'50%',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 16px rgba(41,98,255,0.3)',transform:'translateY(-8px)'}}>
            {showOrderDrawer?<X size={20} color="white"/>:<TrendingUp size={20} color="white"/>}
          </button>
        </div>
        <button onClick={()=>{setMobileView('positions');setShowOrderDrawer(false);}} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',background:'none',border:'none',cursor:'pointer',padding:'8px',position:'relative'}}>
          <div style={{position:'relative'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={mobileView==='positions'?C.accent:C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            {positions.length>0&&<div style={{position:'absolute',top:'-4px',right:'-6px',background:C.accent,borderRadius:'10px',width:'14px',height:'14px',display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:'8px',color:'white',fontWeight:'700'}}>{positions.length}</span></div>}
          </div>
          <span style={{fontSize:'9px',color:mobileView==='positions'?C.accent:C.muted,fontWeight:'600',fontFamily:'Inter,sans-serif'}}>Positions</span>
        </button>
      </div>
    </div>
  );}

  return(
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:C.bg,fontFamily:"'Inter',sans-serif",overflow:'hidden',color:C.text}}>
      <div style={{height:'46px',background:C.panel,borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',padding:'0 8px',gap:'4px',flexShrink:0,zIndex:20}}>
        <div style={{display:'flex',alignItems:'center',gap:'7px',paddingRight:'8px',borderRight:`1px solid ${C.border}`,marginRight:'4px'}}>
          <div style={{width:'22px',height:'22px',background:'linear-gradient(135deg,#2962FF,#00B8D9)',borderRadius:'5px',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="11" height="11" viewBox="0 0 18 18" fill="none"><polyline points="2,12 6,7 10,10 16,4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{color:C.text,fontWeight:'700',fontSize:'13px',letterSpacing:'-0.3px'}}>TradeScope</span>
        </div>
        <div ref={symbolDropdownRef} style={{position:'relative'}}>
          <button onClick={()=>setShowSymbols(!showSymbols)} style={{display:'flex',alignItems:'center',gap:'7px',background:showSymbols?C.panel2:'transparent',border:`1px solid ${showSymbols?C.border2:'transparent'}`,borderRadius:'4px',padding:'4px 8px',color:C.text,cursor:'pointer',fontSize:'13px',fontWeight:'700',fontFamily:'Inter,sans-serif'}}>
            <SymbolLogo symbol={selectedSymbol.symbol} size={18}/>
            {selectedSymbol.symbol}
            <ChevronDown size={11} color={C.muted}/>
          </button>
          {showSymbols&&(
            <div style={{position:'absolute',top:'36px',left:0,background:C.panel,border:`1px solid ${C.border2}`,borderRadius:'8px',width:'290px',zIndex:300,boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
              <div style={{padding:'8px',borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px',background:C.bg,borderRadius:'6px',padding:'7px 10px'}}>
                  <Search size={13} color={C.muted}/>
                  <input value={symbolSearch} onChange={e=>handleSymbolSearch(e.target.value)} placeholder="Search any symbol..." autoFocus style={{background:'none',border:'none',color:C.text,fontSize:'13px',outline:'none',width:'100%',fontFamily:'Inter,sans-serif'}}/>
                  {symbolSearch&&<button onClick={()=>{setSymbolSearch('');setSearchResults([]);}} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,padding:0,display:'flex'}}><X size={11}/></button>}
                </div>
              </div>
              <div style={{maxHeight:'320px',overflowY:'auto'}}>
                {searchLoading&&<div style={{padding:'16px',textAlign:'center',color:C.muted,fontSize:'12px'}}>Searching...</div>}
                {!searchLoading&&symbolSearch&&searchResults.length===0&&<div style={{padding:'16px',textAlign:'center',color:C.muted,fontSize:'12px'}}>No results found</div>}
                {!symbolSearch&&(<>
                  <div style={{padding:'6px 12px',fontSize:'10px',fontWeight:'700',color:C.muted,textTransform:'uppercase',letterSpacing:'1px'}}>Popular</div>
                  {DEFAULT_SYMBOLS.map(sym=>(
                    <button key={sym.symbol} onClick={()=>{setSelectedSymbol(sym);setShowSymbols(false);setSymbolSearch('');}} style={{width:'100%',display:'flex',alignItems:'center',gap:'10px',padding:'8px 12px',background:selectedSymbol.symbol===sym.symbol?C.accentBg:'transparent',border:'none',borderBottom:`1px solid ${C.border}`,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                      <SymbolLogo symbol={sym.symbol} size={22}/>
                      <div style={{flex:1,textAlign:'left'}}>
                        <div style={{fontSize:'12px',fontWeight:'700',color:selectedSymbol.symbol===sym.symbol?C.accent:C.text}}>{sym.symbol}</div>
                        <div style={{fontSize:'10px',color:C.muted}}>{sym.label}</div>
                      </div>
                      <span style={{fontSize:'11px',fontWeight:'600',color:C.muted,fontFamily:'monospace'}}>{livePrices[sym.symbol]?fmt(livePrices[sym.symbol],5):sym.change}</span>
                    </button>
                  ))}
                </>)}
                {searchResults.map(sym=>(
                  <button key={sym.symbol} onClick={()=>{setSelectedSymbol(sym);setShowSymbols(false);setSymbolSearch('');setSearchResults([]);}} style={{width:'100%',display:'flex',alignItems:'center',gap:'10px',padding:'8px 12px',background:'transparent',border:'none',borderBottom:`1px solid ${C.border}`,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                    <SymbolLogo symbol={sym.symbol} size={22}/>
                    <div style={{flex:1,textAlign:'left'}}>
                      <div style={{fontSize:'12px',fontWeight:'700',color:C.text}}>{sym.symbol}</div>
                      <div style={{fontSize:'10px',color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'160px'}}>{sym.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div ref={intervalDropdownRef} style={{position:'relative',marginLeft:'4px'}}>
          <button onClick={()=>setShowIntervals(!showIntervals)} style={{display:'flex',alignItems:'center',gap:'5px',padding:'4px 10px',background:showIntervals?C.accentBg:'transparent',border:`1px solid ${showIntervals?C.accent:'transparent'}`,borderRadius:'4px',color:C.accent,fontSize:'13px',fontWeight:'700',cursor:'pointer',fontFamily:'Inter,sans-serif',letterSpacing:'0.2px'}}>
            {activeLabel}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6,9 12,15 18,9"/></svg>
          </button>
          {showIntervals&&(
            <div style={{position:'absolute',top:'32px',left:0,background:C.panel,border:`1px solid ${C.border2}`,borderRadius:'8px',zIndex:300,boxShadow:'0 8px 32px rgba(0,0,0,0.5)',minWidth:'160px',padding:'6px'}}>
              {INTERVAL_GROUPS.map(group=>(
                <div key={group.label}>
                  <div style={{fontSize:'9px',fontWeight:'700',color:C.muted,textTransform:'uppercase',letterSpacing:'1px',padding:'4px 8px 2px'}}>{group.label}</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'3px',padding:'2px 4px 8px'}}>
                    {group.options.map(opt=>{
                      const iv=INTERVALS.find(i=>i.label===opt);
                      if(!iv) return null;
                      return(<button key={iv.value} onClick={()=>{setActiveInterval(iv.value);setShowIntervals(false);}} style={{padding:'4px 10px',background:activeInterval===iv.value?C.accent:'transparent',border:`1px solid ${activeInterval===iv.value?C.accent:C.border2}`,borderRadius:'4px',color:activeInterval===iv.value?'white':C.text,fontSize:'11px',fontWeight:'600',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{iv.label}</button>);
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{width:'1px',height:'20px',background:C.border2,margin:'0 6px'}}/>
        <button style={{display:'flex',alignItems:'center',gap:'5px',padding:'4px 10px',background:'transparent',border:'1px solid transparent',borderRadius:'4px',color:C.muted,fontSize:'12px',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Indicators
        </button>
        <button onClick={()=>{setDrawings(prev=>prev.slice(0,-1));setSelectedDrawing(null);}} disabled={drawings.length===0}
          title="Undo (Ctrl+Z)"
          style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 8px',background:'transparent',border:'1px solid transparent',borderRadius:'4px',color:drawings.length===0?C.muted2:C.muted,fontSize:'11px',cursor:drawings.length===0?'not-allowed':'pointer',fontFamily:'Inter,sans-serif',transition:'color 0.15s'}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7v6h6"/><path d="M3 13C5 8 9 5 14 5c4 0 7 2.5 8 6"/></svg>
          Undo
        </button>
        {selectedDrawing!==null&&(
          <button onClick={()=>{setDrawings(prev=>prev.filter((_,i)=>i!==selectedDrawing));setSelectedDrawing(null);}}
            title="Delete selected"
            style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 8px',background:C.redBg,border:`1px solid rgba(239,83,80,0.3)`,borderRadius:'4px',color:C.red,fontSize:'11px',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
            Delete
          </button>
        )}
        <div style={{marginLeft:'4px',display:'flex',alignItems:'baseline',gap:'6px'}}>
          <span style={{fontSize:'15px',fontWeight:'700',color:priceChange>=0?C.green:C.red,fontFamily:'monospace'}}>{price?fmt(price,decimals):'—'}</span>
          <span style={{fontSize:'11px',color:priceChange>=0?C.green:C.red}}>{priceChange>=0?'▲':'▼'} {Math.abs(priceChange).toFixed(2)}%</span>
        </div>
        <div style={{flex:1}}/>
        <div style={{display:'flex',gap:'20px',alignItems:'center',marginRight:'8px'}}>
          {[['Balance',`$${(trader?.balance||0).toFixed(2)}`],['P&L',fmtP(totalPnL),totalPnL>=0?C.green:C.red],['Equity',`$${((trader?.balance||0)+totalPnL).toFixed(2)}`]].map(([l,v,c])=>(
            <div key={l} style={{textAlign:'right'}}>
              <div style={{fontSize:'9px',color:C.muted,textTransform:'uppercase',letterSpacing:'0.5px'}}>{l}</div>
              <div style={{fontSize:'12px',fontWeight:'700',color:c||C.text,fontFamily:'monospace'}}>{v}</div>
            </div>
          ))}
        </div>
        <button onClick={signOut} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,padding:'4px',display:'flex'}} title="Sign out"><LogOut size={14}/></button>
      </div>
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        <div style={{width:'48px',background:C.panel,borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',alignItems:'center',padding:'8px 0',gap:'1px',flexShrink:0,overflowY:'auto'}}>
          {LEFT_TOOLS.map((tool,i)=>{
            const prev=i>0?LEFT_TOOLS[i-1].group:tool.group;
            return(<div key={tool.title} style={{width:'100%',display:'flex',flexDirection:'column',alignItems:'center'}}>
              {i>0&&tool.group!==prev&&<div style={{width:'28px',height:'1px',background:C.border2,margin:'4px 0'}}/>}
              <button onClick={()=>setActiveTool(tool.title)} title={tool.title} style={{width:'36px',height:'36px',background:activeTool===tool.title?C.accentBg:'transparent',border:'none',borderRadius:'6px',color:activeTool===tool.title?C.accent:C.muted,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s'}}>
                {tool.icon}
              </button>
            </div>);
          })}
        </div>
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{flex:1,position:'relative'}}>
            <div ref={chartContainerRef} style={{width:'100%',height:'100%'}}/>
            <canvas
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',cursor:canvasCursor(),pointerEvents:activeTool==='Crosshair'||activeTool==='Cursor'?'none':'all',zIndex:10}}
            />
            {activeTool==='Cursor'&&(
              <div
                onClick={handleCanvasMouseDown}
                style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',cursor:'default',zIndex:11,background:'transparent'}}
              />
            )}
          </div>
          <div style={{height:'200px',background:C.panel,borderTop:`1px solid ${C.border}`,flexShrink:0,display:'flex',flexDirection:'column'}}>
            <div style={{display:'flex',borderBottom:`1px solid ${C.border}`,flexShrink:0,alignItems:'center',background:C.panel}}>
              {['positions','history'].map(t=>(<button key={t} onClick={()=>setTab(t)} style={{padding:'8px 16px',background:'none',border:'none',borderBottom:tab===t?`2px solid ${C.accent}`:'2px solid transparent',color:tab===t?C.text:C.muted,fontSize:'11px',fontWeight:'600',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{t==='positions'?`Open Positions (${positions.length})`:`History (${history.length})`}</button>))}
              <div style={{marginLeft:'auto',paddingRight:'16px'}}>
                <span style={{fontSize:'11px',color:C.muted}}>P&L: <span style={{color:totalPnL>=0?C.green:C.red,fontWeight:'700'}}>{fmtP(totalPnL)}</span></span>
              </div>
            </div>
            {positionsContent}
          </div>
        </div>
        <div style={{width:'240px',background:C.panel,borderLeft:`1px solid ${C.border}`,display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden'}}>
          {orderPanelContent}
        </div>
        <div style={{width:'220px',background:C.panel,borderLeft:`1px solid ${C.border}`,display:'flex',flexDirection:'column',flexShrink:0}}>
          <div style={{padding:'10px 12px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:'13px',fontWeight:'700',color:C.text}}>Watchlist</span>
            <Plus size={14} color={C.muted} style={{cursor:'pointer'}}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr auto auto',padding:'5px 10px',gap:'4px',borderBottom:`1px solid ${C.border}`}}>
            {['Symbol','Last','Chg%'].map(h=>(<span key={h} style={{fontSize:'9px',color:C.muted,fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.5px',textAlign:h!=='Symbol'?'right':'left'}}>{h}</span>))}
          </div>
          <div style={{flex:1,overflowY:'auto'}}>
            {['Forex','Crypto','Stocks','Indices'].map(group=>{
              const syms=DEFAULT_SYMBOLS.filter(s=>s.type===group);
              if(!syms.length) return null;
              return(<div key={group}>
                <div style={{padding:'5px 10px',fontSize:'9px',fontWeight:'700',color:C.muted,textTransform:'uppercase',letterSpacing:'1px',background:C.panel2,borderBottom:`1px solid ${C.border}`}}>{group}</div>
                {syms.map(sym=>{
                  const lp=livePrices[sym.symbol];
                  return(<button key={sym.symbol} onClick={()=>setSelectedSymbol(sym)} style={{width:'100%',display:'grid',gridTemplateColumns:'1fr auto auto',padding:'6px 10px',gap:'6px',alignItems:'center',background:selectedSymbol.symbol===sym.symbol?C.accentBg:'transparent',border:'none',borderBottom:`1px solid ${C.border}`,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'7px',overflow:'hidden'}}>
                      <SymbolLogo symbol={sym.symbol} size={20}/>
                      <span style={{fontSize:'11px',fontWeight:'600',color:selectedSymbol.symbol===sym.symbol?C.accent:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sym.symbol}</span>
                    </div>
                    <span style={{fontSize:'10px',color:C.text,fontFamily:'monospace',textAlign:'right'}}>{lp?fmt(lp,SYMBOL_META[sym.symbol]?.polyType==='stocks'?2:sym.symbol.includes('JPY')?3:5):'—'}</span>
                    <span style={{fontSize:'10px',fontWeight:'600',textAlign:'right',minWidth:'44px',fontFamily:'monospace',color:(()=>{const op=openPrices[sym.symbol];if(!lp||!op) return C.muted;return ((lp-op)/op)*100>=0?C.green:C.red;})()}}>
                      {(()=>{const op=openPrices[sym.symbol];if(!lp||!op) return '—';const pct=((lp-op)/op)*100;return (pct>=0?'+':'')+pct.toFixed(2)+'%';})()}
                    </span>
                  </button>);
                })}
              </div>);
            })}
          </div>
          <div style={{borderTop:`1px solid ${C.border}`,background:C.bg,overflowY:'auto',maxHeight:'340px'}}>
            <div style={{padding:'10px 12px 8px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                <SymbolLogo symbol={selectedSymbol.symbol} size={26}/>
                <div>
                  <div style={{fontSize:'13px',fontWeight:'700',color:C.text}}>{selectedSymbol.symbol}</div>
                  <div style={{fontSize:'10px',color:C.muted}}>{selectedSymbol.label}</div>
                </div>
              </div>
              <div style={{fontSize:'20px',fontWeight:'700',color:priceChange>=0?C.green:C.red,fontFamily:'monospace',lineHeight:1,letterSpacing:'-0.5px'}}>{price?fmt(price,decimals):'—'}</div>
              <div style={{fontSize:'11px',color:priceChange>=0?C.green:C.red,marginTop:'2px',fontWeight:'600'}}>{priceChange>=0?'+':''}{priceChange.toFixed(2)}%</div>
              {(()=>{
                const now=new Date();
                const utcH=now.getUTCHours();
                const utcMin=now.getUTCMinutes();
                const utcDay=now.getUTCDay(); // 0=Sun,6=Sat
                const utcMins=utcH*60+utcMin;
                const type=SYMBOL_META[selectedSymbol.symbol]?.polyType||'forex';
                let isOpen=false;
                if(type==='crypto') isOpen=true;
                else if(type==='forex'){
                  // Forex: Sun 22:00 UTC – Fri 22:00 UTC
                  if(utcDay===0&&utcH>=22) isOpen=true;
                  else if(utcDay>=1&&utcDay<=4) isOpen=true;
                  else if(utcDay===5&&utcH<22) isOpen=true;
                } else {
                  // Stocks/Indices: Mon-Fri 13:30–20:00 UTC (NYSE/NASDAQ)
                  if(utcDay>=1&&utcDay<=5&&utcMins>=810&&utcMins<1200) isOpen=true;
                }
                return(
                  <div style={{display:'flex',alignItems:'center',gap:'5px',marginTop:'6px'}}>
                    <div style={{width:'6px',height:'6px',borderRadius:'50%',background:isOpen?C.green:C.red,boxShadow:isOpen?`0 0 4px ${C.green}`:'none'}}/>
                    <span style={{fontSize:'10px',color:isOpen?C.green:C.muted,fontWeight:'500'}}>{isOpen?'Market open':'Market closed'}</span>
                  </div>
                );
              })()}
            </div>
            <div style={{padding:'0 12px 12px'}}>
              <div style={{fontSize:'10px',fontWeight:'700',color:C.text,textTransform:'uppercase',letterSpacing:'0.7px',marginBottom:'8px'}}>Performance</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'5px'}}>
                {[{label:'1D',value:priceChange},{label:'1W',value:null},{label:'1M',value:null},{label:'3M',value:null},{label:'6M',value:null},{label:'1Y',value:null}].map(({label,value})=>(
                  <div key={label} style={{background:value==null?C.panel:value>=0?'rgba(38,166,154,0.1)':'rgba(239,83,80,0.1)',borderRadius:'5px',padding:'5px 6px',textAlign:'center',border:`1px solid ${value==null?C.border:value>=0?'rgba(38,166,154,0.25)':'rgba(239,83,80,0.25)'}`}}>
                    <div style={{fontSize:'9px',color:C.muted,marginBottom:'2px',fontWeight:'600'}}>{label}</div>
                    <div style={{fontSize:'11px',fontWeight:'700',color:value==null?C.muted2:value>=0?C.green:C.red}}>{value==null?'—':`${value>=0?'+':''}${Number(value).toFixed(2)}%`}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
