import fs from 'node:fs';

const path = new URL('../index.html', import.meta.url);
const html = fs.readFileSync(path, 'utf8');
const marker = '<script type="__bundler/template">';
const start = html.indexOf(marker) + marker.length;
const end = html.lastIndexOf('</script>');
if (start < marker.length || end < 0) throw new Error('Bundled template not found');
let template = JSON.parse(html.slice(start, end));

const translationMarker = 'const TRADITIONAL_CHINESE_TRANSLATIONS = true;';
if (!template.includes(translationMarker)) {
  const pairs = [
    '为為','个個','们們','来來','这這','还還','进進','过過','与與','业業','东東','两兩','严嚴','丽麗','举舉','义義','乐樂','习習','乡鄉','书書','买買','乱亂','争爭','于於','云雲','亚亞','产產','亲親','从從','仓倉','仪儀','价價','众眾','优優','会會','传傳','伤傷','伦倫','体體','余餘','佣傭','侧側','侨僑','俭儉','债債','储儲','儿兒','党黨','兰蘭','关關','兴興','养養','内內','册冊','写寫','军軍','农農','冲衝','决決','况況','净淨','减減','几幾','凤鳳','凭憑','击擊','划劃','则則','刚剛','创創','删刪','别別','剧劇','劝勸','办辦','务務','动動','劳勞','势勢','区區','医醫','华華','协協','单單','卖賣','卫衛','却卻','厂廠','厅廳','历歷','压壓','厌厭','厨廚','县縣','参參','双雙','发發','变變','叙敘','叶葉','号號','听聽','启啟','员員','响響','团團','园園','围圍','图圖','圆圓','场場','块塊','坚堅','坛壇','墙牆','声聲','壳殼','处處','备備','复復','够夠','头頭','夹夾','奋奮','奖獎','妇婦','妈媽','孙孫','学學','宁寧','宝寶','实實','审審','宽寬','对對','寻尋','导導','将將','尝嘗','层層','届屆','属屬','岁歲','岗崗','岛島','岭嶺','峡峽','币幣','帅帥','师師','帐帳','帮幫','并並','广廣','庆慶','库庫','应應','废廢','开開','异異','弃棄','张張','弯彎','强強','归歸','当當','录錄','彻徹','径徑','忆憶','忧憂','怀懷','态態','总總','恋戀','恳懇','恶惡','恼惱','惊驚','惧懼','惨慘','惯慣','愿願','懒懶','戏戲','户戶','执執','扩擴','扫掃','扬揚','扰擾','抚撫','抛拋','抢搶','护護','报報','担擔','拟擬','拢攏','拥擁','拦攔','拨撥','择擇','挂掛','挡擋','挤擠','挥揮','损損','换換','据據','掷擲','揽攬','搁擱','携攜','摄攝','摆擺','摇搖','摊攤','撑撐','敌敵','数數','斋齋','断斷','无無','旧舊','时時','旷曠','显顯','晒曬','晓曉','暂暫','术術','机機','杂雜','权權','条條','杨楊','极極','构構','枪槍','柜櫃','标標','栋棟','栏欄','树樹','样樣','档檔','桥橋','梦夢','检檢','楼樓','欢歡','欧歐','残殘','毁毀','毕畢','气氣','汇匯','汉漢','汤湯','沟溝','没沒','泪淚','泽澤','洁潔','浅淺','浇澆','浊濁','测測','济濟','浑渾','浓濃','涛濤','润潤','涨漲','涩澀','渊淵','渐漸','渔漁','温溫','湾灣','湿濕','满滿','滤濾','滥濫','滨濱','灭滅','灯燈','灵靈','灾災','炉爐','炼煉','烂爛','烛燭','烟煙','烦煩','烧燒','热熱','爱愛','爷爺','牵牽','状狀','犹猶','独獨','狮獅','猎獵','猪豬','猫貓','献獻','环環','现現','琐瑣','电電','画畫','畅暢','疗療','皱皺','盏盞','盐鹽','监監','盖蓋','盘盤','着著','睁睜','矿礦','码碼','砖磚','硕碩','础礎','确確','碍礙','礼禮','离離','种種','积積','称稱','税稅','稳穩','穷窮','竞競','笔筆','筛篩','筹籌','签簽','简簡','篮籃','类類','粤粵','粮糧','纠糾','红紅','纤纖','约約','级級','纪紀','纬緯','纯純','纲綱','纳納','纵縱','纷紛','纸紙','纹紋','纽紐','线線','练練','组組','细細','织織','终終','绍紹','经經','绑綁','结結','绕繞','绘繪','给給','络絡','绝絕','统統','继繼','绩績','绪緒','续續','绳繩','维維','综綜','绿綠','缓緩','编編','缘緣','缝縫','缩縮','缴繳','网網','罗羅','罚罰','职職','联聯','聪聰','肃肅','肠腸','肤膚','胀脹','胆膽','胜勝','胶膠','脉脈','脏臟','脑腦','腾騰','舰艦','艰艱','艳艷','艺藝','节節','苏蘇','范範','荐薦','药藥','获獲','莲蓮','营營','萧蕭','萨薩','蓝藍','虑慮','虚虛','虽雖','虾蝦','蚁蟻','补補','装裝','裤褲','见見','观觀','规規','视視','觉覺','览覽','触觸','誉譽','计計','订訂','认認','讨討','让讓','训訓','议議','讯訊','记記','讲講','许許','论論','设設','访訪','证證','评評','识識','诉訴','词詞','译譯','试試','诗詩','诚誠','话話','该該','详詳','语語','误誤','说說','请請','诸諸','诺諾','读讀','谁誰','调調','谈談','谊誼','谋謀','谢謝','谣謠','贝貝','负負','财財','责責','贤賢','败敗','账賬','货貨','质質','贫貧','购購','贯貫','贴貼','贵貴','贷貸','费費','贺賀','资資','赋賦','赏賞','赔賠','赖賴','赚賺','赛賽','赞讚','赠贈','赶趕','趋趨','跃躍','踪蹤','车車','轨軌','转轉','轮輪','软軟','轻輕','载載','较較','辅輔','辆輛','辈輩','辉輝','辑輯','输輸','辖轄','辞辭','边邊','达達','迁遷','迈邁','运運','远遠','违違','连連','迟遲','适適','选選','递遞','逻邏','遗遺','邮郵','邻鄰','释釋','里裡','鉴鑒','钉釘','钮鈕','钱錢','钻鑽','铁鐵','铃鈴','铜銅','铝鋁','银銀','铺鋪','链鏈','销銷','锁鎖','锅鍋','锋鋒','锐銳','错錯','锦錦','键鍵','锯鋸','镜鏡','长長','门門','闪閃','闭閉','问問','闲閒','间間','闻聞','阁閣','阅閱','阔闊','队隊','阳陽','阴陰','阵陣','阶階','际際','陆陸','陈陳','险險','随隨','隐隱','难難','雾霧','静靜','顶頂','项項','顺順','须須','顾顧','顿頓','预預','领領','颁頒','颗顆','颜顏','额額','风風','飞飛','饭飯','饮飲','饱飽','馆館','马馬','驶駛','驻駐','驾駕','验驗','骑騎','鱼魚','鲜鮮','鸟鳥','鸡雞','鸣鳴','麦麥','黄黃','齐齊','齿齒','龙龍'
  ];
  const map = Object.fromEntries(pairs.map(pair => [pair[0], pair[1]]));
  const additions = [
    '',
    translationMarker,
    "const toTraditionalChinese=s=>String(s).replace(/日历/g,'日曆').replace(/地点/g,'地點').replace(/浏览器/g,'瀏覽器').replace(/轻松/g,'輕鬆').replace(/菲律宾/g,'菲律賓').replace(/小贩/g,'小販').replace(/国家/g,'國家').replace(/字符/g,'字元').replace(/激活/g,'啟用').replace(/账户/g,'帳戶').replace(/[\\u3400-\\u9fff]/g,c=>TRADITIONAL_CHINESE_MAP[c]||c);",
    "I18N['zh-Hant']=Object.fromEntries(Object.entries(I18N.zh).map(([key,value])=>[key,toTraditionalChinese(value)]));",
    "Object.assign(I18N['zh-Hant'],{'Sign in':'登入','Create account':'建立帳戶','I have a code':'我有啟用碼','Create free account':'免費建立帳戶','Activate my account':'啟用我的帳戶','Company / outlet name':'公司／店舖名稱','Your name':'您的姓名','Business type':'業務類型','Country':'國家／地區','Email':'電郵地址','Password':'密碼','Please agree to the Terms of Use to create your account.':'請同意使用條款以建立帳戶。','Company name, email and password are required.':'請填寫公司名稱、電郵地址和密碼。','Password must be at least 6 characters.':'密碼必須至少包含 6 個字元。','An account with this email already exists.':'此電郵地址已有帳戶。','No account matches those details.':'找不到符合這些資料的帳戶。','Log out':'登出','Overview':'總覽'});",
    ''
  ];
  additions[2] = 'const TRADITIONAL_CHINESE_MAP=' + JSON.stringify(map) + ';\n' + additions[2];
  const classAt = template.indexOf('class Component extends DCLogic');
  if (classAt < 0) throw new Error('Component class not found');
  template = template.slice(0, classAt) + additions.join('\n') + template.slice(classAt);
}

