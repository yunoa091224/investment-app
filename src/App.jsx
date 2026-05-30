import { useState, useEffect, useRef, Component } from "react";
import { jsonrepair } from 'jsonrepair';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, i) { console.error("ErrorBoundary:", e, i); }
  render() {
    if (this.state.error) return (
      <div style={{ padding:40, background:"#04090f", minHeight:"100vh", fontFamily:"monospace", color:"#ff4d6d" }}>
        <div style={{ fontSize:18, fontWeight:700, marginBottom:12 }}>⚠ レンダリングエラー</div>
        <pre style={{ fontSize:12, color:"#ff9090", whiteSpace:"pre-wrap", wordBreak:"break-all" }}>
          {this.state.error.toString()}{"\n\n"}{this.state.error.stack}
        </pre>
      </div>
    );
    return this.props.children;
  }
}

const PERIODS = [
  { key:"short", label:"短期", sub:"1〜4週間", icon:"⚡", color:"#ff6b35" },
  { key:"mid",   label:"中期", sub:"1〜6ヶ月", icon:"📈", color:"#00c9ff" },
  { key:"long",  label:"長期", sub:"1〜3年",   icon:"🏔", color:"#a78bfa" },
];

const RANKING_PROMPT = `あなたは世界トップクラスの株式アナリストです。現時点（2026年5月末）での投資推奨トップ10を作成してください。以下のJSON形式のみで回答（前置き・説明・マークダウン一切不要）:
{"updated":"2026年5月28日","market_comment":"市場環境2〜3文","stocks":[{"rank":1,"ticker":"NVDA","company":"NVIDIA","sector":"半導体","country":"🇺🇸","current_price":"$950","target_price":"$1200","upside":"+26%","score":9.2,"momentum":9,"growth":9,"safety":7,"catalyst":"Blackwell需要","risk":"競合リスク","reason":"AI需要拡大","rating":"強気買い","entry_zone":"$920〜$940","take_profit1":"$1050 +10%","take_profit2":"$1150 +21%","stop_loss":"$880 -7%","sell_trigger":"決算ミス・RSI75超","risk_reward":"1:3.2"}]}
stocksは10件。ratingは「強気買い」「買い」「積極買い」のいずれか。scoreは小数点1桁(1-10)。momentum/growth/safetyは整数(1-10)。改行なしの1行JSONのみ。`;

const ANALYSIS_PROMPT = `あなたは世界トップクラスの株式アナリストです。指定銘柄を詳細分析し以下のJSON形式のみで回答（前置き・説明不要）:
{"ticker":"NVDA","company":"NVIDIA Corporation","sector":"半導体","current_price":"$950","overall_score":82,"buy_rating":"今すぐ買い","entry_zone":"$920〜$945","stop_loss":"$885 -6.8%","take_profit1":"$1020 +7%","take_profit2":"$1100 +15%","take_profit3":"$1200 +26%","hold_period":"2〜4週間","risk_reward":"1:2.8","sell_triggers":["RSI75超え・過熱感","決算ガイダンス下方修正","中国規制強化"],"summary":"Blackwellチップ需要が想定超で...","pros":["AI需要急拡大","高い参入障壁"],"cons":["高バリュエーション","地政学リスク"]}
buy_ratingは「今すぐ買い」「待て」「見送り」のいずれか。overall_scoreは0〜100の整数。sell_triggersは3〜5件。prosとconsは各2〜3件。改行なしの1行JSONのみ。`;

const MACRO_PROMPT = `あなたは世界トップクラスのマクロ経済アナリストです。現在（2026年5月末）の米国市場環境を分析し以下のJSON形式のみで回答（説明不要）:
{"updated":"2026年5月28日","market_score":68,"sentiment":"強気","fed_stance":"据え置き・年内1回利下げ予想","vix":"15.8（低ボラ）","usd_jpy":"156.5円","bond_yield_10y":"4.28%","strong_sectors":[{"name":"半導体・AI","score":9,"reason":"AI需要継続"},{"name":"金融","score":8,"reason":"高金利恩恵"},{"name":"ヘルスケア","score":7,"reason":"防衛的需要"}],"weak_sectors":[{"name":"不動産","score":3,"reason":"高金利"},{"name":"公益","score":3,"reason":"債券競合"},{"name":"素材","score":4,"reason":"中国不安"}],"key_events":["雇用統計（6/6）","CPI（6/12）","FOMC（6/17-18）"],"summary":"S&P500は史上最高値圏で推移中..."}
market_scoreは0〜100の整数。sentimentは「強気」「中立」「弱気」のいずれか。改行なしの1行JSONのみ。`;

const PORTFOLIO_PROMPT = `あなたは世界トップクラスの株式アナリストです。提示されたポートフォリオ全体を診断し以下のJSON形式のみで回答（説明不要）:
{"total_score":72,"overall_health":"良好","holdings":[{"ticker":"NVDA","estimated_price":"$980","verdict":"買い増し","action":"ホールド推奨","comment":"含み益継続・上昇トレンド"}],"diversification_score":6,"risk_level":"中","recommendation":"テック集中を緩和し分散投資を推奨","portfolio_summary":"全体的に強いが集中リスクあり"}
verdictは「買い増し」「ホールド」「売り推奨」のいずれか。total_scoreは0〜100の整数。holdingsは入力された全銘柄を含むこと。改行なしの1行JSONのみ。`;

const TECHNICAL_PROMPT = `あなたは世界トップクラスのテクニカルアナリストです。指定銘柄のテクニカル分析を行い以下のJSON形式のみで回答（説明不要）:
{"ticker":"NVDA","rsi":{"value":65.2,"signal":"中立","comment":"70未満で過熱なし・上昇余地あり"},"macd":{"signal":"買い","comment":"ゴールデンクロス形成・上昇モメンタム継続"},"ma_cross":{"status":"ゴールデン","comment":"50日線が200日線を上抜けたゴールデンクロス形成"},"bollinger":{"upper":"$1020","middle":"$950","lower":"$880","position":"中央"},"pattern":{"name":"カップアンドハンドル","description":"強気継続を示す典型的な上昇パターン。ブレイクアウト後に大幅上昇が期待される"},"tech_score":72,"buy_timing":"$920〜$940の押し目が最適エントリーゾーン。出来高増加を確認してから入る","overall_comment":"テクニカル的に強気トレンド継続中。押し目買い戦略が有効"}
tech_scoreは0〜100の整数。RSI valueは小数点1桁。ma_cross statusは「ゴールデン」「デッド」「なし」のいずれか。改行なしの1行JSONのみ。`;

const FUNDAMENTAL_PROMPT = `あなたは世界トップクラスのファンダメンタルアナリストです。指定銘柄のファンダメンタル分析を行い以下のJSON形式のみで回答（説明不要）:
{"ticker":"NVDA","per":{"value":45.2,"signal":"割高"},"pbr":{"value":22.1,"signal":"割高"},"roe":{"value":89.5,"signal":"優秀"},"revenue_growth":"+122%","profit_growth":"+168%","dcf_fair_value":"$900〜$1100","competitors":[{"ticker":"AMD","per":35.1,"pbr":8.2,"roe":12.3,"growth":"+15%","verdict":"割安"},{"ticker":"INTC","per":22.0,"pbr":1.2,"roe":3.1,"growth":"-5%","verdict":"割安"}],"fundamental_score":78,"summary":"高成長がPER45倍の高バリュエーションを正当化。ROE90%近くは業界最高水準"}
per/pbr signalは「割安」「適正」「割高」のいずれか。roe signalは「優秀」「良好」「普通」「要改善」のいずれか。fundamental_scoreは0〜100の整数。競合は2〜3社。改行なしの1行JSONのみ。`;

const RISK_PROMPT = `あなたは世界トップクラスのポートフォリオアナリストです。以下のポートフォリオのリスク分散を分析し以下のJSON形式のみで回答（説明不要）:
{"sectors":[{"name":"半導体","tickers":["NVDA","AMD"],"percentage":60},{"name":"ソフトウェア","tickers":["MSFT"],"percentage":40}],"regions":[{"name":"米国","percentage":100}],"concentration_risks":["NVDA単一銘柄が45%超・集中リスク高"],"correlations":[{"pair":"NVDA-AMD","level":"高","comment":"同一セクターで高相関"}],"diversification_score":42,"suggestions":["ヘルスケアセクター追加推奨","債券ETFで安定性向上","日本株で地域分散"]}
diversification_scoreは0〜100の整数。sectorsのpercentageの合計は100。改行なしの1行JSONのみ。`;

const SCENARIO_PROMPT = `あなたは世界トップクラスのリスク管理アナリストです。以下のポートフォリオに対して4つのシナリオ分析を行い以下のJSON形式のみで回答（説明不要）:
{"scenarios":[{"name":"強気相場","condition":"S&P500 +20%","estimated_return":"+35%","estimated_pnl":"+$45,000","comment":"AI・半導体はアウトパフォーム"},{"name":"弱気相場","condition":"S&P500 -30%","estimated_return":"-42%","estimated_pnl":"-$54,000","comment":"テック集中で市場より大きく下落"},{"name":"リセッション","condition":"GDP -2%","estimated_return":"-28%","estimated_pnl":"-$36,000","comment":"景気敏感セクターに逆風"},{"name":"利上げ継続","condition":"FF金利 +1%","estimated_return":"-15%","estimated_pnl":"-$19,000","comment":"グロース株のバリュエーション圧縮"}]}
estimated_returnとestimated_pnlは文字列。改行なしの1行JSONのみ。`;

const DCA_PROMPT = `あなたは世界トップクラスのファイナンシャルアドバイザーです。指定された積立投資プランを評価し以下のJSON形式のみで回答（説明不要）:
{"ai_comment":"この銘柄への長期積立について具体的な評価コメント2〜3文","risk_level":"低/中/高","recommendation":"推奨/中立/非推奨","key_risk":"主なリスク1文"}
改行なしの1行JSONのみ。`;

const NEWS_SENTIMENT_PROMPT = `あなたは世界トップクラスの株式アナリストです。指定銘柄の最新ニュースを分析し以下のJSON形式のみで回答（前置き・説明不要）:
{"ticker":"NVDA","news":[{"title":"NVIDIA Blackwell Ultra発表","date":"2026-05-28","summary":"次世代GPU需要爆発・売上倍増予測","score":80,"icon":"🟢"},{"title":"中国輸出規制継続","date":"2026-05-26","summary":"H20チップの中国向け販売制限維持","score":-40,"icon":"🔴"},{"title":"Q1決算が予想大幅超","date":"2026-05-22","summary":"EPS$6.12で予想$5.89を上回る好決算","score":75,"icon":"🟢"},{"title":"競合AMDがMI400発表","date":"2026-05-20","summary":"高性能AIチップでシェア争い激化","score":-20,"icon":"🟡"},{"title":"Microsoft Azure提携拡大","date":"2026-05-18","summary":"GPU供給量を2倍に増強する大型契約","score":60,"icon":"🟢"}],"overall_score":51,"bull_points":["Q1決算が市場予想を上回る好業績","大型提携案件が継続増加"],"bear_points":["中国向け輸出規制による売上機会損失","競合他社の技術追い上げ"],"verdict":"強気"}
newsは5件。scoreは-100〜+100の整数（-100:最弱気〜+100:最強気）。iconは🟢(score>20)🟡(-20〜20)🔴(score<-20)を使用。overall_scoreは全ニュースの加重平均（-100〜100整数）。verdictは「強気」「中立」「弱気」のいずれか。改行なしの1行JSONのみ。`;

const INSIDER_PROMPT = `あなたは世界トップクラスの株式アナリストです。指定銘柄の直近3ヶ月のインサイダー取引を分析し以下のJSON形式のみで回答（前置き・説明不要）:
{"ticker":"NVDA","buy_count":8,"sell_count":3,"buy_ratio":73,"notable":[{"role":"CEO","amount":"$12.5M","type":"買い","meaning":"経営陣が業績に強気のポジティブサイン"},{"role":"CFO","amount":"$3.2M","type":"売り","meaning":"一部利益確定と見られ懸念は少ない"},{"role":"取締役","amount":"$1.8M","type":"買い","meaning":"取締役会全体の強気姿勢を反映"}],"confidence_score":72,"verdict":"強気シグナル"}
buy_ratioは0〜100の整数。confidence_scoreは0〜100の整数。notableは2〜3件。verdictは「強気シグナル」「中立」「警戒シグナル」のいずれか。改行なしの1行JSONのみ。`;

const SHORT_PROMPT = `あなたは世界トップクラスの株式アナリストです。指定銘柄の空売り状況を分析し以下のJSON形式のみで回答（前置き・説明不要）:
{"ticker":"NVDA","short_ratio":"3.2%","meaning":"空売り比率は低水準で売り方は少ない","trend":"減少","squeeze_potential":65,"warnings":["空売り比率が10%を超えた場合は注意が必要"],"verdict":"安全"}
trendは「増加」「減少」「横ばい」のいずれか。squeeze_potentialは0〜100の整数（高いほどショートスクイーズ発生可能性高）。warningsは空売り比率が高い場合の注意点（低い場合は空配列）。verdictは「安全」「注意」「危険」のいずれか。改行なしの1行JSONのみ。`;

const EARNINGS_PROMPT = `あなたは世界トップクラスの株式アナリストです。指定銘柄の決算サプライズを分析し以下のJSON形式のみで回答（前置き・説明不要）:
{"ticker":"NVDA","next_earnings":"2026-08-20（推定）","past_surprises":[{"quarter":"Q1 2026","eps_estimate":"$5.89","eps_actual":"$6.12","surprise_rate":"+3.9%"},{"quarter":"Q4 2025","eps_estimate":"$4.44","eps_actual":"$4.93","surprise_rate":"+11.0%"},{"quarter":"Q3 2025","eps_estimate":"$0.74","eps_actual":"$0.81","surprise_rate":"+9.5%"},{"quarter":"Q2 2025","eps_estimate":"$0.60","eps_actual":"$0.68","surprise_rate":"+13.3%"}],"surprise_prediction":"強気","price_reaction":"上昇","trade_recommendation":"決算前に買う","surprise_score":84}
past_surprisesは直近4四半期分。surprise_predictionは「強気」「弱気」「中立」のいずれか。price_reactionは「上昇」「下落」「横ばい」のいずれか。trade_recommendationは「決算前に買う」「決算前に売る」「様子見」のいずれか。surprise_scoreは0〜100の整数。改行なしの1行JSONのみ。`;

const PIE_COLORS = ["#00e5a0","#00c9ff","#a78bfa","#ff6b35","#ffd700","#ff4d6d","#60d0a0","#f0a0ff"];
function buildPieGradient(sectors) {
  let cum = 0;
  const parts = sectors.map((s, i) => {
    const s1 = (cum * 3.6).toFixed(0);
    cum += s.percentage;
    return `${PIE_COLORS[i%PIE_COLORS.length]} ${s1}deg ${(cum*3.6).toFixed(0)}deg`;
  });
  return `conic-gradient(${parts.join(",")})`;
}

function safeParseJSON(text) {
  const s = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('JSONなし');
  const jsonStr = s.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch(e) {
    try {
      return JSON.parse(jsonrepair(jsonStr));
    } catch(e2) {
      throw new Error('JSON解析失敗: ' + e2.message);
    }
  }
}

async function callAPI(systemPrompt, userMessage) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "x-api-key":import.meta.env.VITE_ANTHROPIC_API_KEY, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
    body: JSON.stringify({ model:"claude-haiku-4-5-20251001", max_tokens:2000, system:systemPrompt, messages:[{ role:"user", content:userMessage }] }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  const tb = json.content?.find(b=>b.type==="text");
  if (!tb) throw new Error("テキストなし");
  return safeParseJSON(tb.text);
}