template = template.replace(
  "const toTraditionalChinese=s=>String(s).replace(/[\\u3400-\\u9fff]/g,c=>TRADITIONAL_CHINESE_MAP[c]||c);",
  "const toTraditionalChinese=s=>String(s).replace(/日历/g,'日曆').replace(/地点/g,'地點').replace(/浏览器/g,'瀏覽器').replace(/轻松/g,'輕鬆').replace(/菲律宾/g,'菲律賓').replace(/小贩/g,'小販').replace(/国家/g,'國家').replace(/字符/g,'字元').replace(/激活/g,'啟用').replace(/账户/g,'帳戶').replace(/[\\u3400-\\u9fff]/g,c=>TRADITIONAL_CHINESE_MAP[c]||c);"
);

const oldState = "geoState:null, selfie:null, busy:false, lang:(()=>{try{return localStorage.getItem('attenda_lang')||'en';}catch(e){return 'en';}})()";
const newState = "geoState:null, selfie:null, busy:false, langOpen:false, lang:(()=>{try{const v=localStorage.getItem('attenda_lang')||'en';return ['en','zh','zh-Hant','ja'].includes(v)?v:'en';}catch(e){return 'en';}})()";
if (template.includes(oldState)) template = template.replace(oldState, newState);
template = template.replace(
  "screen:'boot', authMode:'signin', err:'', ok:'', toast:'',",
  "screen:'boot', authMode:(()=>{try{return new URLSearchParams(location.search).get('mode')==='signup'?'signup':'signin';}catch(e){return 'signin';}})(), err:'', ok:'', toast:'',"
);
template = template.replace(
  "langOpen:false, lang:(()=>{try{const v=localStorage.getItem('attenda_lang')||'en';return ['en','zh','zh-Hant','ja'].includes(v)?v:'en';}catch(e){return 'en';}})()",
  "langOpen:false, lang:(()=>{try{const q=new URLSearchParams(location.search).get('lang'),v=q||localStorage.getItem('attenda_lang')||'en';return ['en','zh','zh-Hant','ja'].includes(v)?v:'en';}catch(e){return 'en';}})()"
);
template = template.replace(
  "componentDidMount(){ this.boot(); this.startAutoRefresh(); setTimeout(()=>this.translateDom(),0); }",
  "componentDidMount(){ try{localStorage.setItem('attenda_lang',this.state.lang);}catch(e){} this.boot(); this.startAutoRefresh(); setTimeout(()=>this.translateDom(),0); }"
);