// ── Shared UI ────────────────────────────────────────────────
function ScoreRing({ score, color }) {
  const r=20, circ=2*Math.PI*r;
  return (
    <svg width="52" height="52" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#ffffff0d" strokeWidth="4"/>
      <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${(score/10)*circ} ${circ}`} strokeLinecap="round" transform="rotate(-90 26 26)"/>
      <text x="26" y="27" fill={color} fontSize="11" fontWeight="700" textAnchor="middle" dominantBaseline="middle">{score}</text>
    </svg>
  );
}
function Bar({ value, color }) {
  return (
    <div style={{ height:4, background:"#ffffff0d", borderRadius:2, overflow:"hidden", flex:1 }}>
      <div style={{ height:"100%", width:`${(value/10)*100}%`, background:color, borderRadius:2 }}/>
    </div>
  );
}
function ScoreBar({ value, color }) {
  return (
    <div style={{ height:10, background:"#ffffff0d", borderRadius:5, overflow:"hidden" }}>
      <div style={{ height:"100%", width:`${Math.min(100,Math.max(0,value))}%`, background:`linear-gradient(90deg,${color}88,${color})`, borderRadius:5, transition:"width .6s ease" }}/>
    </div>
  );
}
function LoadingDots({ color, phases, phase }) {
  return (
    <div style={{ textAlign:"center", padding:"48px 20px" }}>
      <div style={{ fontSize:13, color, marginBottom:20 }}>{phases[phase]}</div>
      <div style={{ display:"flex", justifyContent:"center", gap:6, marginBottom:28 }}>
        {[0,1,2,3].map(i=><div key={i} style={{ width:7, height:7, borderRadius:"50%", background:color, animation:`pulse 1.2s ease-in-out ${i*.18}s infinite` }}/>)}
      </div>
      {[...Array(4)].map((_,i)=><div key={i} className="skeleton" style={{ height:56, marginBottom:8 }}/>)}
    </div>
  );
}
function InputRow({ value, onChange, onEnter, placeholder, loading, btnLabel, btnColor="#00c9ff" }) {
  return (
    <div style={{ display:"flex", gap:8, marginBottom:20 }}>
      <input value={value} onChange={e=>onChange(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&onEnter()}
        placeholder={placeholder}
        style={{ flex:1, background:"#04090f", border:"1px solid #0d2535", borderRadius:8, padding:"10px 14px", color:"#e8f4ff", fontFamily:"inherit", fontSize:13, outline:"none" }}/>
      <button onClick={onEnter} disabled={loading||!value.trim()}
        style={{ padding:"10px 18px", background:loading?"#0d2535":`${btnColor}22`, border:`1px solid ${loading?"#0d2535":btnColor+"55"}`, borderRadius:8, color:loading?"#4a7090":btnColor, cursor:loading?"not-allowed":"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700 }}>
        {loading?"分析中...":btnLabel}
      </button>
    </div>
  );
}
function ErrBox({ msg, onRetry }) {
  return (
    <div style={{ padding:16, background:"#ff4d6d15", border:"1px solid #ff4d6d40", borderRadius:8, color:"#ff4d6d", fontSize:12 }}>
      ⚠ {msg}
      {onRetry && <button onClick={onRetry} style={{ marginLeft:12, padding:"4px 12px", background:"#ff4d6d22", border:"1px solid #ff4d6d55", borderRadius:6, color:"#ff4d6d", cursor:"pointer", fontFamily:"inherit", fontSize:11 }}>再試行</button>}
    </div>
  );
}

// ── Info Modal ────────────────────────────────────────────────
const EXPLANATIONS = {
  rsi:{ title:"RSI（相対力指数）", body:"過去14日間の値動きを基に、買われすぎ・売られすぎを0〜100で示す指標。\n\n🟢 30以下: 売られすぎ（反発期待）\n🟡 30〜70: 中立ゾーン\n🔴 70以上: 買われすぎ（反落注意）\n\n数値が高いほど短期的な過熱感があり、低いほど押し目買いのチャンスを示します。" },
  macd:{ title:"MACD（移動平均収束拡散）", body:"短期（12日）と長期（26日）の指数移動平均の差を示すトレンド系指標。\n\n• MACDがシグナル線を上抜け → 買いシグナル\n• MACDがシグナル線を下抜け → 売りシグナル\n• ヒストグラムがプラス → 上昇モメンタム継続\n• ヒストグラムがマイナス → 下降モメンタム継続" },
  ma_cross:{ title:"移動平均クロス", body:"50日移動平均線と200日移動平均線の関係を示す指標。\n\n📈 ゴールデンクロス: 50日線が200日線を上抜け\n→ 強気トレンドへの転換シグナル\n\n📉 デッドクロス: 50日線が200日線を下抜け\n→ 弱気トレンドへの転換シグナル\n\n長期トレンドの方向性を確認するのに有効です。" },
  bollinger:{ title:"ボリンジャーバンド", body:"移動平均線（中心）±2標準偏差で引いた3本のラインで、価格の変動範囲を示します。\n\n• 上限付近: 買われすぎ・反落リスク\n• 下限付近: 売られすぎ・反発期待\n• バンド収縮: 大きな値動きの前兆\n• バンド拡大: 強いトレンドが継続中\n\n統計的に価格の約95%がバンド内に収まります。" },
  tech_score:{ title:"総合テクニカルスコア", body:"RSI・MACD・移動平均・ボリンジャーバンド・チャートパターンなど複数の指標を総合したスコアです。\n\n🟢 70〜100: テクニカル的に強気・買いサイン多数\n🟡 40〜69: 中立・様子見\n🔴 0〜39: テクニカル的に弱気・注意が必要" },
  per:{ title:"PER（株価収益率）", body:"株価 ÷ 1株当たり純利益（EPS）で計算。\n投資家が1円の利益に対して何円払っているかを示します。\n\n• 低PER: 割安の可能性（ただし成長期待が低い場合も）\n• 高PER: 割高だが高成長期待を織り込んでいる\n\n業種平均と比較することが重要。\n目安: 一般的に15〜20倍が適正水準とされます。" },
  pbr:{ title:"PBR（株価純資産倍率）", body:"株価 ÷ 1株当たり純資産（BPS）で計算。\n会社の解散価値に対して何倍で取引されているかを示します。\n\n• 1倍未満: 理論上の解散価値以下（超割安）\n• 1〜3倍: 概ね適正水準\n• 3倍超: 将来の成長に対するプレミアム\n\nROEが高い企業は高PBRが正当化されます。" },
  roe:{ title:"ROE（自己資本利益率）", body:"純利益 ÷ 自己資本 × 100で計算。\n株主から預かったお金でどれだけ効率よく利益を上げているかを示します。\n\n🟢 20%以上: 優秀（高収益ビジネスモデル）\n🟡 10〜20%: 良好\n🟡 5〜10%: 普通\n🔴 5%未満: 要改善\n\nウォーレン・バフェットは15%以上を優良企業の目安とします。" },
  dcf:{ title:"DCF適正株価（ディスカウントキャッシュフロー）", body:"将来のキャッシュフローを現在価値に割り引いて計算した理論株価です。\n\n• 現在株価 < DCF適正値: 割安の可能性\n• 現在株価 > DCF適正値: 割高の可能性\n\n注意: 将来予測に基づくため、成長率・割引率の仮定によって大きく変わります。あくまで参考値としてご利用ください。" },
  fundamental_score:{ title:"総合ファンダスコア", body:"PER・PBR・ROE・成長率・DCF適正価格などを総合評価したスコアです。\n\n🟢 70〜100: ファンダメンタル的に優良\n🟡 40〜69: 中程度・業種平均水準\n🔴 0〜39: 財務的に注意が必要" },
  overall_score:{ title:"買い推奨度スコア", body:"AIが株価トレンド・バリュエーション・モメンタム・リスクなどを総合的に評価したスコアです。\n\n🟢 70〜100: 今すぐ買い推奨\n🟡 40〜69: 条件付き・様子見\n🔴 0〜39: 見送り推奨\n\n※AIによる推定値であり、投資判断は自己責任でお願いします。" },
  risk_reward:{ title:"リスクリワード比（R/R）", body:"利益目標 ÷ 損失リスクで計算されるコストパフォーマンス指標。\n\n例: R/R = 1:3 の場合\n→ 損切り$10に対して利確目標$30\n\n🟢 1:2以上: 良好なトレード設定\n🟡 1:1〜2: 最低限許容範囲\n🔴 1:1未満: リスクが高い\n\n一般的にプロのトレーダーは1:2以上を推奨します。" },
  market_score:{ title:"マーケットスコア", body:"現在の米国株式市場全体の環境を0〜100で評価したスコアです。\n\nFRBの金融政策・VIX（恐怖指数）・経済指標・市場センチメントなどを総合します。\n\n🟢 70〜100: 強気相場・積極投資に適した環境\n🟡 40〜69: 中立・選択的に投資\n🔴 0〜39: 弱気相場・リスク管理を優先" },
  diversification_score:{ title:"分散スコア", body:"ポートフォリオの分散具合を0〜100で評価したスコアです。\n\n評価基準:\n• セクター分散（複数業種に分散しているか）\n• 地域分散（米国のみか、国際分散されているか）\n• 銘柄集中度（1銘柄に偏りすぎていないか）\n• 相関度（保有銘柄の値動きの相関が低いか）\n\n🟢 70以上: 十分に分散\n🟡 40〜69: 部分的な集中リスク\n🔴 40未満: 集中リスク高・要改善" },
  dca:{ title:"ドルコスト平均法（DCA）", body:"一定の金額を定期的に投資し続ける手法です。\n\n✅ メリット:\n• 買い時を気にせず自動的に分散投資できる\n• 価格が下がった時ほど多く買える\n• 感情的な判断ミスを防げる\n\n⚠ デメリット:\n• 急騰相場では一括投資より不利\n• 右肩下がりの銘柄では損失が拡大する\n\n長期的な資産形成に有効とされる投資戦略です。" },
  sentiment_score:{ title:"センチメントスコア", body:"ニュースや市場の雰囲気から算出した感情スコアです。\n\n-100〜+100の範囲で表示:\n🟢 +21〜+100: 強気センチメント\n🟡 -20〜+20: 中立センチメント\n🔴 -100〜-21: 弱気センチメント\n\n短期的な株価の方向性を予測する参考指標です。極端な値は逆張りのサインになることもあります。" },
  insider_confidence:{ title:"インサイダー信頼度スコア", body:"経営陣・役員などのインサイダーによる売買パターンから算出した信頼度スコアです。\n\n🟢 70以上: インサイダーの買いが優勢・強気シグナル\n🟡 40〜69: 中立・様子見\n🔴 40未満: インサイダーの売りが優勢・注意\n\nCEOや大口役員の自社株買いは業績への強い自信を示すことが多いです。ただし税務・報酬目的の売却は必ずしも弱気サインではありません。" },
  squeeze_potential:{ title:"スクイーズポテンシャル", body:"空売り残高が高い銘柄で発生しうる「ショートスクイーズ」の可能性を0〜100で示します。\n\nショートスクイーズとは:\n株価が上昇すると空売りの買い戻しが殺到し、さらに株価が急騰する現象。\n\n🟢 0〜39: 低い（安全圏）\n🟡 40〜69: 中程度（注意）\n🔴 70以上: 高い（スクイーズ発生リスク大）\n\nゲームストップ（GME）の急騰はショートスクイーズの典型例です。" },
  surprise_score:{ title:"サプライズスコア", body:"過去の決算サプライズ実績と今後の予測を総合したスコアです。\n\n🟢 70以上: 強いサプライズ傾向・株価上昇期待大\n🟡 40〜69: 中程度・不確実性高め\n🔴 40未満: ネガティブサプライズのリスク\n\n決算サプライズとは、実際のEPSがアナリスト予想を上回る（または下回る）こと。高いサプライズ率が続く銘柄は評価見直しによる株価上昇が期待できます。" },
};
function InfoBtn({ id }) {
  const [open, setOpen] = useState(false);
  const info = EXPLANATIONS[id];
  if (!info) return null;
  return (
    <>
      <button onClick={e=>{ e.stopPropagation(); setOpen(true); }}
        style={{ background:"transparent", border:"none", color:"#2a4560", cursor:"pointer", fontSize:12, padding:"0 2px", lineHeight:1, flexShrink:0 }}>❓</button>
      {open && (
        <div onClick={()=>setOpen(false)}
          style={{ position:"fixed", inset:0, background:"#000000b0", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 16px" }}>
          <div onClick={e=>e.stopPropagation()}
            style={{ background:"#09141e", border:"1px solid #1a3550", borderRadius:16, padding:"24px 20px", maxWidth:380, width:"100%", position:"relative", boxShadow:"0 24px 64px #000000cc" }}>
            <div style={{ fontSize:15, fontWeight:900, color:"#e8f4ff", marginBottom:14, paddingRight:28 }}>{info.title}</div>
            <div style={{ fontSize:12, color:"#7090a8", lineHeight:1.9, whiteSpace:"pre-wrap" }}>{info.body}</div>
            <button onClick={()=>setOpen(false)}
              style={{ position:"absolute", top:14, right:14, background:"#ffffff0d", border:"none", color:"#4a7090", fontSize:15, cursor:"pointer", width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── StockCard ─────────────────────────────────────────────────
function StockCard({ stock, color, expanded, onToggle }) {
  const rc = { "強気買い":"#00e5a0","買い":"#60d0a0","積極買い":"#40c4ff" }[stock.rating]||"#00e5a0";
  return (
    <div onClick={onToggle} style={{ background:expanded?"#0f1e2d":"#09141e", border:`1px solid ${expanded?color+"55":"#0d2030"}`, borderRadius:12, padding:"14px 16px", cursor:"pointer", marginBottom:8, position:"relative", overflow:"hidden" }}>
      {expanded&&<div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${color},transparent)` }}/>}
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:32, height:32, borderRadius:8, background:`${color}22`, border:`1px solid ${color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:900, color, flexShrink:0 }}>{stock.rank}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
            <span style={{ fontSize:15, fontWeight:800, color:"#e8f4ff" }}>{stock.ticker}</span>
            <span style={{ fontSize:10, color:"#4a6070" }}>{stock.country}</span>
            <span style={{ fontSize:10, padding:"2px 6px", background:`${rc}22`, color:rc, borderRadius:10, border:`1px solid ${rc}44` }}>{stock.rating}</span>
            <span style={{ fontSize:10, padding:"2px 6px", background:"#ffffff08", color:"#4a7090", borderRadius:6 }}>{stock.sector}</span>
          </div>
          <div style={{ fontSize:11, color:"#4a7090", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{stock.company}</div>
        </div>
        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ fontSize:12, color:"#e8f4ff", fontWeight:700 }}>{stock.current_price}</div>
          <div style={{ fontSize:12, color:"#00e5a0", fontWeight:700 }}>{stock.upside}</div>
        </div>
        <ScoreRing score={stock.score} color={color}/>
      </div>
      {expanded&&(
        <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid #0d2030" }}>
          <div style={{ marginBottom:10, fontSize:11, color:"#6090a8" }}>目標株価: <span style={{ color:"#e8f4ff", fontWeight:700 }}>{stock.target_price}</span></div>
          {[["モメンタム",stock.momentum],["成長性",stock.growth],["安全性",stock.safety]].map(([lbl,val])=>(
            <div key={lbl} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:7 }}>
              <span style={{ fontSize:10, color:"#4a7090", width:64 }}>{lbl}</span>
              <Bar value={val} color={color}/>
              <span style={{ fontSize:11, color, width:16, textAlign:"right" }}>{val}</span>
            </div>
          ))}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:10 }}>
            <div style={{ background:"#00e5a010", border:"1px solid #00e5a025", borderRadius:8, padding:"8px 10px" }}>
              <div style={{ fontSize:9, color:"#00e5a0", letterSpacing:2, marginBottom:4 }}>CATALYST ▲</div>
              <div style={{ fontSize:11, color:"#70a090", lineHeight:1.5 }}>{stock.catalyst}</div>
            </div>
            <div style={{ background:"#ff4d6d10", border:"1px solid #ff4d6d25", borderRadius:8, padding:"8px 10px" }}>
              <div style={{ fontSize:9, color:"#ff4d6d", letterSpacing:2, marginBottom:4 }}>RISK ▼</div>
              <div style={{ fontSize:11, color:"#906070", lineHeight:1.5 }}>{stock.risk}</div>
            </div>
          </div>
          <div style={{ background:"#060e17", borderRadius:8, padding:"10px 12px", marginTop:8 }}>
            <div style={{ fontSize:9, color, letterSpacing:2, marginBottom:4 }}>▶ 推薦理由</div>
            <div style={{ fontSize:12, color:"#8ab0c8", lineHeight:1.7 }}>{stock.reason}</div>
          </div>
          {stock.entry_zone&&(
            <div style={{ marginTop:8, background:"#06111a", border:"1px solid #0d2535", borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:9, color:"#ffd700", letterSpacing:2, marginBottom:8 }}>⚡ 売買戦略</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:6 }}>
                <div style={{ background:"#00e5a010", border:"1px solid #00e5a025", borderRadius:6, padding:"6px 8px" }}>
                  <div style={{ fontSize:9, color:"#00e5a0", marginBottom:2 }}>▶ 買いゾーン</div>
                  <div style={{ fontSize:11, color:"#90d4b0", fontWeight:700 }}>{stock.entry_zone}</div>
                </div>
                <div style={{ background:"#ff4d6d10", border:"1px solid #ff4d6d25", borderRadius:6, padding:"6px 8px" }}>
                  <div style={{ fontSize:9, color:"#ff4d6d", marginBottom:2 }}>▼ 損切り</div>
                  <div style={{ fontSize:11, color:"#d07080", fontWeight:700 }}>{stock.stop_loss}</div>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:6 }}>
                <div style={{ background:"#00c9ff10", border:"1px solid #00c9ff25", borderRadius:6, padding:"6px 8px" }}>
                  <div style={{ fontSize:9, color:"#00c9ff", marginBottom:2 }}>① 利確</div>
                  <div style={{ fontSize:11, color:"#70b8d0", fontWeight:700 }}>{stock.take_profit1}</div>
                </div>
                <div style={{ background:"#00c9ff10", border:"1px solid #00c9ff25", borderRadius:6, padding:"6px 8px" }}>
                  <div style={{ fontSize:9, color:"#00c9ff", marginBottom:2 }}>② 利確</div>
                  <div style={{ fontSize:11, color:"#70b8d0", fontWeight:700 }}>{stock.take_profit2}</div>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                <div style={{ background:"#ffd70010", border:"1px solid #ffd70025", borderRadius:6, padding:"6px 8px" }}>
                  <div style={{ fontSize:9, color:"#ffd700", marginBottom:2 }}>⚠ 売りトリガー</div>
                  <div style={{ fontSize:10, color:"#b0a060", lineHeight:1.5 }}>{stock.sell_trigger}</div>
                </div>
                <div style={{ background:"#a78bfa10", border:"1px solid #a78bfa25", borderRadius:6, padding:"6px 8px" }}>
                  <div style={{ fontSize:9, color:"#a78bfa", marginBottom:2, display:"flex", alignItems:"center", gap:3 }}>⚖ R/R比<InfoBtn id="risk_reward"/></div>
                  <div style={{ fontSize:14, color:"#c0a0f0", fontWeight:900 }}>{stock.risk_reward}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab 1: Ranking ────────────────────────────────────────────
function RankingTab() {
  const [period, setPeriod] = useState("short");
  const [data, setData] = useState({});
  const [loading, setLoading] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const phaseRef = useRef(null);
  const phases = ["🌐 市場データを収集中...","📊 ニュース分析中...","🤖 10銘柄を選定中...","📈 スコアリング中...","✅ レポート生成中..."];
  const cur = PERIODS.find(p=>p.key===period);
  const periodMap = { short:"短期（1〜4週間）スイングトレード向け", mid:"中期（1〜6ヶ月）トレンドフォロー向け", long:"長期（1〜3年）成長投資向け" };
  async function fetchRanking(p) {
    if (data[p]||loading[p]) return;
    setLoading(prev=>({...prev,[p]:true})); setPhaseIdx(0);
    phaseRef.current = setInterval(()=>setPhaseIdx(i=>(i+1)%phases.length),900);
    try { const r=await callAPI(RANKING_PROMPT,`2026年5月時点で${periodMap[p]}のおすすめ米国株トップ10を選定してください。JSONのみ返してください。`); setData(prev=>({...prev,[p]:r})); }
    catch(e) { setData(prev=>({...prev,[p]:{error:true,msg:e.message}})); }
    finally { clearInterval(phaseRef.current); setLoading(prev=>({...prev,[p]:false})); }
  }
  useEffect(()=>{fetchRanking("short");},[]);
  useEffect(()=>{fetchRanking(period);},[period]);
  const d=data[period]; const isLoading=loading[period];
  return (
    <div>
      <div style={{ display:"flex", gap:2, padding:"0 16px" }}>
        {PERIODS.map(p=>(
          <button key={p.key} onClick={()=>setPeriod(p.key)} style={{ flex:1, padding:"12px 8px", background:period===p.key?`${p.color}18`:"transparent", border:`1px solid ${period===p.key?p.color+"55":"#0d2030"}`, borderBottom:"none", borderRadius:"10px 10px 0 0", color:period===p.key?p.color:"#3a5570", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700 }}>
            <div>{p.icon} {p.label}</div><div style={{ fontSize:9, marginTop:2, opacity:.7 }}>{p.sub}</div>
          </button>
        ))}
      </div>
      <div style={{ borderTop:"1px solid #0d2030", padding:"16px 16px 8px" }}>
        {isLoading&&<LoadingDots color={cur.color} phases={phases} phase={phaseIdx}/>}
        {d?.error&&<ErrBox msg={d.msg} onRetry={()=>{setData(prev=>({...prev,[period]:undefined}));fetchRanking(period);}}/>}
        {d&&!d.error&&!isLoading&&(
          <div style={{ animation:"fadeIn .4s ease" }}>
            <div style={{ background:`${cur.color}0d`, border:`1px solid ${cur.color}33`, borderRadius:10, padding:"12px 16px", marginBottom:16 }}>
              <div style={{ fontSize:9, color:cur.color, letterSpacing:3, marginBottom:4 }}>AI MARKET COMMENT</div>
              <div style={{ fontSize:12, color:"#7090a8", lineHeight:1.7 }}>{d.market_comment}</div>
            </div>
            {(d.stocks||[]).map(s=>(
              <StockCard key={s.rank} stock={s} color={cur.color} expanded={expandedId===`${period}-${s.rank}`} onToggle={()=>setExpandedId(expandedId===`${period}-${s.rank}`?null:`${period}-${s.rank}`)}/>
            ))}
            <div style={{ marginTop:20, padding:14, background:"#07111a", border:"1px solid #0d2030", borderRadius:8, fontSize:9, color:"#253545", lineHeight:1.8, textAlign:"center" }}>
              ⚠ 本ランキングはAI情報提供目的であり、投資勧誘・助言ではありません。
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab 2: Analysis ───────────────────────────────────────────
function AnalysisTab({ initialTicker }) {
  const [ticker, setTicker] = useState(initialTicker||"");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState(0);
  const phaseRef = useRef(null);
  const phases = ["🔍 銘柄情報を取得中...","📊 テクニカル分析中...","🤖 売買戦略を策定中...","✅ レポート生成中..."];
  useEffect(()=>{if(initialTicker)doAnalyze(initialTicker);},[]);
  async function doAnalyze(t) {
    const target=(t||ticker).trim().toUpperCase(); if(!target)return;
    setLoading(true);setResult(null);setError(null);setPhase(0);
    phaseRef.current=setInterval(()=>setPhase(i=>(i+1)%phases.length),800);
    try{const d=await callAPI(ANALYSIS_PROMPT,`${target}を詳細分析してください。JSONのみ返してください。`);setResult(d);}
    catch(e){setError(e.message);}
    finally{clearInterval(phaseRef.current);setLoading(false);}
  }
  const vs={"今すぐ買い":{color:"#00e5a0",bg:"#00e5a015",border:"#00e5a040"},"待て":{color:"#ffd700",bg:"#ffd70015",border:"#ffd70040"},"見送り":{color:"#ff4d6d",bg:"#ff4d6d15",border:"#ff4d6d40"}};
  return (
    <div style={{ padding:"16px 16px 8px" }}>
      <InputRow value={ticker} onChange={setTicker} onEnter={()=>doAnalyze()} placeholder="ティッカー例: NVDA, AAPL, TSLA" loading={loading} btnLabel="分析する"/>
      {loading&&<LoadingDots color="#00c9ff" phases={phases} phase={phase}/>}
      {error&&<ErrBox msg={error}/>}
      {result&&!loading&&(()=>{
        const v=vs[result.buy_rating]||vs["見送り"];
        const sc=result.overall_score>=70?"#00e5a0":result.overall_score>=40?"#ffd700":"#ff4d6d";
        return (
          <div style={{ animation:"fadeIn .3s ease" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, padding:"14px 16px", background:"#09141e", border:"1px solid #0d2030", borderRadius:12 }}>
              <div>
                <div style={{ fontSize:22, fontWeight:900, color:"#eaf4ff" }}>{result.ticker}</div>
                <div style={{ fontSize:11, color:"#4a7090", marginBottom:4 }}>{result.company} · {result.sector}</div>
                <div style={{ fontSize:15, color:"#e8f4ff", fontWeight:700 }}>{result.current_price}</div>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ padding:"10px 16px", background:v.bg, border:`1px solid ${v.border}`, borderRadius:12, color:v.color, fontSize:15, fontWeight:900, marginBottom:8 }}>{result.buy_rating}</div>
                <div style={{ fontSize:10, color:"#4a7090" }}>保有期間: {result.hold_period}</div>
              </div>
            </div>
            <div style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:10, padding:"14px 16px", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ fontSize:11, color:"#4a7090" }}>買い推奨度</span><InfoBtn id="overall_score"/></div>
                <span style={{ fontSize:22, fontWeight:900, color:sc }}>{result.overall_score}<span style={{ fontSize:11 }}>/100</span></span>
              </div>
              <ScoreBar value={result.overall_score} color={sc}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
              <div style={{ background:"#00e5a010", border:"1px solid #00e5a025", borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:9, color:"#00e5a0", letterSpacing:2, marginBottom:6 }}>▶ 買いゾーン</div>
                <div style={{ fontSize:13, color:"#90d4b0", fontWeight:700 }}>{result.entry_zone}</div>
              </div>
              <div style={{ background:"#ff4d6d10", border:"1px solid #ff4d6d25", borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:9, color:"#ff4d6d", letterSpacing:2, marginBottom:6 }}>▼ 損切りライン</div>
                <div style={{ fontSize:13, color:"#d07080", fontWeight:700 }}>{result.stop_loss}</div>
              </div>
            </div>
            <div style={{ background:"#04090f", border:"1px solid #0d2030", borderRadius:8, padding:"10px 12px", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:9, color:"#00c9ff", letterSpacing:2 }}>📈 利確3段階</div>
                <span style={{ fontSize:12, color:"#a78bfa", fontWeight:700 }}>R/R {result.risk_reward}</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                {[["①",result.take_profit1],["②",result.take_profit2],["③",result.take_profit3]].map(([lbl,val])=>(
                  <div key={lbl} style={{ background:"#00c9ff0d", border:"1px solid #00c9ff20", borderRadius:6, padding:"6px 8px", textAlign:"center" }}>
                    <div style={{ fontSize:9, color:"#00c9ff", marginBottom:3 }}>{lbl}</div>
                    <div style={{ fontSize:11, color:"#70b8d0", fontWeight:700 }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background:"#ffd70010", border:"1px solid #ffd70025", borderRadius:8, padding:"10px 12px", marginBottom:8 }}>
              <div style={{ fontSize:9, color:"#ffd700", letterSpacing:2, marginBottom:8 }}>⚠ これが起きたら売れ</div>
              {(result.sell_triggers||[]).map((sig,i)=>(
                <label key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:8, cursor:"pointer" }}>
                  <input type="checkbox" style={{ marginTop:2, accentColor:"#ffd700", flexShrink:0 }}/>
                  <span style={{ fontSize:12, color:"#b0a060", lineHeight:1.5 }}>{sig}</span>
                </label>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
              <div style={{ background:"#00e5a010", border:"1px solid #00e5a025", borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:9, color:"#00e5a0", letterSpacing:2, marginBottom:6 }}>✓ ポジティブ</div>
                {(result.pros||[]).map((p,i)=><div key={i} style={{ fontSize:11, color:"#70a090", lineHeight:1.6 }}>▸ {p}</div>)}
              </div>
              <div style={{ background:"#ff4d6d10", border:"1px solid #ff4d6d25", borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:9, color:"#ff4d6d", letterSpacing:2, marginBottom:6 }}>✗ リスク</div>
                {(result.cons||[]).map((c,i)=><div key={i} style={{ fontSize:11, color:"#906070", lineHeight:1.6 }}>▸ {c}</div>)}
              </div>
            </div>
            <div style={{ background:"#060e17", border:"1px solid #0d2030", borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:9, color:"#00c9ff", letterSpacing:2, marginBottom:4 }}>▶ 総合サマリー</div>
              <div style={{ fontSize:12, color:"#8ab0c8", lineHeight:1.7 }}>{result.summary}</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Tab 3: Portfolio ──────────────────────────────────────────
function PortfolioTab() {
  const [holdings, setHoldings] = useState(()=>{try{return JSON.parse(localStorage.getItem("portfolio_holdings")||"[]");}catch{return[];}});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ticker:"",purchase_price:"",shares:"",purchase_date:""});
  const [diagnosis, setDiagnosis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState(0);
  const phaseRef = useRef(null);
  const phases = ["📊 保有銘柄を分析中...","💹 現在価格を推計中...","🤖 ポートフォリオ診断中...","✅ レポート生成中..."];
  function save(h){setHoldings(h);localStorage.setItem("portfolio_holdings",JSON.stringify(h));}
  function addHolding(){if(!form.ticker||!form.purchase_price||!form.shares)return;save([...holdings,{...form,ticker:form.ticker.toUpperCase(),id:Date.now()}]);setForm({ticker:"",purchase_price:"",shares:"",purchase_date:""});setShowForm(false);}
  async function runDiagnosis(){
    if(!holdings.length)return;setLoading(true);setDiagnosis(null);setError(null);setPhase(0);
    phaseRef.current=setInterval(()=>setPhase(i=>(i+1)%phases.length),900);
    const summary=holdings.map(h=>`${h.ticker}:取得価格$${h.purchase_price}×${h.shares}株(${h.purchase_date||"日付不明"})`).join(", ");
    try{const r=await callAPI(PORTFOLIO_PROMPT,`以下のポートフォリオを診断してください: ${summary}。JSONのみ返してください。`);setDiagnosis(r);}
    catch(e){setError(e.message);}
    finally{clearInterval(phaseRef.current);setLoading(false);}
  }
  const vc={"買い増し":"#00e5a0","ホールド":"#00c9ff","売り推奨":"#ff4d6d"};
  const diagH=diagnosis?.holdings||[];
  const estVals=diagH.map(d=>{const h=holdings.find(h=>h.ticker===d.ticker);if(!h)return null;const ep=parseFloat((d.estimated_price||"0").replace(/[^0-9.]/g,""));const bp=parseFloat(h.purchase_price);return{pnl:(ep-bp)*parseFloat(h.shares),cost:bp*parseFloat(h.shares),win:ep>bp};}).filter(Boolean);
  const totalPnl=estVals.reduce((a,b)=>a+b.pnl,0);
  const winRate=estVals.length?Math.round(estVals.filter(v=>v.win).length/estVals.length*100):0;
  return (
    <div style={{ padding:"16px 16px 8px" }}>
      {diagnosis&&(
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
          {[{label:"AI総合スコア",value:`${diagnosis.total_score}/100`,color:diagnosis.total_score>=70?"#00e5a0":diagnosis.total_score>=40?"#ffd700":"#ff4d6d"},{label:"合計損益(推計)",value:`${totalPnl>=0?"+":""}$${Math.round(totalPnl).toLocaleString()}`,color:totalPnl>=0?"#00e5a0":"#ff4d6d"},{label:"勝率",value:`${winRate}%`,color:winRate>=60?"#00e5a0":winRate>=40?"#ffd700":"#ff4d6d"}].map(({label,value,color})=>(
            <div key={label} style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
              <div style={{ fontSize:9, color:"#4a7090", marginBottom:4 }}>{label}</div>
              <div style={{ fontSize:14, fontWeight:900, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <button onClick={()=>setShowForm(!showForm)} style={{ flex:1, padding:"10px", background:"#00e5a015", border:"1px solid #00e5a040", borderRadius:8, color:"#00e5a0", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700 }}>+ 銘柄を追加</button>
        <button onClick={runDiagnosis} disabled={loading||!holdings.length} style={{ flex:1, padding:"10px", background:loading?"#0d2535":"#a78bfa15", border:`1px solid ${loading?"#0d2535":"#a78bfa40"}`, borderRadius:8, color:loading?"#4a7090":"#a78bfa", cursor:loading||!holdings.length?"not-allowed":"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700 }}>{loading?"診断中...":"🤖 AIに全体診断"}</button>
      </div>
      {showForm&&(
        <div style={{ background:"#09141e", border:"1px solid #0d2535", borderRadius:10, padding:14, marginBottom:16, animation:"fadeIn .2s ease" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            {[["ticker","ティッカー (NVDA)"],["purchase_price","取得価格 ($)"],["shares","株数"],["purchase_date","取得日 (2024-01-15)"]].map(([key,ph])=>(
              <input key={key} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder={ph} style={{ background:"#04090f", border:"1px solid #0d2535", borderRadius:6, padding:"8px 10px", color:"#e8f4ff", fontFamily:"inherit", fontSize:12, outline:"none" }}/>
            ))}
          </div>
          <button onClick={addHolding} style={{ width:"100%", padding:"8px", background:"#00e5a022", border:"1px solid #00e5a055", borderRadius:6, color:"#00e5a0", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700 }}>保存する</button>
        </div>
      )}
      {loading&&<LoadingDots color="#a78bfa" phases={phases} phase={phase}/>}
      {error&&<ErrBox msg={error}/>}
      {holdings.length===0?(
        <div style={{ textAlign:"center", padding:"40px 20px", color:"#3a5570", fontSize:13 }}>銘柄を追加してポートフォリオを作成してください</div>
      ):(
        <div>
          {holdings.map(h=>{
            const dh=diagH.find(d=>d.ticker===h.ticker);
            const ep=dh?parseFloat((dh.estimated_price||"0").replace(/[^0-9.]/g,"")): null;
            const pnlPct=ep?((ep-parseFloat(h.purchase_price))/parseFloat(h.purchase_price)*100).toFixed(1):null;
            const vcolor=dh?(vc[dh.verdict]||"#4a7090"):"#4a7090";
            return (
              <div key={h.id} style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:10, padding:"12px 14px", marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:16, fontWeight:900, color:"#e8f4ff" }}>{h.ticker}</span>
                      {dh&&<span style={{ fontSize:10, padding:"2px 8px", background:`${vcolor}22`, color:vcolor, borderRadius:8, border:`1px solid ${vcolor}44` }}>{dh.verdict}</span>}
                    </div>
                    <div style={{ fontSize:10, color:"#4a7090", marginTop:2 }}>取得: ${h.purchase_price} × {h.shares}株{h.purchase_date&&` · ${h.purchase_date}`}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    {ep&&<div style={{ textAlign:"right" }}><div style={{ fontSize:13, color:"#e8f4ff", fontWeight:700 }}>${ep.toFixed(0)}<span style={{ fontSize:9, color:"#4a7090" }}> 推計</span></div><div style={{ fontSize:12, color:parseFloat(pnlPct)>=0?"#00e5a0":"#ff4d6d", fontWeight:700 }}>{parseFloat(pnlPct)>=0?"+":""}{pnlPct}%</div></div>}
                    <button onClick={()=>save(holdings.filter(x=>x.id!==h.id))} style={{ background:"#ff4d6d15", border:"1px solid #ff4d6d30", borderRadius:6, color:"#ff4d6d", cursor:"pointer", fontSize:11, padding:"4px 8px", fontFamily:"inherit" }}>削除</button>
                  </div>
                </div>
                {dh?.comment&&<div style={{ fontSize:11, color:"#507090", borderTop:"1px solid #0d2030", paddingTop:8, marginTop:8, lineHeight:1.5 }}>▸ {dh.comment}</div>}
              </div>
            );
          })}
          {diagnosis?.recommendation&&(
            <div style={{ background:"#060e17", border:"1px solid #0d2030", borderRadius:8, padding:"12px 14px", marginTop:8 }}>
              <div style={{ fontSize:9, color:"#a78bfa", letterSpacing:2, marginBottom:6 }}>▶ AI総合レコメンデーション</div>
              <div style={{ fontSize:12, color:"#8ab0c8", lineHeight:1.7 }}>{diagnosis.recommendation}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab 4: Macro ──────────────────────────────────────────────
function MacroTab() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState(0);
  const phaseRef = useRef(null);
  const phases = ["🌐 市場データを収集中...","📊 経済指標を分析中...","🤖 マクロ環境を評価中...","✅ レポート生成中..."];
  const sc = {"強気":"#00e5a0","中立":"#ffd700","弱気":"#ff4d6d"};
  const secC = s=>s>=7?"#00e5a0":s>=5?"#ffd700":"#ff4d6d";
  async function analyze(){
    setLoading(true);setResult(null);setError(null);setPhase(0);
    phaseRef.current=setInterval(()=>setPhase(i=>(i+1)%phases.length),900);
    try{const d=await callAPI(MACRO_PROMPT,"2026年5月末時点の米国市場マクロ環境を分析してください。JSONのみ返してください。");setResult(d);}
    catch(e){setError(e.message);}
    finally{clearInterval(phaseRef.current);setLoading(false);}
  }
  return (
    <div style={{ padding:"16px 16px 8px" }}>
      {!result&&!loading&&!error&&(
        <div style={{ textAlign:"center", padding:"48px 20px" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🌍</div>
          <div style={{ fontSize:14, color:"#4a7090", marginBottom:24 }}>AIが最新のマクロ経済環境を分析します</div>
          <button onClick={analyze} style={{ padding:"14px 32px", background:"#00c9ff22", border:"1px solid #00c9ff55", borderRadius:12, color:"#00c9ff", cursor:"pointer", fontFamily:"inherit", fontSize:15, fontWeight:700 }}>🔍 マクロ環境を分析する</button>
        </div>
      )}
      {loading&&<LoadingDots color="#00c9ff" phases={phases} phase={phase}/>}
      {error&&<ErrBox msg={error} onRetry={analyze}/>}
      {result&&!loading&&(
        <div style={{ animation:"fadeIn .4s ease" }}>
          <div style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:12, padding:16, marginBottom:12, textAlign:"center" }}>
            <div style={{ fontSize:9, color:"#4a7090", letterSpacing:3, marginBottom:8, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>MARKET SCORE · {result.updated}<InfoBtn id="market_score"/></div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:16, marginBottom:12 }}>
              <div style={{ fontSize:52, fontWeight:900, color:sc[result.sentiment]||"#00e5a0" }}>{result.market_score}</div>
              <div><div style={{ fontSize:22, fontWeight:900, color:sc[result.sentiment]||"#00e5a0" }}>{result.sentiment}相場</div><div style={{ fontSize:11, color:"#4a7090" }}>総合スコア /100</div></div>
            </div>
            <ScoreBar value={result.market_score} color={sc[result.sentiment]||"#00e5a0"}/>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
            {[["FRB政策",result.fed_stance,"#a78bfa"],["VIX",result.vix,"#ffd700"],["ドル円",result.usd_jpy,"#00c9ff"],["10年債利回り",result.bond_yield_10y,"#ff6b35"]].map(([label,value,color])=>(
              <div key={label} style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:9, color:"#4a7090", letterSpacing:2, marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:12, color, fontWeight:700, lineHeight:1.4 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
            {[["💪 強いセクター TOP3",result.strong_sectors,"#00e5a0","#00e5a00a","#00e5a020"],["📉 弱いセクター TOP3",result.weak_sectors,"#ff4d6d","#ff4d6d0a","#ff4d6d20"]].map(([title,sectors,hc,bg,border])=>(
              <div key={title} style={{ background:bg, border:`1px solid ${border}`, borderRadius:10, padding:"12px 14px" }}>
                <div style={{ fontSize:9, color:hc, letterSpacing:2, marginBottom:10 }}>{title}</div>
                {(sectors||[]).map((s,i)=>(
                  <div key={i} style={{ marginBottom:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                      <span style={{ fontSize:11, color:"#e8f4ff", fontWeight:700 }}>{s.name}</span>
                      <span style={{ fontSize:11, color:secC(s.score), fontWeight:700 }}>{s.score}/10</span>
                    </div>
                    <div style={{ height:3, background:"#ffffff0d", borderRadius:2, overflow:"hidden", marginBottom:3 }}>
                      <div style={{ height:"100%", width:`${s.score*10}%`, background:secC(s.score) }}/>
                    </div>
                    <div style={{ fontSize:9, color:"#4a7090" }}>{s.reason}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:8, padding:"12px 14px", marginBottom:12 }}>
            <div style={{ fontSize:9, color:"#ffd700", letterSpacing:2, marginBottom:8 }}>📅 注目イベント</div>
            {(result.key_events||[]).map((ev,i)=>(
              <div key={i} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
                <span style={{ color:"#ffd700", fontSize:10 }}>▸</span><span style={{ fontSize:12, color:"#b0a060" }}>{ev}</span>
              </div>
            ))}
          </div>
          <div style={{ background:"#060e17", border:"1px solid #0d2030", borderRadius:8, padding:"12px 14px", marginBottom:8 }}>
            <div style={{ fontSize:9, color:"#00c9ff", letterSpacing:2, marginBottom:4 }}>▶ 総合サマリー</div>
            <div style={{ fontSize:12, color:"#8ab0c8", lineHeight:1.7 }}>{result.summary}</div>
          </div>
          <button onClick={analyze} style={{ width:"100%", padding:"10px", background:"#00c9ff0d", border:"1px solid #00c9ff25", borderRadius:8, color:"#4a7090", cursor:"pointer", fontFamily:"inherit", fontSize:12 }}>🔄 再分析する</button>
        </div>
      )}
    </div>
  );
}

// ── Tab 5: Watchlist ──────────────────────────────────────────
function WatchlistTab({ onAnalyze }) {
  const [items, setItems] = useState(()=>{try{return JSON.parse(localStorage.getItem("watchlist")||"[]");}catch{return[];}});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ticker:"",memo:""});
  const [editId, setEditId] = useState(null);
  const [editMemo, setEditMemo] = useState("");
  function save(it){setItems(it);localStorage.setItem("watchlist",JSON.stringify(it));}
  function addItem(){if(!form.ticker.trim())return;save([...items,{ticker:form.ticker.toUpperCase().trim(),memo:form.memo,id:Date.now(),added:new Date().toLocaleDateString("ja-JP")}]);setForm({ticker:"",memo:""});setShowForm(false);}
  return (
    <div style={{ padding:"16px 16px 8px" }}>
      <button onClick={()=>setShowForm(!showForm)} style={{ width:"100%", padding:"10px", background:"#ffd70015", border:"1px solid #ffd70040", borderRadius:8, color:"#ffd700", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700, marginBottom:16 }}>⭐ + 銘柄を追加</button>
      {showForm&&(
        <div style={{ background:"#09141e", border:"1px solid #0d2535", borderRadius:10, padding:14, marginBottom:16, animation:"fadeIn .2s ease" }}>
          <input value={form.ticker} onChange={e=>setForm(f=>({...f,ticker:e.target.value.toUpperCase()}))} placeholder="ティッカー (例: NVDA)" style={{ width:"100%", background:"#04090f", border:"1px solid #0d2535", borderRadius:6, padding:"8px 10px", color:"#e8f4ff", fontFamily:"inherit", fontSize:13, outline:"none", marginBottom:8 }}/>
          <textarea value={form.memo} onChange={e=>setForm(f=>({...f,memo:e.target.value}))} placeholder="メモ（任意）" style={{ width:"100%", background:"#04090f", border:"1px solid #0d2535", borderRadius:6, padding:"8px 10px", color:"#e8f4ff", fontFamily:"inherit", fontSize:12, outline:"none", resize:"none", height:60, marginBottom:8 }}/>
          <button onClick={addItem} style={{ width:"100%", padding:"8px", background:"#ffd70022", border:"1px solid #ffd70055", borderRadius:6, color:"#ffd700", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700 }}>追加する</button>
        </div>
      )}
      {items.length===0?<div style={{ textAlign:"center", padding:"48px 20px", color:"#3a5570", fontSize:13 }}>⭐ ウォッチリストに銘柄を追加してください</div>:
        items.map(item=>(
          <div key={item.id} style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:10, padding:"12px 14px", marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:(item.memo||editId===item.id)?8:0 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:900, color:"#e8f4ff" }}>{item.ticker}</div>
                <div style={{ fontSize:9, color:"#3a5570" }}>追加日: {item.added}</div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={()=>onAnalyze(item.ticker)} style={{ padding:"6px 12px", background:"#00c9ff22", border:"1px solid #00c9ff55", borderRadius:6, color:"#00c9ff", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700 }}>🔍 分析</button>
                <button onClick={()=>{setEditId(item.id);setEditMemo(item.memo||"");}} style={{ padding:"6px 10px", background:"#ffd70015", border:"1px solid #ffd70035", borderRadius:6, color:"#ffd700", cursor:"pointer", fontFamily:"inherit", fontSize:12 }}>✏</button>
                <button onClick={()=>save(items.filter(i=>i.id!==item.id))} style={{ padding:"6px 10px", background:"#ff4d6d15", border:"1px solid #ff4d6d30", borderRadius:6, color:"#ff4d6d", cursor:"pointer", fontFamily:"inherit", fontSize:12 }}>✕</button>
              </div>
            </div>
            {editId===item.id?(
              <div>
                <textarea value={editMemo} onChange={e=>setEditMemo(e.target.value)} style={{ width:"100%", background:"#04090f", border:"1px solid #0d2535", borderRadius:6, padding:"8px 10px", color:"#e8f4ff", fontFamily:"inherit", fontSize:12, outline:"none", resize:"none", height:56, marginBottom:6 }}/>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={()=>{save(items.map(i=>i.id===item.id?{...i,memo:editMemo}:i));setEditId(null);}} style={{ flex:1, padding:"6px", background:"#00e5a022", border:"1px solid #00e5a055", borderRadius:6, color:"#00e5a0", cursor:"pointer", fontFamily:"inherit", fontSize:12 }}>保存</button>
                  <button onClick={()=>setEditId(null)} style={{ padding:"6px 10px", background:"#ffffff0d", border:"1px solid #0d2030", borderRadius:6, color:"#4a7090", cursor:"pointer", fontFamily:"inherit", fontSize:12 }}>キャンセル</button>
                </div>
              </div>
            ):item.memo?<div style={{ fontSize:11, color:"#4a7090", borderTop:"1px solid #0d2030", paddingTop:8, lineHeight:1.5 }}>📝 {item.memo}</div>:null}
          </div>
        ))
      }
    </div>
  );
}

// ── Tab 6: Technical ──────────────────────────────────────────
function TechnicalTab() {
  const [ticker, setTicker] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState(0);
  const [realData, setRealData] = useState(null);
  const phases = [
    "📡 リアルタイムデータ取得中...",
    "📊 インジケーター解析中...",
    "🤖 AI分析中...",
    "✅ レポート生成中...",
  ];

  async function fetchTwelveData(symbol) {
    const KEY = import.meta.env.VITE_TWELVE_DATA_KEY;
    const B = "https://api.twelvedata.com";
    const [priceR, rsiR, macdR, sma50R, sma200R, bbandsR] = await Promise.allSettled([
      fetch(`${B}/price?symbol=${symbol}&apikey=${KEY}`).then(r => r.json()),
      fetch(`${B}/rsi?symbol=${symbol}&interval=1day&apikey=${KEY}`).then(r => r.json()),
      fetch(`${B}/macd?symbol=${symbol}&interval=1day&apikey=${KEY}`).then(r => r.json()),
      fetch(`${B}/sma?symbol=${symbol}&interval=1day&time_period=50&apikey=${KEY}`).then(r => r.json()),
      fetch(`${B}/sma?symbol=${symbol}&interval=1day&time_period=200&apikey=${KEY}`).then(r => r.json()),
      fetch(`${B}/bbands?symbol=${symbol}&interval=1day&apikey=${KEY}`).then(r => r.json()),
    ]);
    const ok = r => r.status === "fulfilled" && r.value?.status !== "error";
    const price   = ok(priceR)   ? priceR.value.price                        : null;
    const rsi     = ok(rsiR)     && rsiR.value.values?.[0]   ? parseFloat(rsiR.value.values[0].rsi).toFixed(1)   : null;
    const macd    = ok(macdR)    && macdR.value.values?.[0]  ? macdR.value.values[0]                             : null;
    const sma50   = ok(sma50R)   && sma50R.value.values?.[0] ? parseFloat(sma50R.value.values[0].sma).toFixed(2) : null;
    const sma200  = ok(sma200R)  && sma200R.value.values?.[0]? parseFloat(sma200R.value.values[0].sma).toFixed(2): null;
    const bbands  = ok(bbandsR)  && bbandsR.value.values?.[0]? bbandsR.value.values[0]                          : null;
    const fetched = [price, rsi, macd, sma50, sma200, bbands].filter(Boolean).length;
    return { price, rsi, macd, sma50, sma200, bbands, fetched, total: 6 };
  }

  async function analyze() {
    const t = ticker.trim().toUpperCase(); if (!t) return;
    setLoading(true); setResult(null); setError(null); setRealData(null);

    // Step 1: Twelve Data からリアルタイムデータ取得
    setPhase(0);
    let td = { price:null, rsi:null, macd:null, sma50:null, sma200:null, bbands:null, fetched:0, total:6 };
    try { td = await fetchTwelveData(t); setRealData(td); }
    catch (_) { /* フォールバック: AI推定 */ }

    // Step 2: インジケーター解析フェーズ表示
    setPhase(1);

    // 実データをプロンプトに組み込む
    const lines = [];
    if (td.price)  lines.push(`・現在価格: $${parseFloat(td.price).toFixed(2)}`);
    if (td.rsi)    lines.push(`・RSI(14日): ${td.rsi}`);
    if (td.macd)   lines.push(`・MACD: ${parseFloat(td.macd.macd).toFixed(4)}, Signal: ${parseFloat(td.macd.macd_signal).toFixed(4)}, Hist: ${parseFloat(td.macd.macd_hist).toFixed(4)}`);
    if (td.sma50)  lines.push(`・SMA50: $${td.sma50}`);
    if (td.sma200) lines.push(`・SMA200: $${td.sma200}`);
    if (td.bbands) lines.push(`・ボリンジャーバンド: 上限=$${parseFloat(td.bbands.upper_band).toFixed(2)}, 中心=$${parseFloat(td.bbands.middle_band).toFixed(2)}, 下限=$${parseFloat(td.bbands.lower_band).toFixed(2)}`);
    const dataSection = lines.length > 0
      ? `\n【実際の市場データ（Twelve Data API取得）】\n${lines.join("\n")}\n上記の実データを必ず優先して使用し、rsi.valueには${td.rsi}を設定してください。`
      : "\n（注: APIデータ取得失敗のため、知識ベースで推定分析してください）";

    // Step 3: Claude API で解釈・分析
    setPhase(2);
    try {
      const d = await callAPI(TECHNICAL_PROMPT, `${t}のテクニカル分析をしてください。${dataSection}\nJSONのみ返してください。`);
      setPhase(3);
      setResult(d);
    } catch (e) { setError(e.message); }

    setLoading(false);
  }

  const sigC = {"過熱":"#ff4d6d","中立":"#ffd700","底値":"#00e5a0","買い":"#00e5a0","売り":"#ff4d6d","ゴールデン":"#00e5a0","デッド":"#ff4d6d","なし":"#4a7090"};

  function DataBadge() {
    if (!realData) return null;
    const { fetched, total } = realData;
    const [color, text] = fetched === total
      ? ["#00e5a0", "📡 リアルタイムデータ取得済み"]
      : fetched > 0
      ? ["#ffd700", `📡 一部データ取得済み (${fetched}/${total})`]
      : ["#ff4d6d", "⚠ データ取得失敗（AI推定値）"];
    return (
      <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 10px", background:`${color}15`, border:`1px solid ${color}40`, borderRadius:12, marginBottom:12 }}>
        <span style={{ width:6, height:6, borderRadius:"50%", background:color, display:"inline-block", animation:"pulse 1.5s infinite" }}/>
        <span style={{ fontSize:10, color, fontWeight:700 }}>{text}</span>
      </div>
    );
  }

  return (
    <div style={{ padding:"16px 16px 8px" }}>
      <InputRow value={ticker} onChange={setTicker} onEnter={analyze} placeholder="ティッカー例: NVDA, AAPL" loading={loading} btnLabel="分析する" btnColor="#a78bfa"/>
      {loading && <LoadingDots color="#a78bfa" phases={phases} phase={phase}/>}
      {error && <ErrBox msg={error}/>}
      {result && !loading && (
        <div style={{ animation:"fadeIn .3s ease" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <div style={{ fontSize:18, fontWeight:900, color:"#e8f4ff" }}>{result.ticker} テクニカル分析</div>
          </div>
          <DataBadge/>
          {/* リアルタイム生データ表示 */}
          {realData && realData.fetched > 0 && (
            <div style={{ background:"#04090f", border:"1px solid #a78bfa30", borderRadius:8, padding:"10px 12px", marginBottom:12 }}>
              <div style={{ fontSize:9, color:"#a78bfa", letterSpacing:2, marginBottom:8 }}>📡 取得済みリアルタイムデータ</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                {realData.price  && <div><span style={{ fontSize:9, color:"#4a7090" }}>現在価格: </span><span style={{ fontSize:12, color:"#e8f4ff", fontWeight:700 }}>${parseFloat(realData.price).toFixed(2)}</span></div>}
                {realData.rsi    && <div><span style={{ fontSize:9, color:"#4a7090" }}>RSI(14): </span><span style={{ fontSize:12, color:"#ffd700", fontWeight:700 }}>{realData.rsi}</span></div>}
                {realData.sma50  && <div><span style={{ fontSize:9, color:"#4a7090" }}>SMA50: </span><span style={{ fontSize:12, color:"#00c9ff", fontWeight:700 }}>${realData.sma50}</span></div>}
                {realData.sma200 && <div><span style={{ fontSize:9, color:"#4a7090" }}>SMA200: </span><span style={{ fontSize:12, color:"#00c9ff", fontWeight:700 }}>${realData.sma200}</span></div>}
                {realData.macd && (
                  <div style={{ gridColumn:"span 2" }}>
                    <span style={{ fontSize:9, color:"#4a7090" }}>MACD: </span>
                    <span style={{ fontSize:11, color:"#ff6b35", fontWeight:700 }}>{parseFloat(realData.macd.macd).toFixed(3)}</span>
                    <span style={{ fontSize:9, color:"#4a7090" }}> Sig: </span>
                    <span style={{ fontSize:11, color:"#ff6b35", fontWeight:700 }}>{parseFloat(realData.macd.macd_signal).toFixed(3)}</span>
                    <span style={{ fontSize:9, color:"#4a7090" }}> Hist: </span>
                    <span style={{ fontSize:11, color:parseFloat(realData.macd.macd_hist)>=0?"#00e5a0":"#ff4d6d", fontWeight:700 }}>{parseFloat(realData.macd.macd_hist).toFixed(3)}</span>
                  </div>
                )}
                {realData.bbands && (
                  <div style={{ gridColumn:"span 2" }}>
                    <span style={{ fontSize:9, color:"#4a7090" }}>BB上: </span>
                    <span style={{ fontSize:11, color:"#ff4d6d", fontWeight:700 }}>${parseFloat(realData.bbands.upper_band).toFixed(2)}</span>
                    <span style={{ fontSize:9, color:"#4a7090" }}> 中: </span>
                    <span style={{ fontSize:11, color:"#ffd700", fontWeight:700 }}>${parseFloat(realData.bbands.middle_band).toFixed(2)}</span>
                    <span style={{ fontSize:9, color:"#4a7090" }}> 下: </span>
                    <span style={{ fontSize:11, color:"#00e5a0", fontWeight:700 }}>${parseFloat(realData.bbands.lower_band).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Score */}
          <div style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:10, padding:"14px 16px", marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ fontSize:11, color:"#4a7090" }}>総合テクニカルスコア</span><InfoBtn id="tech_score"/></div>
              <span style={{ fontSize:22, fontWeight:900, color:result.tech_score>=70?"#00e5a0":result.tech_score>=40?"#ffd700":"#ff4d6d" }}>{result.tech_score}<span style={{ fontSize:11 }}>/100</span></span>
            </div>
            <ScoreBar value={result.tech_score} color={result.tech_score>=70?"#00e5a0":result.tech_score>=40?"#ffd700":"#ff4d6d"}/>
          </div>
          {/* RSI */}
          <div style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:10, padding:"12px 14px", marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ fontSize:11, color:"#4a7090" }}>RSI (14日)</span><InfoBtn id="rsi"/></div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:18, fontWeight:900, color:sigC[result.rsi?.signal]||"#ffd700" }}>{result.rsi?.value}</span>
                <span style={{ fontSize:10, padding:"2px 8px", background:`${sigC[result.rsi?.signal]||"#ffd700"}22`, color:sigC[result.rsi?.signal]||"#ffd700", borderRadius:8 }}>{result.rsi?.signal}</span>
              </div>
            </div>
            <div style={{ position:"relative", height:8, background:"linear-gradient(90deg,#00e5a0 0%,#ffd700 30%,#ffd700 70%,#ff4d6d 100%)", borderRadius:4, marginBottom:6 }}>
              <div style={{ position:"absolute", top:-2, left:`${Math.min(99,Math.max(1,result.rsi?.value||50))}%`, width:12, height:12, borderRadius:"50%", background:"#fff", border:"2px solid #060e17", transform:"translateX(-50%)" }}/>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#4a7090", marginBottom:6 }}><span>0 底値</span><span>30</span><span>70</span><span>100 過熱</span></div>
            <div style={{ fontSize:11, color:"#6090a8", lineHeight:1.5 }}>{result.rsi?.comment}</div>
          </div>
          {/* MACD + MA Cross */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            {[{label:"MACD",infoId:"macd",signal:result.macd?.signal,comment:result.macd?.comment},{label:"移動平均クロス",infoId:"ma_cross",signal:result.ma_cross?.status,comment:result.ma_cross?.comment}].map(({label,infoId,signal,comment})=>(
              <div key={label} style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:10, padding:"12px 14px" }}>
                <div style={{ fontSize:9, color:"#4a7090", letterSpacing:2, marginBottom:8, display:"flex", alignItems:"center", gap:4 }}>{label}<InfoBtn id={infoId}/></div>
                <div style={{ fontSize:14, fontWeight:900, color:sigC[signal]||"#ffd700", marginBottom:6 }}>{signal}</div>
                <div style={{ fontSize:10, color:"#507090", lineHeight:1.5 }}>{comment}</div>
              </div>
            ))}
          </div>
          {/* Bollinger */}
          <div style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:10, padding:"12px 14px", marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ fontSize:9, color:"#4a7090", letterSpacing:2 }}>ボリンジャーバンド</span><InfoBtn id="bollinger"/></div>
              <span style={{ fontSize:10, padding:"2px 8px", background:"#00c9ff22", color:"#00c9ff", borderRadius:8 }}>{result.bollinger?.position}</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
              {[["上限",result.bollinger?.upper,"#ff4d6d"],["中心",result.bollinger?.middle,"#ffd700"],["下限",result.bollinger?.lower,"#00e5a0"]].map(([lbl,val,c])=>(
                <div key={lbl} style={{ textAlign:"center", background:`${c}0d`, border:`1px solid ${c}20`, borderRadius:6, padding:"8px 6px" }}>
                  <div style={{ fontSize:9, color:c, marginBottom:4 }}>{lbl}</div>
                  <div style={{ fontSize:12, color:"#e8f4ff", fontWeight:700 }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Pattern + Buy timing */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <div style={{ background:"#a78bfa10", border:"1px solid #a78bfa25", borderRadius:10, padding:"12px 14px" }}>
              <div style={{ fontSize:9, color:"#a78bfa", letterSpacing:2, marginBottom:6 }}>📐 チャートパターン</div>
              <div style={{ fontSize:13, color:"#c0a0f0", fontWeight:700, marginBottom:6 }}>{result.pattern?.name}</div>
              <div style={{ fontSize:10, color:"#7060a0", lineHeight:1.5 }}>{result.pattern?.description}</div>
            </div>
            <div style={{ background:"#00e5a010", border:"1px solid #00e5a025", borderRadius:10, padding:"12px 14px" }}>
              <div style={{ fontSize:9, color:"#00e5a0", letterSpacing:2, marginBottom:6 }}>⏰ 買いタイミング</div>
              <div style={{ fontSize:11, color:"#70a090", lineHeight:1.6 }}>{result.buy_timing}</div>
            </div>
          </div>
          <div style={{ background:"#060e17", border:"1px solid #0d2030", borderRadius:8, padding:"10px 12px" }}>
            <div style={{ fontSize:9, color:"#a78bfa", letterSpacing:2, marginBottom:4 }}>▶ 総合テクニカルコメント</div>
            <div style={{ fontSize:12, color:"#8ab0c8", lineHeight:1.7 }}>{result.overall_comment}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 7: Fundamental ────────────────────────────────────────
function FundamentalTab() {
  const [ticker, setTicker] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState(0);
  const phaseRef = useRef(null);
  const phases = ["📊 財務データを取得中...","💰 バリュエーション分析中...","🔍 競合比較中...","✅ レポート生成中..."];
  async function analyze(){
    const t=ticker.trim().toUpperCase();if(!t)return;
    setLoading(true);setResult(null);setError(null);setPhase(0);
    phaseRef.current=setInterval(()=>setPhase(i=>(i+1)%phases.length),800);
    try{const d=await callAPI(FUNDAMENTAL_PROMPT,`${t}のファンダメンタル分析をしてください。JSONのみ返してください。`);setResult(d);}
    catch(e){setError(e.message);}
    finally{clearInterval(phaseRef.current);setLoading(false);}
  }
  const vc={"割安":"#00e5a0","適正":"#ffd700","割高":"#ff4d6d","優秀":"#00e5a0","良好":"#60d0a0","普通":"#ffd700","要改善":"#ff4d6d"};
  return (
    <div style={{ padding:"16px 16px 8px" }}>
      <InputRow value={ticker} onChange={setTicker} onEnter={analyze} placeholder="ティッカー例: NVDA, AAPL" loading={loading} btnLabel="分析する" btnColor="#ffd700"/>
      {loading&&<LoadingDots color="#ffd700" phases={phases} phase={phase}/>}
      {error&&<ErrBox msg={error}/>}
      {result&&!loading&&(
        <div style={{ animation:"fadeIn .3s ease" }}>
          <div style={{ textAlign:"center", fontSize:18, fontWeight:900, color:"#e8f4ff", marginBottom:16 }}>{result.ticker} ファンダメンタル分析</div>
          {/* PER/PBR/ROE */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
            {[{label:"PER",infoId:"per",v:result.per?.value+"x",sig:result.per?.signal},{label:"PBR",infoId:"pbr",v:result.pbr?.value+"x",sig:result.pbr?.signal},{label:"ROE",infoId:"roe",v:result.roe?.value+"%",sig:result.roe?.signal}].map(({label,infoId,v,sig})=>(
              <div key={label} style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
                <div style={{ fontSize:9, color:"#4a7090", marginBottom:4, display:"flex", alignItems:"center", justifyContent:"center", gap:3 }}>{label}<InfoBtn id={infoId}/></div>
                <div style={{ fontSize:16, fontWeight:900, color:"#e8f4ff", marginBottom:4 }}>{v}</div>
                <div style={{ fontSize:10, padding:"2px 6px", background:`${vc[sig]||"#ffd700"}22`, color:vc[sig]||"#ffd700", borderRadius:6, display:"inline-block" }}>{sig}</div>
              </div>
            ))}
          </div>
          {/* Growth */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
            {[["売上成長率",result.revenue_growth],["利益成長率",result.profit_growth]].map(([lbl,val])=>(
              <div key={lbl} style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:8, padding:"10px 12px", textAlign:"center" }}>
                <div style={{ fontSize:9, color:"#4a7090", marginBottom:4 }}>{lbl}</div>
                <div style={{ fontSize:20, fontWeight:900, color:String(val||"").startsWith("+")?"#00e5a0":String(val||"").startsWith("-")?"#ff4d6d":"#e8f4ff" }}>{val}</div>
              </div>
            ))}
          </div>
          {/* DCF */}
          <div style={{ background:"#a78bfa10", border:"1px solid #a78bfa25", borderRadius:8, padding:"10px 12px", marginBottom:10, textAlign:"center" }}>
            <div style={{ fontSize:9, color:"#a78bfa", letterSpacing:2, marginBottom:6, display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>DCF 適正株価レンジ<InfoBtn id="dcf"/></div>
            <div style={{ fontSize:20, fontWeight:900, color:"#c0a0f0" }}>{result.dcf_fair_value}</div>
          </div>
          {/* Score */}
          <div style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:10, padding:"14px 16px", marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ fontSize:11, color:"#4a7090" }}>総合ファンダスコア</span><InfoBtn id="fundamental_score"/></div>
              <span style={{ fontSize:22, fontWeight:900, color:result.fundamental_score>=70?"#00e5a0":result.fundamental_score>=40?"#ffd700":"#ff4d6d" }}>{result.fundamental_score}<span style={{ fontSize:11 }}>/100</span></span>
            </div>
            <ScoreBar value={result.fundamental_score} color={result.fundamental_score>=70?"#00e5a0":result.fundamental_score>=40?"#ffd700":"#ff4d6d"}/>
          </div>
          {/* Competitors table */}
          <div style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:10, padding:"12px 14px", marginBottom:10 }}>
            <div style={{ fontSize:9, color:"#4a7090", letterSpacing:2, marginBottom:10 }}>⚖ 競合比較</div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead>
                  <tr>{["銘柄","PER","PBR","ROE","成長率","判定"].map(h=><th key={h} style={{ textAlign:"center", color:"#3a5570", fontSize:9, paddingBottom:8, borderBottom:"1px solid #0d2030", paddingRight:4 }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding:"6px 4px", textAlign:"center", color:"#00c9ff", fontWeight:900 }}>{result.ticker}</td>
                    <td style={{ textAlign:"center", color:"#e8f4ff" }}>{result.per?.value}</td>
                    <td style={{ textAlign:"center", color:"#e8f4ff" }}>{result.pbr?.value}</td>
                    <td style={{ textAlign:"center", color:"#e8f4ff" }}>{result.roe?.value}%</td>
                    <td style={{ textAlign:"center", color:"#7090a8" }}>—</td>
                    <td style={{ textAlign:"center" }}><span style={{ fontSize:9, padding:"2px 6px", background:"#00c9ff22", color:"#00c9ff", borderRadius:4 }}>対象</span></td>
                  </tr>
                  {(result.competitors||[]).map((c,i)=>{
                    const cv=vc[c.verdict]||"#ffd700";
                    const gc=String(c.growth||"").startsWith("+")??"#e8f4ff";
                    return (
                      <tr key={i} style={{ borderTop:"1px solid #0d1a25" }}>
                        <td style={{ padding:"6px 4px", textAlign:"center", color:"#e8f4ff", fontWeight:700 }}>{c.ticker}</td>
                        <td style={{ textAlign:"center", color:"#7090a8" }}>{c.per}</td>
                        <td style={{ textAlign:"center", color:"#7090a8" }}>{c.pbr}</td>
                        <td style={{ textAlign:"center", color:"#7090a8" }}>{c.roe}%</td>
                        <td style={{ textAlign:"center", color:String(c.growth||"").startsWith("+")??"#7090a8" }}>{c.growth}</td>
                        <td style={{ textAlign:"center" }}><span style={{ fontSize:9, padding:"2px 6px", background:`${cv}22`, color:cv, borderRadius:4 }}>{c.verdict}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ background:"#060e17", border:"1px solid #0d2030", borderRadius:8, padding:"10px 12px" }}>
            <div style={{ fontSize:9, color:"#ffd700", letterSpacing:2, marginBottom:4 }}>▶ 総合ファンダサマリー</div>
            <div style={{ fontSize:12, color:"#8ab0c8", lineHeight:1.7 }}>{result.summary}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 8: Strategy ───────────────────────────────────────────
function StrategyTab() {
  const [dcaForm, setDcaForm] = useState({ticker:"",monthly:30000,years:10,rate:7});
  const [dcaResult, setDcaResult] = useState(null);
  const [dcaAI, setDcaAI] = useState(null);
  const [dcaAILoading, setDcaAILoading] = useState(false);
  const [riskResult, setRiskResult] = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState(null);
  const [riskPhase, setRiskPhase] = useState(0);
  const riskRef = useRef(null);
  const [scenResult, setScenResult] = useState(null);
  const [scenLoading, setScenLoading] = useState(false);
  const [scenError, setScenError] = useState(null);
  const [scenPhase, setScenPhase] = useState(0);
  const scenRef = useRef(null);
  const phases3 = ["📊 ポートフォリオを読み込み中...","🤖 AI分析中...","✅ レポート生成中..."];

  function getHoldings(){try{return JSON.parse(localStorage.getItem("portfolio_holdings")||"[]");}catch{return[];}}

  function calcDCA(){
    const {monthly,years,rate}=dcaForm;
    const r=rate/100/12; const n=years*12;
    const fv=r===0?monthly*n:monthly*((Math.pow(1+r,n)-1)/r);
    const invested=monthly*n;
    const yearData=Array.from({length:years},(_,i)=>{const m=(i+1)*12;const v=r===0?monthly*m:monthly*((Math.pow(1+r,m)-1)/r);return{year:i+1,value:v,invested:monthly*m};});
    setDcaResult({fv,invested,profit:fv-invested,yearData}); setDcaAI(null);
  }

  async function getDcaAI(){
    const t=(dcaForm.ticker||"この銘柄").toUpperCase();
    setDcaAILoading(true);
    try{const d=await callAPI(DCA_PROMPT,`${t}に毎月${(dcaForm.monthly/10000).toFixed(1)}万円を${dcaForm.years}年間、年率${dcaForm.rate}%を想定して積み立てた場合のAI評価をJSONのみで返してください。`);setDcaAI(d);}
    catch(e){setDcaAI({ai_comment:"AI評価の取得に失敗しました: "+e.message,risk_level:"-",recommendation:"-",key_risk:"-"});}
    finally{setDcaAILoading(false);}
  }

  async function runRiskCheck(){
    const holdings=getHoldings();
    if(!holdings.length){setRiskError("ポートフォリオタブに銘柄を追加してください");return;}
    setRiskLoading(true);setRiskResult(null);setRiskError(null);setRiskPhase(0);
    riskRef.current=setInterval(()=>setRiskPhase(i=>(i+1)%phases3.length),900);
    const summary=holdings.map(h=>`${h.ticker}:$${h.purchase_price}×${h.shares}株`).join(",");
    try{const d=await callAPI(RISK_PROMPT,`以下のポートフォリオのリスク分散を分析してください: ${summary}。JSONのみ返してください。`);setRiskResult(d);}
    catch(e){setRiskError(e.message);}
    finally{clearInterval(riskRef.current);setRiskLoading(false);}
  }

  async function runScenario(){
    const holdings=getHoldings();
    if(!holdings.length){setScenError("ポートフォリオタブに銘柄を追加してください");return;}
    setScenLoading(true);setScenResult(null);setScenError(null);setScenPhase(0);
    scenRef.current=setInterval(()=>setScenPhase(i=>(i+1)%phases3.length),900);
    const summary=holdings.map(h=>`${h.ticker}:取得価格$${h.purchase_price}×${h.shares}株`).join(",");
    try{const d=await callAPI(SCENARIO_PROMPT,`以下のポートフォリオに対してシナリオ分析してください（現在価格は市場推計を使用）: ${summary}。JSONのみ返してください。`);setScenResult(d);}
    catch(e){setScenError(e.message);}
    finally{clearInterval(scenRef.current);setScenLoading(false);}
  }

  const maxBarVal=dcaResult?dcaResult.yearData[dcaResult.yearData.length-1].value:1;
  const recC={"推奨":"#00e5a0","中立":"#ffd700","非推奨":"#ff4d6d"};
  const rlC={"低":"#00e5a0","中":"#ffd700","高":"#ff4d6d"};
  const scenColor=s=>{const r=String(s.estimated_return||""); return r.startsWith("+")?{border:"#00e5a025",bg:"#00e5a00a",c:"#00e5a0"}:r.startsWith("-")?{border:"#ff4d6d25",bg:"#ff4d6d0a",c:"#ff4d6d"}:{border:"#ffd70025",bg:"#ffd7000a",c:"#ffd700"};};

  return (
    <div style={{ padding:"16px 16px 8px" }}>
      {/* Tool 1: DCA */}
      <div style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#00c9ff", marginBottom:12, display:"flex", alignItems:"center", gap:6 }}>💰 ドルコスト平均法シミュレーター<InfoBtn id="dca"/></div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
          {[["ticker","銘柄ティッカー (任意)"],["monthly","月額投資額 (円)"],["years","投資期間 (年)"],["rate","想定年率リターン (%)"]].map(([key,ph])=>(
            <div key={key}>
              <div style={{ fontSize:9, color:"#4a7090", marginBottom:3 }}>{ph}</div>
              <input type={key==="ticker"?"text":"number"} value={dcaForm[key]} onChange={e=>setDcaForm(f=>({...f,[key]:key==="ticker"?e.target.value.toUpperCase():+e.target.value}))}
                style={{ width:"100%", background:"#04090f", border:"1px solid #0d2535", borderRadius:6, padding:"8px 10px", color:"#e8f4ff", fontFamily:"inherit", fontSize:12, outline:"none" }}/>
            </div>
          ))}
        </div>
        <button onClick={calcDCA} style={{ width:"100%", padding:"10px", background:"#00c9ff22", border:"1px solid #00c9ff55", borderRadius:8, color:"#00c9ff", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700, marginBottom:12 }}>📊 計算する</button>
        {dcaResult&&(
          <div style={{ animation:"fadeIn .3s ease" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
              {[{label:"投資総額",val:`¥${Math.round(dcaResult.invested).toLocaleString()}`,c:"#4a7090"},{label:"推定最終資産",val:`¥${Math.round(dcaResult.fv).toLocaleString()}`,c:"#00c9ff"},{label:"推定利益",val:`¥${Math.round(dcaResult.profit).toLocaleString()}`,c:"#00e5a0"}].map(({label,val,c})=>(
                <div key={label} style={{ textAlign:"center", background:"#04090f", borderRadius:8, padding:"8px 6px" }}>
                  <div style={{ fontSize:9, color:"#4a7090", marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:12, fontWeight:900, color:c }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:4, display:"flex", justifyContent:"space-between", fontSize:10, color:"#4a7090" }}>
              <span>年別資産推移</span>
              <span style={{ color:"#00e5a0", fontWeight:700 }}>利益率 +{((dcaResult.profit/dcaResult.invested)*100).toFixed(1)}%</span>
            </div>
            <div style={{ display:"flex", alignItems:"flex-end", gap:2, height:80 }}>
              {dcaResult.yearData.map((y,i)=>{
                const tH=(y.value/maxBarVal)*72; const iH=(y.invested/maxBarVal)*72; const pH=Math.max(0,tH-iH);
                return (
                  <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"flex-end", height:72 }}>
                    {pH>0&&<div style={{ background:"#00e5a0", height:`${pH}px`, borderRadius:"2px 2px 0 0" }}/>}
                    <div style={{ background:"#00c9ff55", height:`${iH}px` }}/>
                  </div>
                );
              })}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#4a7090", marginTop:3, marginBottom:8 }}>
              <span>1年</span><span>{Math.round(dcaForm.years/2)}年</span><span>{dcaForm.years}年</span>
            </div>
            <div style={{ display:"flex", gap:12, fontSize:9, color:"#4a7090", marginBottom:12 }}>
              <span><span style={{ display:"inline-block", width:10, height:10, background:"#00c9ff55", marginRight:4, verticalAlign:"middle" }}></span>投資額</span>
              <span><span style={{ display:"inline-block", width:10, height:10, background:"#00e5a0", marginRight:4, verticalAlign:"middle" }}></span>運用益</span>
            </div>
            {!dcaAI&&<button onClick={getDcaAI} disabled={dcaAILoading} style={{ width:"100%", padding:"8px", background:"#a78bfa15", border:"1px solid #a78bfa40", borderRadius:6, color:dcaAILoading?"#4a7090":"#a78bfa", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700 }}>{dcaAILoading?"AI評価を取得中...":"🤖 AI評価を取得"}</button>}
            {dcaAI&&(
              <div style={{ background:"#06111a", border:"1px solid #0d2535", borderRadius:8, padding:"10px 12px" }}>
                <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                  <span style={{ fontSize:10, padding:"2px 8px", background:`${recC[dcaAI.recommendation]||"#ffd700"}22`, color:recC[dcaAI.recommendation]||"#ffd700", borderRadius:6 }}>{dcaAI.recommendation}</span>
                  <span style={{ fontSize:10, padding:"2px 8px", background:`${rlC[dcaAI.risk_level]||"#ffd700"}22`, color:rlC[dcaAI.risk_level]||"#ffd700", borderRadius:6 }}>リスク:{dcaAI.risk_level}</span>
                </div>
                <div style={{ fontSize:11, color:"#8ab0c8", lineHeight:1.7, marginBottom:6 }}>{dcaAI.ai_comment}</div>
                <div style={{ fontSize:10, color:"#b0a060" }}>⚠ {dcaAI.key_risk}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tool 2: Risk Checker */}
      <div style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#ff6b35", marginBottom:12 }}>⚖ リスク分散チェッカー</div>
        <div style={{ fontSize:11, color:"#4a7090", marginBottom:12 }}>ポートフォリオタブの保有銘柄を自動読み込みして分析します</div>
        <button onClick={runRiskCheck} disabled={riskLoading} style={{ width:"100%", padding:"10px", background:riskLoading?"#0d2535":"#ff6b3522", border:`1px solid ${riskLoading?"#0d2535":"#ff6b3555"}`, borderRadius:8, color:riskLoading?"#4a7090":"#ff6b35", cursor:riskLoading?"not-allowed":"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700, marginBottom:12 }}>{riskLoading?"分析中...":"🔍 分散チェックを実行"}</button>
        {riskLoading&&<LoadingDots color="#ff6b35" phases={phases3} phase={riskPhase}/>}
        {riskError&&<ErrBox msg={riskError} onRetry={runRiskCheck}/>}
        {riskResult&&!riskLoading&&(
          <div style={{ animation:"fadeIn .3s ease" }}>
            <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:12 }}>
              <div style={{ width:80, height:80, borderRadius:"50%", background:buildPieGradient(riskResult.sectors||[{name:"未分類",percentage:100}]), flexShrink:0, position:"relative" }}>
                <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:40, height:40, borderRadius:"50%", background:"#09141e" }}/>
              </div>
              <div style={{ flex:1 }}>
                {(riskResult.sectors||[]).map((s,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                    <div style={{ width:10, height:10, borderRadius:2, background:PIE_COLORS[i%PIE_COLORS.length], flexShrink:0 }}/>
                    <span style={{ fontSize:11, color:"#e8f4ff", flex:1 }}>{s.name}</span>
                    <span style={{ fontSize:11, color:"#4a7090" }}>{s.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background:"#04090f", border:"1px solid #0d2030", borderRadius:8, padding:"10px 12px", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ fontSize:11, color:"#4a7090" }}>分散スコア</span><InfoBtn id="diversification_score"/></div>
                <span style={{ fontSize:20, fontWeight:900, color:riskResult.diversification_score>=70?"#00e5a0":riskResult.diversification_score>=40?"#ffd700":"#ff4d6d" }}>{riskResult.diversification_score}/100</span>
              </div>
              <ScoreBar value={riskResult.diversification_score} color={riskResult.diversification_score>=70?"#00e5a0":riskResult.diversification_score>=40?"#ffd700":"#ff4d6d"}/>
            </div>
            {(riskResult.concentration_risks||[]).length>0&&(
              <div style={{ background:"#ff4d6d10", border:"1px solid #ff4d6d25", borderRadius:8, padding:"10px 12px", marginBottom:8 }}>
                <div style={{ fontSize:9, color:"#ff4d6d", letterSpacing:2, marginBottom:6 }}>⚠ 集中リスク警告</div>
                {riskResult.concentration_risks.map((r,i)=><div key={i} style={{ fontSize:11, color:"#906070", lineHeight:1.6 }}>▸ {r}</div>)}
              </div>
            )}
            {(riskResult.correlations||[]).length>0&&(
              <div style={{ background:"#ffd70010", border:"1px solid #ffd70025", borderRadius:8, padding:"10px 12px", marginBottom:8 }}>
                <div style={{ fontSize:9, color:"#ffd700", letterSpacing:2, marginBottom:6 }}>🔗 相関分析</div>
                {riskResult.correlations.map((c,i)=>(
                  <div key={i} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                    <span style={{ fontSize:11, color:"#e8f4ff", fontWeight:700 }}>{c.pair}</span>
                    <span style={{ fontSize:10, padding:"1px 6px", background:"#ffd70022", color:"#ffd700", borderRadius:4 }}>相関:{c.level}</span>
                    <span style={{ fontSize:10, color:"#b0a060" }}>{c.comment}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ background:"#00e5a010", border:"1px solid #00e5a025", borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:9, color:"#00e5a0", letterSpacing:2, marginBottom:6 }}>💡 AI改善提案</div>
              {(riskResult.suggestions||[]).map((s,i)=><div key={i} style={{ fontSize:11, color:"#70a090", lineHeight:1.6 }}>▸ {s}</div>)}
            </div>
          </div>
        )}
      </div>

      {/* Tool 3: Scenario */}
      <div style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:12, padding:"14px 16px", marginBottom:8 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#a78bfa", marginBottom:12 }}>🧪 シナリオ分析</div>
        <div style={{ fontSize:11, color:"#4a7090", marginBottom:12 }}>4つのシナリオでポートフォリオへの影響を推計します</div>
        <button onClick={runScenario} disabled={scenLoading} style={{ width:"100%", padding:"10px", background:scenLoading?"#0d2535":"#a78bfa22", border:`1px solid ${scenLoading?"#0d2535":"#a78bfa55"}`, borderRadius:8, color:scenLoading?"#4a7090":"#a78bfa", cursor:scenLoading?"not-allowed":"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700, marginBottom:12 }}>{scenLoading?"分析中...":"🚀 シナリオ分析を実行"}</button>
        {scenLoading&&<LoadingDots color="#a78bfa" phases={phases3} phase={scenPhase}/>}
        {scenError&&<ErrBox msg={scenError} onRetry={runScenario}/>}
        {scenResult&&!scenLoading&&(
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, animation:"fadeIn .3s ease" }}>
            {(scenResult.scenarios||[]).map((s,i)=>{
              const sc=scenColor(s);
              return (
                <div key={i} style={{ background:sc.bg, border:`1px solid ${sc.border}`, borderRadius:10, padding:"12px 14px" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#e8f4ff", marginBottom:4 }}>{s.name}</div>
                  <div style={{ fontSize:9, color:"#4a7090", marginBottom:8 }}>{s.condition}</div>
                  <div style={{ fontSize:20, fontWeight:900, color:sc.c, marginBottom:4 }}>{s.estimated_return}</div>
                  <div style={{ fontSize:12, color:sc.c, fontWeight:700, marginBottom:8 }}>{s.estimated_pnl}</div>
                  <div style={{ fontSize:10, color:"#507090", lineHeight:1.5 }}>{s.comment}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab 9 Sub-Panels ──────────────────────────────────────────
function NewsSentimentPanel() {
  const [ticker, setTicker] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState(0);
  const phaseRef = useRef(null);
  const phases = ["📰 ニュースを収集中...","🤖 感情分析中...","📊 センチメント計算中...","✅ レポート生成中..."];
  async function analyze() {
    const t = ticker.trim().toUpperCase(); if (!t) return;
    setLoading(true); setResult(null); setError(null); setPhase(0);
    phaseRef.current = setInterval(() => setPhase(i => (i+1) % phases.length), 800);
    try { const d = await callAPI(NEWS_SENTIMENT_PROMPT, `${t}の最新ニュースを分析してください。JSONのみ返してください。`); setResult(d); }
    catch (e) { setError(e.message); }
    finally { clearInterval(phaseRef.current); setLoading(false); }
  }
  const verdictC = {"強気":"#00e5a0","中立":"#ffd700","弱気":"#ff4d6d"};
  return (
    <div>
      <InputRow value={ticker} onChange={setTicker} onEnter={analyze} placeholder="ティッカー例: NVDA, AAPL" loading={loading} btnLabel="分析する" btnColor="#00c9ff"/>
      {loading && <LoadingDots color="#00c9ff" phases={phases} phase={phase}/>}
      {error && <ErrBox msg={error}/>}
      {result && !loading && (
        <div style={{ animation:"fadeIn .3s ease" }}>
          <div style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ fontSize:11, color:"#4a7090" }}>総合センチメントスコア</span><InfoBtn id="sentiment_score"/></div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:22, fontWeight:900, color:verdictC[result.verdict]||"#ffd700" }}>{result.overall_score>0?"+":""}{result.overall_score}</span>
                <span style={{ fontSize:11, padding:"3px 10px", background:`${verdictC[result.verdict]||"#ffd700"}22`, color:verdictC[result.verdict]||"#ffd700", borderRadius:8, border:`1px solid ${verdictC[result.verdict]||"#ffd700"}44` }}>{result.verdict}</span>
              </div>
            </div>
            <div style={{ position:"relative", height:10, background:"linear-gradient(90deg,#ff4d6d 0%,#ffd700 50%,#00e5a0 100%)", borderRadius:5, marginBottom:6 }}>
              <div style={{ position:"absolute", top:-3, left:`${Math.min(99,Math.max(1,(result.overall_score+100)/2))}%`, width:16, height:16, borderRadius:"50%", background:"#fff", border:"2px solid #060e17", transform:"translateX(-50%)", boxShadow:`0 0 6px ${verdictC[result.verdict]||"#ffd700"}` }}/>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#4a7090" }}>
              <span>-100 弱気</span><span>0 中立</span><span>+100 強気</span>
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            {(result.news||[]).map((n,i) => (
              <div key={i} style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:10, padding:"10px 12px", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>{n.icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:"#e8f4ff", lineHeight:1.4 }}>{n.title}</span>
                      <span style={{ fontSize:10, color:n.score>20?"#00e5a0":n.score<-20?"#ff4d6d":"#ffd700", fontWeight:700, flexShrink:0, marginLeft:8 }}>{n.score>0?"+":""}{n.score}</span>
                    </div>
                    <div style={{ fontSize:9, color:"#3a5570", marginBottom:4 }}>{n.date}</div>
                    <div style={{ fontSize:11, color:"#6090a8", lineHeight:1.5 }}>{n.summary}</div>
                  </div>
                </div>
                <div style={{ marginTop:8, height:3, background:"#0d2030", borderRadius:2 }}>
                  <div style={{ height:"100%", width:`${Math.min(100,Math.max(0,(n.score+100)/2))}%`, background:n.score>20?"#00e5a0":n.score<-20?"#ff4d6d":"#ffd700", borderRadius:2 }}/>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
            <div style={{ background:"#00e5a010", border:"1px solid #00e5a025", borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:9, color:"#00e5a0", letterSpacing:2, marginBottom:6 }}>🟢 買い材料</div>
              {(result.bull_points||[]).map((p,i) => <div key={i} style={{ fontSize:11, color:"#70a090", lineHeight:1.6 }}>▸ {p}</div>)}
            </div>
            <div style={{ background:"#ff4d6d10", border:"1px solid #ff4d6d25", borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:9, color:"#ff4d6d", letterSpacing:2, marginBottom:6 }}>🔴 売り材料</div>
              {(result.bear_points||[]).map((p,i) => <div key={i} style={{ fontSize:11, color:"#906070", lineHeight:1.6 }}>▸ {p}</div>)}
            </div>
          </div>
          <div style={{ textAlign:"center", padding:14, background:`${verdictC[result.verdict]||"#ffd700"}15`, border:`1px solid ${verdictC[result.verdict]||"#ffd700"}40`, borderRadius:10 }}>
            <div style={{ fontSize:9, color:"#4a7090", marginBottom:4 }}>総合判定</div>
            <div style={{ fontSize:18, fontWeight:900, color:verdictC[result.verdict]||"#ffd700" }}>{result.verdict}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function InsiderPanel() {
  const [ticker, setTicker] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState(0);
  const phaseRef = useRef(null);
  const phases = ["🔍 インサイダー情報を収集中...","📊 取引データを分析中...","🤖 シグナル判定中...","✅ レポート生成中..."];
  async function analyze() {
    const t = ticker.trim().toUpperCase(); if (!t) return;
    setLoading(true); setResult(null); setError(null); setPhase(0);
    phaseRef.current = setInterval(() => setPhase(i => (i+1) % phases.length), 800);
    try { const d = await callAPI(INSIDER_PROMPT, `${t}の直近3ヶ月のインサイダー取引を分析してください。JSONのみ返してください。`); setResult(d); }
    catch (e) { setError(e.message); }
    finally { clearInterval(phaseRef.current); setLoading(false); }
  }
  const verdictC = {"強気シグナル":"#00e5a0","中立":"#ffd700","警戒シグナル":"#ff4d6d"};
  return (
    <div>
      <InputRow value={ticker} onChange={setTicker} onEnter={analyze} placeholder="ティッカー例: NVDA, AAPL" loading={loading} btnLabel="分析する" btnColor="#a78bfa"/>
      {loading && <LoadingDots color="#a78bfa" phases={phases} phase={phase}/>}
      {error && <ErrBox msg={error}/>}
      {result && !loading && (
        <div style={{ animation:"fadeIn .3s ease" }}>
          <div style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
            <div style={{ fontSize:9, color:"#4a7090", letterSpacing:2, marginBottom:12 }}>直近3ヶ月 インサイダー取引</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
              {[{label:"買い件数",value:result.buy_count,color:"#00e5a0"},{label:"売り件数",value:result.sell_count,color:"#ff4d6d"},{label:"買い比率",value:`${result.buy_ratio}%`,color:result.buy_ratio>=60?"#00e5a0":result.buy_ratio>=40?"#ffd700":"#ff4d6d"}].map(({label,value,color})=>(
                <div key={label} style={{ textAlign:"center", background:"#04090f", borderRadius:8, padding:"10px 6px" }}>
                  <div style={{ fontSize:9, color:"#4a7090", marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:20, fontWeight:900, color }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:4, display:"flex", justifyContent:"space-between", fontSize:9, color:"#4a7090" }}>
              <span>買い比率</span>
              <span style={{ color:result.buy_ratio>=60?"#00e5a0":result.buy_ratio>=40?"#ffd700":"#ff4d6d", fontWeight:700 }}>{result.buy_ratio}%</span>
            </div>
            <div style={{ height:8, background:"#ff4d6d44", borderRadius:4, overflow:"hidden", marginBottom:4 }}>
              <div style={{ height:"100%", width:`${result.buy_ratio}%`, background:result.buy_ratio>=60?"#00e5a0":result.buy_ratio>=40?"#ffd700":"#ff4d6d", borderRadius:4, transition:"width .6s ease" }}/>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#4a7090" }}>
              <span>← 売り優勢</span><span>買い優勢 →</span>
            </div>
          </div>
          <div style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:10, padding:"12px 14px", marginBottom:12 }}>
            <div style={{ fontSize:9, color:"#a78bfa", letterSpacing:2, marginBottom:10 }}>👔 注目の取引</div>
            {(result.notable||[]).map((n,i) => (
              <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:10, paddingBottom:10, borderBottom:i<result.notable.length-1?"1px solid #0d1a25":"none" }}>
                <span style={{ fontSize:11, padding:"2px 8px", background:n.type==="買い"?"#00e5a022":"#ff4d6d22", color:n.type==="買い"?"#00e5a0":"#ff4d6d", borderRadius:6, flexShrink:0, border:`1px solid ${n.type==="買い"?"#00e5a044":"#ff4d6d44"}` }}>{n.type}</span>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontSize:12, color:"#e8f4ff", fontWeight:700 }}>{n.role}</span>
                    <span style={{ fontSize:12, color:n.type==="買い"?"#00e5a0":"#ff4d6d", fontWeight:700 }}>{n.amount}</span>
                  </div>
                  <div style={{ fontSize:10, color:"#507090", lineHeight:1.5, marginTop:3 }}>{n.meaning}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:10, padding:"12px 14px", marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ fontSize:11, color:"#4a7090" }}>インサイダー信頼度スコア</span><InfoBtn id="insider_confidence"/></div>
              <span style={{ fontSize:20, fontWeight:900, color:result.confidence_score>=70?"#00e5a0":result.confidence_score>=40?"#ffd700":"#ff4d6d" }}>{result.confidence_score}<span style={{ fontSize:11 }}>/100</span></span>
            </div>
            <ScoreBar value={result.confidence_score} color={result.confidence_score>=70?"#00e5a0":result.confidence_score>=40?"#ffd700":"#ff4d6d"}/>
          </div>
          <div style={{ textAlign:"center", padding:14, background:`${verdictC[result.verdict]||"#ffd700"}15`, border:`1px solid ${verdictC[result.verdict]||"#ffd700"}40`, borderRadius:10 }}>
            <div style={{ fontSize:9, color:"#4a7090", marginBottom:4 }}>判定</div>
            <div style={{ fontSize:18, fontWeight:900, color:verdictC[result.verdict]||"#ffd700" }}>{result.verdict}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShortPanel() {
  const [ticker, setTicker] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState(0);
  const phaseRef = useRef(null);
  const phases = ["📉 空売りデータを収集中...","📊 トレンドを分析中...","🤖 スクイーズ予測中...","✅ レポート生成中..."];
  async function analyze() {
    const t = ticker.trim().toUpperCase(); if (!t) return;
    setLoading(true); setResult(null); setError(null); setPhase(0);
    phaseRef.current = setInterval(() => setPhase(i => (i+1) % phases.length), 800);
    try { const d = await callAPI(SHORT_PROMPT, `${t}の空売り状況を分析してください。JSONのみ返してください。`); setResult(d); }
    catch (e) { setError(e.message); }
    finally { clearInterval(phaseRef.current); setLoading(false); }
  }
  const verdictC = {"安全":"#00e5a0","注意":"#ffd700","危険":"#ff4d6d"};
  const trendC = {"増加":"#ff4d6d","減少":"#00e5a0","横ばい":"#ffd700"};
  const trendI = {"増加":"↑","減少":"↓","横ばい":"→"};
  return (
    <div>
      <InputRow value={ticker} onChange={setTicker} onEnter={analyze} placeholder="ティッカー例: NVDA, AAPL" loading={loading} btnLabel="分析する" btnColor="#ff6b35"/>
      {loading && <LoadingDots color="#ff6b35" phases={phases} phase={phase}/>}
      {error && <ErrBox msg={error}/>}
      {result && !loading && (
        <div style={{ animation:"fadeIn .3s ease" }}>
          <div style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
              <div style={{ textAlign:"center", background:"#04090f", borderRadius:8, padding:"12px 8px" }}>
                <div style={{ fontSize:9, color:"#4a7090", marginBottom:4 }}>空売り比率（推定）</div>
                <div style={{ fontSize:24, fontWeight:900, color:verdictC[result.verdict]||"#ffd700" }}>{result.short_ratio}</div>
              </div>
              <div style={{ textAlign:"center", background:"#04090f", borderRadius:8, padding:"12px 8px" }}>
                <div style={{ fontSize:9, color:"#4a7090", marginBottom:4 }}>トレンド</div>
                <div style={{ fontSize:18, fontWeight:900, color:trendC[result.trend]||"#ffd700" }}>{trendI[result.trend]||"→"} {result.trend}</div>
              </div>
            </div>
            <div style={{ fontSize:11, color:"#6090a8", lineHeight:1.5, textAlign:"center" }}>{result.meaning}</div>
          </div>
          <div style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:10, padding:"12px 14px", marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ fontSize:11, color:"#4a7090" }}>🔥 スクイーズポテンシャル</span><InfoBtn id="squeeze_potential"/></div>
              <span style={{ fontSize:20, fontWeight:900, color:result.squeeze_potential>=70?"#ff6b35":result.squeeze_potential>=40?"#ffd700":"#00e5a0" }}>{result.squeeze_potential}<span style={{ fontSize:11 }}>/100</span></span>
            </div>
            <ScoreBar value={result.squeeze_potential} color={result.squeeze_potential>=70?"#ff6b35":result.squeeze_potential>=40?"#ffd700":"#00e5a0"}/>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#4a7090", marginTop:4 }}>
              <span>低（安全）</span><span>高（スクイーズ注意）</span>
            </div>
          </div>
          {(result.warnings||[]).length>0 && (
            <div style={{ background:"#ff4d6d10", border:"1px solid #ff4d6d25", borderRadius:8, padding:"10px 12px", marginBottom:12 }}>
              <div style={{ fontSize:9, color:"#ff4d6d", letterSpacing:2, marginBottom:6 }}>⚠ 注意点</div>
              {result.warnings.map((w,i) => <div key={i} style={{ fontSize:11, color:"#906070", lineHeight:1.6 }}>▸ {w}</div>)}
            </div>
          )}
          <div style={{ textAlign:"center", padding:14, background:`${verdictC[result.verdict]||"#ffd700"}15`, border:`1px solid ${verdictC[result.verdict]||"#ffd700"}40`, borderRadius:10 }}>
            <div style={{ fontSize:9, color:"#4a7090", marginBottom:4 }}>判定</div>
            <div style={{ fontSize:18, fontWeight:900, color:verdictC[result.verdict]||"#ffd700" }}>{result.verdict}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function EarningsPanel() {
  const [ticker, setTicker] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState(0);
  const phaseRef = useRef(null);
  const phases = ["📅 決算データを収集中...","📊 EPSサプライズを計算中...","🤖 次回決算を予測中...","✅ レポート生成中..."];
  async function analyze() {
    const t = ticker.trim().toUpperCase(); if (!t) return;
    setLoading(true); setResult(null); setError(null); setPhase(0);
    phaseRef.current = setInterval(() => setPhase(i => (i+1) % phases.length), 800);
    try { const d = await callAPI(EARNINGS_PROMPT, `${t}の決算サプライズ予測をしてください。JSONのみ返してください。`); setResult(d); }
    catch (e) { setError(e.message); }
    finally { clearInterval(phaseRef.current); setLoading(false); }
  }
  const predC = {"強気":"#00e5a0","弱気":"#ff4d6d","中立":"#ffd700"};
  const reactC = {"上昇":"#00e5a0","下落":"#ff4d6d","横ばい":"#ffd700"};
  const tradeC = {"決算前に買う":"#00e5a0","決算前に売る":"#ff4d6d","様子見":"#ffd700"};
  return (
    <div>
      <InputRow value={ticker} onChange={setTicker} onEnter={analyze} placeholder="ティッカー例: NVDA, AAPL" loading={loading} btnLabel="分析する" btnColor="#00e5a0"/>
      {loading && <LoadingDots color="#00e5a0" phases={phases} phase={phase}/>}
      {error && <ErrBox msg={error}/>}
      {result && !loading && (
        <div style={{ animation:"fadeIn .3s ease" }}>
          <div style={{ background:"#00e5a010", border:"1px solid #00e5a025", borderRadius:10, padding:"12px 14px", marginBottom:12, textAlign:"center" }}>
            <div style={{ fontSize:9, color:"#00e5a0", letterSpacing:2, marginBottom:4 }}>📅 次回決算日</div>
            <div style={{ fontSize:16, fontWeight:900, color:"#e8f4ff" }}>{result.next_earnings}</div>
          </div>
          <div style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:10, padding:"12px 14px", marginBottom:12 }}>
            <div style={{ fontSize:9, color:"#4a7090", letterSpacing:2, marginBottom:10 }}>📈 過去4回の決算サプライズ</div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead>
                  <tr>{["四半期","EPS予想","EPS実績","サプライズ"].map(h=><th key={h} style={{ textAlign:"center", color:"#3a5570", fontSize:9, paddingBottom:8, borderBottom:"1px solid #0d2030", paddingRight:4 }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {(result.past_surprises||[]).map((s,i)=>{
                    const isPos=String(s.surprise_rate).startsWith("+");
                    const isNeg=String(s.surprise_rate).startsWith("-");
                    const sc=isPos?"#00e5a0":isNeg?"#ff4d6d":"#ffd700";
                    return (
                      <tr key={i} style={{ borderTop:i>0?"1px solid #0d1a25":"none" }}>
                        <td style={{ padding:"6px 4px", textAlign:"center", color:"#e8f4ff", fontWeight:700 }}>{s.quarter}</td>
                        <td style={{ textAlign:"center", color:"#7090a8" }}>{s.eps_estimate}</td>
                        <td style={{ textAlign:"center", color:"#e8f4ff" }}>{s.eps_actual}</td>
                        <td style={{ textAlign:"center" }}><span style={{ fontSize:11, padding:"2px 6px", background:`${sc}22`, color:sc, borderRadius:4, fontWeight:700 }}>{s.surprise_rate}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
            {[{label:"サプライズ予測",value:result.surprise_prediction,colorMap:predC},{label:"株価反応予測",value:result.price_reaction,colorMap:reactC},{label:"決算トレード推奨",value:result.trade_recommendation,colorMap:tradeC}].map(({label,value,colorMap})=>(
              <div key={label} style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:8, padding:"10px 8px", textAlign:"center" }}>
                <div style={{ fontSize:9, color:"#4a7090", marginBottom:6 }}>{label}</div>
                <div style={{ fontSize:11, fontWeight:900, color:colorMap[value]||"#ffd700" }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ background:"#09141e", border:"1px solid #0d2030", borderRadius:10, padding:"12px 14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ fontSize:11, color:"#4a7090" }}>サプライズスコア</span><InfoBtn id="surprise_score"/></div>
              <span style={{ fontSize:20, fontWeight:900, color:result.surprise_score>=70?"#00e5a0":result.surprise_score>=40?"#ffd700":"#ff4d6d" }}>{result.surprise_score}<span style={{ fontSize:11 }}>/100</span></span>
            </div>
            <ScoreBar value={result.surprise_score} color={result.surprise_score>=70?"#00e5a0":result.surprise_score>=40?"#ffd700":"#ff4d6d"}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 9: InfoCenter ─────────────────────────────────────────
function InfoCenterTab() {
  const [subTab, setSubTab] = useState("news");
  const SUB_TABS = [
    { key:"news",     label:"ニュースセンチメント", icon:"📰", color:"#00c9ff" },
    { key:"insider",  label:"インサイダー売買",     icon:"👔", color:"#a78bfa" },
    { key:"short",    label:"空売り分析",           icon:"📉", color:"#ff6b35" },
    { key:"earnings", label:"決算サプライズ予測",   icon:"📅", color:"#00e5a0" },
  ];
  const cur = SUB_TABS.find(s => s.key === subTab);
  return (
    <div>
      <div style={{ overflowX:"auto", scrollbarWidth:"none", WebkitOverflowScrolling:"touch" }}>
        <div style={{ display:"flex", gap:2, padding:"0 16px", minWidth:"max-content" }}>
          {SUB_TABS.map(st=>(
            <button key={st.key} onClick={()=>setSubTab(st.key)}
              style={{ flexShrink:0, padding:"10px 10px", background:subTab===st.key?`${st.color}18`:"transparent", border:`1px solid ${subTab===st.key?st.color+"55":"#0d2030"}`, borderBottom:"none", borderRadius:"8px 8px 0 0", color:subTab===st.key?st.color:"#3a5570", cursor:"pointer", fontFamily:"inherit", fontSize:10, fontWeight:700, whiteSpace:"nowrap" }}>
              {st.icon} {st.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ borderTop:`1px solid ${cur?.color||"#0d2030"}44`, padding:"16px 16px 8px" }}>
        {subTab==="news"     && <NewsSentimentPanel/>}
        {subTab==="insider"  && <InsiderPanel/>}
        {subTab==="short"    && <ShortPanel/>}
        {subTab==="earnings" && <EarningsPanel/>}
      </div>
    </div>
  );
}

// ── TABS ──────────────────────────────────────────────────────
const TABS = [
  { key:"ranking",     icon:"📊", label:"ランキング" },
  { key:"analysis",    icon:"🔍", label:"分析" },
  { key:"portfolio",   icon:"💼", label:"ポートフォリオ" },
  { key:"macro",       icon:"🌍", label:"マクロ" },
  { key:"watch",       icon:"⭐", label:"ウォッチ" },
  { key:"technical",   icon:"📉", label:"テクニカル" },
  { key:"fundamental", icon:"📋", label:"ファンダ" },
  { key:"strategy",    icon:"🧠", label:"戦略ツール" },
  { key:"info",        icon:"🗞️", label:"情報センター" },
];

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("ranking");
  const [analysisTicker, setAnalysisTicker] = useState("");
  function jumpToAnalysis(ticker){ setAnalysisTicker(ticker); setActiveTab("analysis"); }
  return (
    <ErrorBoundary>
      <div style={{ minHeight:"100vh", background:"#04090f", fontFamily:"'Courier New', monospace", color:"#c8d8e8", paddingBottom:72 }}>
        <style>{`
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
          @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
          .skeleton{background:linear-gradient(90deg,#0d1f2d 25%,#162840 50%,#0d1f2d 75%);background-size:200% 100%;animation:shimmer 1.5s infinite}
          @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
          input::placeholder,textarea::placeholder{color:#253545}
          *{box-sizing:border-box}
          .tabnav::-webkit-scrollbar{display:none}
        `}</style>
        <div style={{ background:"linear-gradient(180deg,#060e18,#04090f)", borderBottom:"1px solid #0d2030", padding:"20px 16px 16px" }}>
          <div style={{ maxWidth:680, margin:"0 auto" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background:"#00e5a0", display:"inline-block", animation:"pulse 1.5s infinite" }}/>
              <span style={{ fontSize:9, letterSpacing:4, color:"#00e5a0" }}>AI INVESTMENT INTELLIGENCE · LIVE</span>
            </div>
            <h1 style={{ margin:0, fontSize:"clamp(18px,4vw,26px)", fontWeight:900, color:"#eaf4ff" }}>プロ級AI投資アシスタント</h1>
          </div>
        </div>
        <div style={{ maxWidth:680, margin:"0 auto" }}>
          {activeTab==="ranking"     && <RankingTab/>}
          {activeTab==="analysis"    && <AnalysisTab key={analysisTicker} initialTicker={analysisTicker}/>}
          {activeTab==="portfolio"   && <PortfolioTab/>}
          {activeTab==="macro"       && <MacroTab/>}
          {activeTab==="watch"       && <WatchlistTab onAnalyze={jumpToAnalysis}/>}
          {activeTab==="technical"   && <TechnicalTab/>}
          {activeTab==="fundamental" && <FundamentalTab/>}
          {activeTab==="strategy"    && <StrategyTab/>}
          {activeTab==="info"        && <InfoCenterTab/>}
        </div>
        <nav className="tabnav" style={{ position:"fixed", bottom:0, left:0, right:0, background:"#060e18", borderTop:"1px solid #0d2030", display:"flex", zIndex:50, overflowX:"auto", scrollbarWidth:"none", WebkitOverflowScrolling:"touch" }}>
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>setActiveTab(t.key)} style={{ minWidth:68, flexShrink:0, padding:"10px 4px 8px", background:"transparent", border:"none", borderTop:activeTab===t.key?"2px solid #00c9ff":"2px solid transparent", color:activeTab===t.key?"#00c9ff":"#2a4560", cursor:"pointer", fontFamily:"inherit", display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
              <span style={{ fontSize:18 }}>{t.icon}</span>
              <span style={{ fontSize:9, fontWeight:activeTab===t.key?700:400, whiteSpace:"nowrap" }}>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </ErrorBoundary>
  );
}