template = template.replace("const zh=this.state.lang==='zh'; const reps=zh?[", "const zh=this.state.lang==='zh'||this.state.lang==='zh-Hant'; const reps=zh?[");
template = template.replace(
  "reps.forEach(([a,b])=>{s=s.replace(a,b);}); return lead+s+tail; }",
  "reps.forEach(([a,b])=>{s=s.replace(a,b);}); if(this.state.lang==='zh-Hant') s=toTraditionalChinese(s); return lead+s+tail; }"
);

const pickerStart = template.indexOf('  languagePicker(){');
const pickerEnd = template.indexOf('\n\n  /* ---------- persistence', pickerStart);
if (pickerStart < 0 || pickerEnd < 0) throw new Error('Language picker not found');
const picker = [
  "  languagePicker(){ const langs=[['en','EN'],['zh','简中'],['zh-Hant','繁中'],['ja','日本語']], active=langs.find(x=>x[0]===this.state.lang)||langs[0], open=this.state.langOpen;",
  "    const choose=v=>{ this.setLang(v); this.setState({langOpen:false}); };",
  "    return H('div',{style:{position:'fixed',right:14,bottom:14,zIndex:120,display:'flex',flexDirection:'column',alignItems:'stretch',gap:3,padding:4,borderRadius:11,background:C.surface,boxShadow:'0 4px 18px rgba(0,0,0,.16)',border:'1px solid '+C.border,minWidth:78}},",
  "      open?langs.filter(x=>x[0]!==this.state.lang).map(([v,l])=>H('button',{key:v,onClick:()=>choose(v),'aria-label':'Change language to '+l,style:{border:'none',borderRadius:8,padding:'7px 9px',fontSize:11.5,fontWeight:700,cursor:'pointer',background:C.surface,color:C.muted,textAlign:'center'}},l)):null,",
  "      H('button',{key:'active',onClick:()=>this.setState({langOpen:!open}),'aria-label':open?'Collapse language menu':'Expand language menu','aria-expanded':open,style:{border:'none',borderRadius:8,padding:'7px 9px',fontSize:11.5,fontWeight:700,cursor:'pointer',background:C.violet,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',gap:6}},H('span',{},active[1]),H('span',{'aria-hidden':'true',style:{fontSize:9}},open?'▼':'▲')));",
  "  }"
].join('\n');
template = template.slice(0, pickerStart) + picker + template.slice(pickerEnd);

const packed = JSON.stringify(template).replace(/<\/script/gi, '<\\/script');
fs.writeFileSync(path, html.slice(0, start) + packed + html.slice(end));
console.log('Added Traditional Chinese and collapsible language picker.');
