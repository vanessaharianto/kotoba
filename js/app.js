(function(){
  const mainNav = document.getElementById('main-nav');
  const studyScreen = document.getElementById('study');
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const errorMsg = document.getElementById('error-msg');
  const deckCount = document.getElementById('deck-count');
  const themePicker = document.getElementById('theme-picker');
  const THEME_KEY = 'kotoba-color-theme-v1';
  const encouragementLines=[
    {jp:'ゆっくりでいいよ。',en:'Take it slow.'},
    {jp:'今日もちょっとだけ、やってみよう。',en:"Let's try a little today too."},
    {jp:'一日一歩。',en:'One step a day.'},
    {jp:'まちがえても大丈夫。',en:"It's okay to make mistakes."},
    {jp:'今日もえらい！',en:"You're doing great today too!"}
  ];
  function updateTimeGreeting(){
    const hour=new Date().getHours();
    const greeting=hour>=5&&hour<12?'おはよう':hour>=12&&hour<18?'こんにちは':'こんばんは';
    const target=document.getElementById('time-greeting');if(target)target.textContent=greeting;
  }
  function chooseEncouragement(){
    const line=encouragementLines[Math.floor(Math.random()*encouragementLines.length)];
    document.getElementById('encouragement-japanese').textContent=line.jp;
    document.getElementById('encouragement-english').textContent=line.en;
    document.getElementById('encouragement-english').classList.remove('is-visible');
    document.getElementById('encouragement-english').setAttribute('aria-hidden','true');
    document.getElementById('daily-encouragement').setAttribute('aria-expanded','false');
  }

  let selectedTheme = 'classic';
  try{
    const savedTheme = localStorage.getItem(THEME_KEY);
    if(['classic','ember','rose','moon','olive-night'].includes(savedTheme)) selectedTheme = savedTheme;
    else if(savedTheme) localStorage.setItem(THEME_KEY,selectedTheme);
  }catch(e){}
  document.documentElement.dataset.palette = selectedTheme;
  themePicker.value = selectedTheme;
  themePicker.addEventListener('change',()=>{
    selectedTheme = themePicker.value;
    document.documentElement.dataset.palette = selectedTheme;
    try{localStorage.setItem(THEME_KEY,selectedTheme);}catch(e){}
  });

  let mode = 'cards';       // 'cards' or 'drill'
  let formLabels = [];      // form columns found in this tab
  let drill = null;         // current drill question
  let hintSheets = [];      // tabs whose name starts with "Hint"
  let currentSheetName = '';
  let sheetCandidates = []; // every usable tab from the uploaded file
  let kanaDecks = [];
  let isKanaDeck = false;
  let allCards = [];      // full parsed deck
  let activeGroup = 'All';
  let queue = [];         // indices into filteredCards for this session
  let filteredCards = [];
  let pos = 0;
  let knownCount = 0;
  let sessionTotal = 0;
  let readingStories = [];
  let activeStory = null;
  let storySegmentIndex = 0;
  let storyQuestionIndex=0;
  let storyScore = 0;
  let kanjiTargets = [];
  let activeKanjiIndex = -1;
  let activeKanjiSvg = null;
  let kanjiStrokeCount = 0;
  let kanjiStrokesDone = 0;
  let kanjiRoundIndex = 0;
  let kanjiExpectedStrokes = [];
  let kanjiDrawing = null;
  let kanjiAnimating = false;
  let grammarEntries=[];
  let grammarCategories=[];
  let grammarComparisons=[];
  let grammarMode='learn';
  let grammarTopicKey='';
  let grammarLessonIndex=0;
  let grammarPracticeTopic='';
  let grammarLevel='all';
  let grammarOpenIds=new Set();
  let grammarMastered=[];
  let grammarQuiz={phase:'setup',questions:[],index:0,correct:0,answered:false,selected:-1};
  try{grammarMastered=JSON.parse(localStorage.getItem('kotoba-grammar-mastered-v1')||'[]');if(!Array.isArray(grammarMastered))grammarMastered=[];}catch(e){}
  let savedWords=[];
  const SAVED_WORDS_KEY='kotoba-saved-words-v1';
  try{savedWords=JSON.parse(localStorage.getItem(SAVED_WORDS_KEY)||'[]');if(!Array.isArray(savedWords))savedWords=[];}catch(e){}
  let showFurigana = true;
  const REVIEW_KEY='kotoba-spaced-review-v1';
  let reviewProgress={};
  let reviewSessionKeys=[];
  try{reviewProgress=JSON.parse(localStorage.getItem(REVIEW_KEY)||'{}');if(!reviewProgress||typeof reviewProgress!=='object')reviewProgress={};let migrated=false;Object.keys(reviewProgress).forEach(key=>{const item=reviewProgress[key];if(key.startsWith('kanji:')){delete reviewProgress[key];migrated=true;}else if(item&&item.lapses>0&&item.intervalDays===0&&item.dueAt>Date.now()){item.dueAt=Date.now();migrated=true;}});if(migrated)localStorage.setItem(REVIEW_KEY,JSON.stringify(reviewProgress));}catch(e){}
  function saveReviewProgress(){try{localStorage.setItem(REVIEW_KEY,JSON.stringify(reviewProgress));}catch(e){}}
  function cardReviewKey(card){return `word:${card.kanji||card.front||''}|${card.furigana||''}|${card.meaning||''}`;}
  function isDue(key){const item=reviewProgress[key];return !!item&&Number(item.dueAt||0)<=Date.now();}
  function recordReview(key,correct){const prior=reviewProgress[key]||{repetitions:0,intervalDays:0};const repetitions=correct?(prior.repetitions||0)+1:0;const intervalDays=correct?(repetitions===1?1:repetitions===2?3:Math.min(60,Math.max(1,(prior.intervalDays||3)*2))):0;reviewProgress[key]={repetitions,intervalDays,lapses:(prior.lapses||0)+(correct?0:1),lastReviewed:Date.now(),dueAt:Date.now()+(correct?intervalDays*86400000:0)};saveReviewProgress();}
  function dueWordCards(cards=sheetCandidates.flatMap(deck=>deck.cards)){const seen=new Set();return cards.filter(card=>{const key=cardReviewKey(card);if(seen.has(key)||!isDue(key))return false;seen.add(key);return true;});}
  function updateReviewSummary(){const words=dueWordCards().length;const summary=document.getElementById('review-summary');if(summary)summary.textContent=words?`${words} word${words===1?'':'s'} ready for review.`:'Words you miss in flashcards will appear here when they are ready to review.';const wb=document.getElementById('review-words-button');if(wb){wb.textContent=`Review due words (${words})`;wb.disabled=words===0;}}
  function startDueWordReview(){const cards=dueWordCards();if(!cards.length){updateReviewSummary();return;}allCards=cards;currentSheetName='Due word review';reviewSessionKeys=cards.map(cardReviewKey);startStudy();}

  try{ showFurigana = localStorage.getItem('kotoba-show-furigana-v1') !== 'false'; }catch(e){}

  function showError(msg){
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  }
  function clearError(){ errorMsg.style.display = 'none'; }

  ['dragover','dragenter'].forEach(ev => dropzone.addEventListener(ev, e=>{
    e.preventDefault(); dropzone.classList.add('drag');
  }));
  ['dragleave','drop'].forEach(ev => dropzone.addEventListener(ev, e=>{
    e.preventDefault(); dropzone.classList.remove('drag');
  }));
  dropzone.addEventListener('drop', e=>{
    const f = e.dataTransfer.files[0];
    if(f) handleFile(f);
  });
  fileInput.addEventListener('change', e=>{
    const f = e.target.files[0];
    if(f) handleFile(f);
  });
  document.getElementById('daily-encouragement').addEventListener('click',()=>{
    const english=document.getElementById('encouragement-english');const button=document.getElementById('daily-encouragement');
    const show=!english.classList.contains('is-visible');english.classList.toggle('is-visible',show);english.setAttribute('aria-hidden',String(!show));button.setAttribute('aria-expanded',String(show));
  });
  document.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>{
    const page=button.dataset.page;
    if(page==='flashcards') renderDeckPicker();
    if(page==='home') renderHome();
    if(page==='readings') renderReadingList();
    if(page==='kanji') renderKanjiPicker();
    if(page==='grammar') renderGrammarPage();
    setPage(page);
  }));
  document.getElementById('reader-back').addEventListener('click',()=>setPage('readings'));
  document.getElementById('kanji-back').addEventListener('click',()=>setPage('kanji'));
  document.getElementById('kanji-next').addEventListener('click',()=>{
    if(kanjiTargets.length) openKanjiPractice((activeKanjiIndex+1)%kanjiTargets.length);
  });
  document.getElementById('review-words-button').addEventListener('click',startDueWordReview);
  document.getElementById('saved-words-home').addEventListener('click',()=>{renderSavedWords();setPage('saved-words');});
  document.getElementById('kanji-retry').addEventListener('click',()=>{
    if(activeKanjiSvg) resetKanjiDrawing();
    else if(activeKanjiIndex>=0) loadKanjiGuide(kanjiTargets[activeKanjiIndex]);
  });
  document.getElementById('kanji-show-order').addEventListener('click',showKanjiStrokeOrder);
  document.getElementById('kanji-continue-round').addEventListener('click',()=>{
    if(!activeKanjiSvg||kanjiStrokesDone<kanjiExpectedStrokes.length)return;
    if(kanjiRoundIndex<3)setKanjiRound(kanjiRoundIndex+1);
    else{setPage('kanji');renderKanjiPicker();}
  });
  document.getElementById('kanji-search').addEventListener('input',renderKanjiPicker);
  document.getElementById('grammar-mode-tabs').addEventListener('click',event=>{
    const button=event.target.closest('[data-grammar-mode]');if(!button)return;
    grammarMode=button.dataset.grammarMode;renderGrammarPage();
  });
  document.getElementById('grammar-level-filters').addEventListener('click',event=>{
    const button=event.target.closest('[data-grammar-level]');if(!button)return;
    grammarLevel=button.dataset.grammarLevel;grammarQuiz={phase:'setup',questions:[],index:0,correct:0,answered:false,selected:-1};renderGrammarPage();
  });
  document.getElementById('grammar-search').addEventListener('input',renderGrammarReference);
  document.getElementById('grammar-learn-view').addEventListener('change',event=>{if(event.target.id==='grammar-topic-select'){grammarTopicKey=event.target.value;grammarLessonIndex=0;renderGrammarLesson();}});
  document.getElementById('grammar-learn-view').addEventListener('click',event=>{const button=event.target.closest('[data-lesson-action]');if(!button)return;const action=button.dataset.lessonAction;if(action==='previous'){grammarLessonIndex=Math.max(0,grammarLessonIndex-1);renderGrammarLesson();}if(action==='next'){grammarLessonIndex++;renderGrammarLesson();}if(action==='toggle-learned'){const entry=currentGrammarLessonEntry();if(entry){grammarMastered=grammarMastered.includes(entry.id)?grammarMastered.filter(id=>id!==entry.id):[...grammarMastered,entry.id];try{localStorage.setItem('kotoba-grammar-mastered-v1',JSON.stringify(grammarMastered));}catch(e){}renderGrammarLesson();}}if(action==='practice-topic'){grammarPracticeTopic=grammarTopicKey;grammarMode='quiz';startGrammarQuiz(5,grammarTopicEntries());renderGrammarPage();}});
  const openSavedWords=()=>{renderSavedWords();setPage('saved-words');};
  document.getElementById('saved-words-open').addEventListener('click',openSavedWords);
  document.getElementById('saved-words-open-list').addEventListener('click',openSavedWords);
  document.getElementById('saved-words-back').addEventListener('click',()=>setPage('story-reader'));
  document.getElementById('saved-word-list').addEventListener('click',event=>{const remove=event.target.closest('[data-remove-saved]');if(!remove)return;savedWords=savedWords.filter(word=>word.id!==remove.dataset.removeSaved);persistSavedWords();renderSavedWords();});
  document.getElementById('grammar-reference-list').addEventListener('click',event=>{
    const learn=event.target.closest('[data-grammar-learn]');
    if(learn){const id=learn.dataset.grammarLearn;grammarMastered=grammarMastered.includes(id)?grammarMastered.filter(x=>x!==id):[...grammarMastered,id];try{localStorage.setItem('kotoba-grammar-mastered-v1',JSON.stringify(grammarMastered));}catch(e){}renderGrammarReference();return;}
    const toggle=event.target.closest('[data-grammar-toggle]');if(toggle){const id=toggle.dataset.grammarToggle;if(grammarOpenIds.has(id))grammarOpenIds.delete(id);else grammarOpenIds.add(id);renderGrammarReference();}
  });
  document.getElementById('grammar-quiz-view').addEventListener('click',event=>{
    const topicStart=event.target.closest('[data-grammar-topic-practice]');if(topicStart){startGrammarQuiz(5,grammarTopicEntries());return;}
    const start=event.target.closest('[data-grammar-start]');
    if(start){startGrammarQuiz(Number(start.dataset.grammarStart));return;}
    const choice=event.target.closest('[data-grammar-choice]');
    if(choice&&grammarQuiz.phase==='active'&&!grammarQuiz.answered){grammarQuiz.selected=Number(choice.dataset.grammarChoice);grammarQuiz.answered=true;if(grammarQuiz.selected===grammarQuiz.questions[grammarQuiz.index].correctIndex)grammarQuiz.correct++;renderGrammarQuiz();return;}
    if(event.target.closest('[data-grammar-next]')){grammarQuiz.index++;grammarQuiz.answered=false;grammarQuiz.selected=-1;if(grammarQuiz.index>=grammarQuiz.questions.length)grammarQuiz.phase='result';renderGrammarQuiz();}
    if(event.target.closest('[data-grammar-restart]')){grammarQuiz={phase:'setup',questions:[],index:0,correct:0,answered:false,selected:-1};renderGrammarQuiz();}
  });
  const furiganaToggle=document.getElementById('furigana-toggle');
  furiganaToggle.checked=showFurigana;
  furiganaToggle.addEventListener('change',()=>{
    showFurigana=furiganaToggle.checked;
    try{localStorage.setItem('kotoba-show-furigana-v1',String(showFurigana));}catch(e){}
    document.getElementById('story-reader-content').classList.toggle('hide-furigana',!showFurigana);
  });

  function normalizeHeader(h){
    return String(h||'').trim().toLowerCase();
  }

  function cardsFromSheet(ws){
    if(!ws || !ws['!ref']) return null;
    const range = XLSX.utils.decode_range(ws['!ref']);

    const cellText = (r, c) => {
      if(c == null) return '';
      const addr = XLSX.utils.encode_cell({ r: r, c: c });
      const cell = ws[addr];
      if(!cell || cell.v === undefined || cell.v === null) return '';
      return String(cell.v).trim();
    };
    const colLetter = (c) => c == null ? null : XLSX.utils.encode_col(c);

    // Read header row directly, cell by cell
    const headerCols = []; // [{c, norm, raw}]
    for(let c = range.s.c; c <= range.e.c; c++){
      const text = cellText(range.s.r, c);
      if(text) headerCols.push({ c: c, norm: normalizeHeader(text), raw: text });
    }
    const findCol = (test) => {
      const found = headerCols.find(h => test(h.norm));
      return found ? found.c : null;
    };
    const cKanji = findCol(h => h.includes('kanji') || h.includes('japanese') || h === 'verb');
    const cFurigana = findCol(h => h.includes('furigana') || h.includes('kana') || h.includes('reading'));
    const cRomaji = findCol(h => h.includes('romaji'));
    const cMeaning = findCol(h => h.includes('meaning') || h.includes('english'));
    const cGroup = findCol(h => h.includes('group') || h.includes('category'));
    if(cKanji == null && cFurigana == null) return null;

    // Every other column with a header is an "extra" (verb forms, adjective forms, notes...)
    const coreCols = new Set([cKanji, cFurigana, cRomaji, cMeaning, cGroup].filter(c => c != null));
    const extraCols = headerCols.filter(h => !coreCols.has(h.c)).sort((a, b) => formOrder(a.raw) - formOrder(b.raw));

    const debug = {
      sheetRef: ws['!ref'],
      headerRowSeen: headerCols.map(h => `${colLetter(h.c)}="${h.raw}"`),
      detectedColumns: {
        kanji: cKanji==null ? 'NOT FOUND' : `${colLetter(cKanji)} (col ${cKanji})`,
        furigana: cFurigana==null ? 'NOT FOUND' : `${colLetter(cFurigana)} (col ${cFurigana})`,
        romaji: cRomaji==null ? 'NOT FOUND' : `${colLetter(cRomaji)} (col ${cRomaji})`,
        meaning: cMeaning==null ? 'NOT FOUND' : `${colLetter(cMeaning)} (col ${cMeaning})`,
        group: cGroup==null ? 'NOT FOUND' : `${colLetter(cGroup)} (col ${cGroup})`
      },
      sampleRows: []
    };

    const cards = [];
    for(let r = range.s.r + 1; r <= range.e.r; r++){
      const kanji = cellText(r, cKanji);
      const furigana = cellText(r, cFurigana);
      const romaji = cellText(r, cRomaji);
      const meaning = cellText(r, cMeaning);
      const group = cellText(r, cGroup);

      if(debug.sampleRows.length < 8){
        debug.sampleRows.push({
          excelRow: r+1,
          rawGroupCellAddr: cGroup==null ? null : `${colLetter(cGroup)}${r+1}`,
          kanji, furigana, group: group || '(blank)'
        });
      }

      const front = kanji || furigana;
      if(!front && !meaning) continue; // skip fully blank rows
      const extras = extraCols
        .map(h => ({ label: h.raw, value: cellText(r, h.c) }))
        .filter(x => x.value);
      cards.push({
        kanji, furigana, romaji, meaning, extras,
        group: group || 'Ungrouped',
        front: front || '—'
      });
    }
    return { cards, debug };
  }

  function workbookFromDatabase(database, hintDatabase){
    const datasets = [database, hintDatabase].filter(Boolean);
    const entries = datasets.flatMap(data => Object.entries(data.sheets || {}));
    const wb = { SheetNames: [], Sheets: {} };
    entries.forEach(([name, rows])=>{
      const cols = rows.reduce((max,row)=>Math.max(max, row ? row.length : 0), 0);
      if(!rows.length || !cols) return;
      const ws = {};
      ws['!ref'] = XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length-1,c:cols-1}});
      rows.forEach((row,r)=>{
        (row || []).forEach((value,c)=>{
          if(value !== null && value !== undefined && value !== ''){
            ws[XLSX.utils.encode_cell({r:r,c:c})] = {v:value};
          }
        });
      });
      wb.SheetNames.push(name);
      wb.Sheets[name] = ws;
    });
    return wb;
  }

  function setPage(page){
    document.querySelectorAll('.page-view').forEach(el => { el.style.display = 'none'; });
    studyScreen.style.display = 'none';
    if(page === 'study') studyScreen.style.display = 'flex';
    else{
      const target = document.getElementById(page + '-view') || document.getElementById(page);
      if(target) target.style.display = 'block';
    }
    mainNav.style.display = page === 'study' ? 'none' : 'flex';
    const activeNav = page === 'story-reader' ? 'readings' : (page === 'kanji-practice' ? 'kanji' : page);
    mainNav.querySelectorAll('button[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === activeNav));
  }

  function renderRuby(target, base, reading){
    target.textContent = '';
    if(!base) return;
    if(reading && reading !== base){
      const ruby = document.createElement('ruby');
      ruby.appendChild(document.createTextNode(base));
      const rt = document.createElement('rt'); rt.textContent = reading;
      ruby.appendChild(rt); target.appendChild(ruby);
    }else target.textContent = base;
  }

  function renderHome(){
    updateTimeGreeting();updateReviewSummary();renderSavedWordPreview();
    const pool = sheetCandidates
      .filter(deck => /^N[1-5]$/.test(deck.name))
      .flatMap(deck => deck.cards.filter(c => c.furigana && c.meaning && c.front).map(c => ({...c, level:deck.name})));
    const fallbacks = sheetCandidates.flatMap(deck => deck.cards.filter(c => c.furigana && c.meaning && c.front).map(c => ({...c, level:deck.name})));
    const words = pool.length ? pool : fallbacks;
    const date = new Date();
    const dateKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    document.getElementById('word-day-date').textContent = date.toLocaleDateString(undefined,{month:'long',day:'numeric'});
    if(!words.length){
      document.getElementById('word-day-word').textContent = 'No word available';
      document.getElementById('word-day-meaning').textContent = '';
      document.getElementById('word-day-level').textContent = '';
      return;
    }
    let seed=0; for(let i=0;i<dateKey.length;i++) seed=(seed*31+dateKey.charCodeAt(i))>>>0;
    const word=words[seed%words.length];
    renderRuby(document.getElementById('word-day-word'),word.kanji||word.front,word.furigana);
    document.getElementById('word-day-meaning').textContent=word.meaning;
    document.getElementById('word-day-level').textContent=word.level;
  }

  function renderSavedWordPreview(){
    const root=document.getElementById('saved-review-preview');if(!root)return;root.replaceChildren();
    const open=document.getElementById('saved-words-home');if(open)open.textContent=`Saved words (${savedWords.length})`;
    if(!savedWords.length){const empty=document.createElement('p');empty.className='loading-note';empty.textContent='Save a word from a reading and it will show up here.';root.appendChild(empty);return;}
    savedWords.slice(0,5).forEach(word=>{const row=document.createElement('article');row.className='saved-review-item';const term=document.createElement('strong');term.lang='ja';renderRuby(term,word.japanese,word.reading);const meaning=document.createElement('span');meaning.textContent=word.meaning;row.append(term,meaning);root.appendChild(row);});
    if(savedWords.length>5){const more=document.createElement('button');more.type='button';more.className='text-link';more.textContent=`See all ${savedWords.length} saved words →`;more.addEventListener('click',()=>{renderSavedWords();setPage('saved-words');});root.appendChild(more);}
  }

  function renderDeckPicker(){
    const list=document.getElementById('deck-list');
    if(!list)return;
    list.innerHTML='';
    sheetCandidates.forEach(c=>{
      const article=document.createElement('article'); article.className='deck-card';
      const eyebrow=document.createElement('span'); eyebrow.className='level-tag';
      eyebrow.textContent=/^N[1-5]$/.test(c.name)?`JLPT ${c.name}`:(/verb/i.test(c.name)?'Grammar':'Vocabulary');
      const title=document.createElement('h3'); title.textContent=c.name;
      const count=document.createElement('p'); count.textContent=`${c.cards.length.toLocaleString()} cards`;
      const button=document.createElement('button'); button.className='deck-start'; button.type='button'; button.textContent='Study this deck →';
      button.addEventListener('click',()=>{ allCards=c.cards; currentSheetName=c.name; startStudy(); });
      article.append(eyebrow,title,count,button); list.appendChild(article);
    });
    const kanaList=document.getElementById('kana-deck-list');
    if(kanaList){
      kanaList.replaceChildren();
      kanaDecks.forEach(deck=>{
        const article=document.createElement('article');article.className='deck-card kana-deck-card';
        const eyebrow=document.createElement('span');eyebrow.className='level-tag';eyebrow.textContent='Kana recognition';
        const title=document.createElement('h3');title.textContent=deck.name;
        const count=document.createElement('p');count.textContent=`${deck.cards.length} cards · basic, voiced & combined sounds`;
        const button=document.createElement('button');button.className='deck-start';button.type='button';button.textContent='Study kana →';
        button.addEventListener('click',()=>{allCards=deck.cards;currentSheetName=deck.name;startStudy();});
        article.append(eyebrow,title,count,button);kanaList.appendChild(article);
      });
    }
  }

  function buildKanaDecks(data){
    const groupNames={basic:'Basic',voiced:'Voiced sounds',combined:'Combined sounds'};
    kanaDecks=(data?.sets||[]).map(set=>({
      name:set.name,
      cards:Object.entries(groupNames).flatMap(([key,group])=>(set[key]||[]).map(([kana,romaji])=>({
        front:kana,kanji:'',furigana:'',romaji,meaning:'',group,extras:[],isKana:true
      })))
    })).filter(deck=>deck.cards.length);
  }

  function renderReadingList(){
    const list=document.getElementById('story-list');
    if(!list)return;
    list.innerHTML='';
    if(!readingStories.length){
      const p=document.createElement('p'); p.className='loading-note'; p.textContent='No stories are available right now.'; list.appendChild(p); return;
    }
    readingStories.forEach(story=>{
      const card=document.createElement('article'); card.className='story-card';
      const top=document.createElement('div'); top.className='story-card-top';
      const level=document.createElement('span'); level.className='level-tag'; level.textContent=story.level||'N5';
      const time=document.createElement('span'); time.className='story-time'; time.textContent=`${story.minutes||3} min`;
      top.append(level,time);
      const title=document.createElement('h3'); title.textContent=story.title;
      const summary=document.createElement('p'); summary.textContent=story.summary;
      const button=document.createElement('button'); button.className='deck-start'; button.type='button'; button.textContent='Start reading →';
      button.addEventListener('click',()=>beginStory(story));
      card.append(top,title,summary,button); list.appendChild(card);
    });
  }

  function persistSavedWords(){try{localStorage.setItem(SAVED_WORDS_KEY,JSON.stringify(savedWords));}catch(e){}}
  function renderWordLookup(panel,base,reading,candidates){
    const usable=candidates.filter(card=>String(card.meaning||'').trim());
    panel.replaceChildren();panel.hidden=false;
    const term=document.createElement('strong');term.lang='ja';term.textContent=base+(reading&&reading!==base?`（${reading}）`:'');
    const close=document.createElement('button');close.type='button';close.className='lookup-close';close.textContent='Close';close.addEventListener('click',()=>panel.hidden=true);
    panel.append(term,close);
    if(!usable.length){const missing=document.createElement('span');missing.className='lookup-definition';missing.textContent='No translation is available for this word yet.';panel.appendChild(missing);return;}
    const card=usable[0];
    const meaning=document.createElement('span');meaning.className='lookup-definition';meaning.textContent=card.meaning;panel.appendChild(meaning);
    const id=cardReviewKey(card);const saved=savedWords.some(word=>word.id===id);const save=document.createElement('button');save.type='button';save.className='save-word-button';save.textContent=saved?'Saved ✓':'Save word';save.disabled=saved;
    save.addEventListener('click',()=>{if(savedWords.some(word=>word.id===id))return;savedWords.unshift({id,japanese:card.kanji||card.front||base,reading:card.furigana||reading||'',meaning:card.meaning,savedAt:Date.now()});persistSavedWords();save.textContent='Saved ✓';save.disabled=true;const open=document.getElementById('saved-words-open');if(open)open.textContent=`Saved words (${savedWords.length})`;const openList=document.getElementById('saved-words-open-list');if(openList)openList.textContent=`Saved words (${savedWords.length})`;});
    panel.appendChild(save);
  }
  function exactLookupCandidates(base,reading=''){
    const normalize=value=>String(value||'').replace(/[\s　]/g,'');
    return sheetCandidates.flatMap(deck=>deck.cards).filter(card=>String(card.meaning||'').trim()&&([card.kanji,card.front].some(value=>value&&normalize(value)===normalize(base))||(reading&&normalize(card.furigana)===normalize(reading))));
  }
  function activateWordLookups(container,panel){
    if(!container||!panel)return;
    container.querySelectorAll('ruby').forEach(ruby=>{const base=Array.from(ruby.childNodes).filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent).join('').trim();const rt=ruby.querySelector('rt');const reading=rt?rt.textContent.trim():'';if(!base)return;const button=document.createElement('button');button.type='button';button.className='lookup-word';button.setAttribute('aria-label',`Look up ${base}`);button.addEventListener('click',()=>renderWordLookup(panel,base,reading,exactLookupCandidates(base,reading)));ruby.parentNode.insertBefore(button,ruby);button.appendChild(ruby);});
    if(typeof Intl.Segmenter!=='function')return;
    const segmenter=new Intl.Segmenter('ja',{granularity:'word'});
    const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT,{acceptNode:node=>node.parentElement?.closest('ruby,button')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
    const textNodes=[];while(walker.nextNode())textNodes.push(walker.currentNode);
    textNodes.forEach(node=>{const source=node.textContent,parts=Array.from(segmenter.segment(source));if(!parts.some(part=>part.isWordLike&&/[぀-ヿ㐀-鿿]/.test(part.segment)))return;const fragment=document.createDocumentFragment();let changed=false;parts.forEach(part=>{const exact=part.isWordLike&&Array.from(part.segment).length>1?exactLookupCandidates(part.segment):[];if(exact.length){const button=document.createElement('button');button.type='button';button.className='lookup-word';button.setAttribute('aria-label',`Look up ${part.segment}`);button.textContent=part.segment;button.addEventListener('click',()=>renderWordLookup(panel,part.segment,'',exact));fragment.appendChild(button);changed=true;}else fragment.appendChild(document.createTextNode(part.segment));});if(changed)node.parentNode.replaceChild(fragment,node);});
  }
  function renderSavedWords(){
    const list=document.getElementById('saved-word-list');if(!list)return;list.replaceChildren();
    const count=document.getElementById('saved-words-count');count.textContent=`${savedWords.length} saved`;
    const open=document.getElementById('saved-words-open');if(open)open.textContent=`Saved words (${savedWords.length})`;const openList=document.getElementById('saved-words-open-list');if(openList)openList.textContent=`Saved words (${savedWords.length})`;
    if(!savedWords.length){const empty=document.createElement('p');empty.className='loading-note';empty.textContent='No saved words yet. In a reading, tap an underlined word and choose Save word.';list.appendChild(empty);return;}
    savedWords.forEach(word=>{const card=document.createElement('article');card.className='saved-word-card';const japanese=document.createElement('strong');japanese.lang='ja';renderRuby(japanese,word.japanese,word.reading);const meaning=document.createElement('p');meaning.textContent=word.meaning;const remove=document.createElement('button');remove.type='button';remove.className='text-link';remove.dataset.removeSaved=word.id;remove.textContent='Remove';card.append(japanese,meaning,remove);list.appendChild(card);});
  }

  function beginStory(story){
    activeStory=story; storySegmentIndex=0; storyQuestionIndex=0;storyScore=0;
    const root=document.getElementById('story-reader-content');root.innerHTML='';delete root.dataset.storyId;
    const toggle=document.getElementById('furigana-toggle'); toggle.checked=showFurigana;
    setPage('story-reader'); renderStorySegment();
  }

  function renderStorySegment(){
    if(activeStory&&Array.isArray(activeStory.questions)){renderMultiQuestionStory();return;}
    const root=document.getElementById('story-reader-content');
    root.innerHTML=''; root.classList.toggle('hide-furigana',!showFurigana);
    if(!activeStory)return;
    if(storySegmentIndex>=activeStory.segments.length){
      const complete=document.createElement('section'); complete.className='reader-complete';
      const glyph=document.createElement('div'); glyph.className='glyph'; glyph.textContent='読';
      const title=document.createElement('h2'); title.textContent='Story complete';
      const result=document.createElement('p'); result.textContent=`You answered ${storyScore} of ${activeStory.segments.length} questions correctly.`;
      const button=document.createElement('button'); button.className='deck-start'; button.textContent='Choose another story'; button.addEventListener('click',()=>setPage('readings'));
      complete.append(glyph,title,result,button); root.appendChild(complete); return;
    }
    const segment=activeStory.segments[storySegmentIndex];
    const heading=document.createElement('div'); heading.className='reader-story-heading';
    const level=document.createElement('span'); level.className='level-tag'; level.textContent=activeStory.level||'N5';
    const progress=document.createElement('span'); progress.className='story-time'; progress.textContent=`Part ${storySegmentIndex+1} of ${activeStory.segments.length}`;
    const title=document.createElement('h2'); title.textContent=activeStory.title;
    heading.append(level,progress,title); root.appendChild(heading);
    const passage=document.createElement('p'); passage.className='reading-passage'; passage.innerHTML=segment.html; root.appendChild(passage);
    const lookup=document.createElement('aside');lookup.className='word-lookup-panel';lookup.hidden=true;lookup.setAttribute('aria-live','polite');root.appendChild(lookup);
    activateWordLookups(passage,lookup);
    const quiz=document.createElement('section'); quiz.className='story-quiz';
    const label=document.createElement('p'); label.className='eyebrow'; label.textContent='QUICK CHECK';
    const questionJa=document.createElement('p'); questionJa.className='question-ja';
    questionJa.innerHTML=segment.questionJa||'';
    questionJa.lang='ja';
    const question=document.createElement('h3'); question.textContent=segment.question||'';if(!segment.question)question.hidden=true;
    const hintButton=document.createElement('button'); hintButton.type='button'; hintButton.className='translation-toggle';
    hintButton.textContent='Show passage translation'; hintButton.setAttribute('aria-expanded','false');
    const translation=document.createElement('p'); translation.className='passage-translation';
    translation.textContent=segment.translation||'A translation is not available for this passage.';
    translation.hidden=true;
    hintButton.addEventListener('click',()=>{
      const expanded=hintButton.getAttribute('aria-expanded')==='true';
      hintButton.setAttribute('aria-expanded',String(!expanded));
      translation.hidden=expanded;
      hintButton.textContent=expanded?'Show passage translation':'Hide passage translation';
    });
    const choices=document.createElement('div'); choices.className='quiz-options';
    const feedback=document.createElement('p'); feedback.className='quiz-feedback'; feedback.setAttribute('aria-live','polite');
    const next=document.createElement('button'); next.className='deck-start quiz-next'; next.type='button'; next.textContent=storySegmentIndex+1<activeStory.segments.length?'Continue reading →':'Finish story →'; next.style.display='none';
    segment.options.forEach((option,index)=>{
      const button=document.createElement('button'); button.type='button'; button.className='quiz-option';
      const english=document.createElement('span'); english.className='quiz-option-en'; english.textContent=option;
      const japanese=document.createElement('span'); japanese.className='quiz-option-ja'; japanese.lang='ja';
      japanese.innerHTML=(segment.optionsJa&&segment.optionsJa[index])||'';
      if(option)button.appendChild(english);if(japanese.innerHTML)button.appendChild(japanese);
      button.addEventListener('click',()=>{
        choices.querySelectorAll('button').forEach(b=>{b.disabled=true;});
        if(index===segment.answerIndex){button.classList.add('correct');storyScore++;feedback.textContent='Correct! '+segment.explanation;feedback.classList.add('correct-text');}
        else{button.classList.add('incorrect');choices.children[segment.answerIndex].classList.add('correct');feedback.textContent='Not quite. '+segment.explanation;feedback.classList.add('incorrect-text');}
        next.style.display='inline-flex';
      });
      choices.appendChild(button);
    });
    next.addEventListener('click',()=>{storySegmentIndex++;renderStorySegment();window.scrollTo({top:0,behavior:'smooth'});});
    quiz.append(label,questionJa,question,hintButton,translation,choices,feedback,next); root.appendChild(quiz);
  }

  function renderMultiQuestionStory(){
    const root=document.getElementById('story-reader-content');root.classList.toggle('hide-furigana',!showFurigana);
    if(root.dataset.storyId!==activeStory.id){
      root.innerHTML='';root.dataset.storyId=activeStory.id;
      const heading=document.createElement('div');heading.className='reader-story-heading';
      const level=document.createElement('span');level.className='level-tag';level.textContent=activeStory.level||'N5';
      const title=document.createElement('h2');title.textContent=activeStory.title;heading.append(level,title);root.appendChild(heading);
      const japaneseTitle=document.createElement('p');japaneseTitle.className='reader-story-subtitle';japaneseTitle.lang='ja';japaneseTitle.textContent=activeStory.japaneseTitle||'';heading.appendChild(japaneseTitle);
      const passage=document.createElement('p');passage.className='reading-passage';passage.innerHTML=activeStory.html||'';root.appendChild(passage);
      const lookup=document.createElement('aside');lookup.className='word-lookup-panel';lookup.hidden=true;lookup.setAttribute('aria-live','polite');root.appendChild(lookup);activateWordLookups(passage,lookup);
      const translationToggle=document.createElement('button');translationToggle.type='button';translationToggle.className='translation-toggle';translationToggle.textContent='Show passage translation';translationToggle.setAttribute('aria-expanded','false');
      const translation=document.createElement('p');translation.className='passage-translation';translation.textContent=activeStory.translation||'A translation is not available for this passage.';translation.hidden=true;
      translationToggle.addEventListener('click',()=>{const expanded=translationToggle.getAttribute('aria-expanded')==='true';translationToggle.setAttribute('aria-expanded',String(!expanded));translation.hidden=expanded;translationToggle.textContent=expanded?'Show passage translation':'Hide passage translation';});
      root.append(translationToggle,translation);
    }
    root.querySelector('.multi-story-quiz')?.remove();
    if(storyQuestionIndex>=activeStory.questions.length){
      const complete=document.createElement('section');complete.className='reader-complete multi-story-quiz';const glyph=document.createElement('div');glyph.className='glyph';glyph.textContent='読';const heading=document.createElement('h2');heading.textContent='Reading complete';const result=document.createElement('p');result.textContent=`You answered ${storyScore} of ${activeStory.questions.length} questions correctly.`;const again=document.createElement('button');again.type='button';again.className='deck-start';again.textContent='Choose another story';again.addEventListener('click',()=>setPage('readings'));complete.append(glyph,heading,result,again);root.appendChild(complete);return;
    }
    const q=activeStory.questions[storyQuestionIndex];const quiz=document.createElement('section');quiz.className='story-quiz multi-story-quiz';
    const progress=document.createElement('p');progress.className='eyebrow';progress.textContent=`QUESTION ${storyQuestionIndex+1} OF ${activeStory.questions.length}`;
    const questionJa=document.createElement('p');questionJa.className='question-ja';questionJa.lang='ja';questionJa.innerHTML=q.questionJa||'';
    const question=document.createElement('h3');question.className='story-question-en';question.textContent=q.question||'';if(!q.question)question.hidden=true;
    const choices=document.createElement('div');choices.className='quiz-options';const feedback=document.createElement('p');feedback.className='quiz-feedback';feedback.setAttribute('aria-live','polite');
    const next=document.createElement('button');next.className='deck-start quiz-next';next.type='button';next.textContent=storyQuestionIndex+1<activeStory.questions.length?'Next question →':'See result →';next.style.display='none';
    (q.options||[]).forEach((option,index)=>{const button=document.createElement('button');button.type='button';button.className='quiz-option';const japanese=document.createElement('span');japanese.className='quiz-option-ja';japanese.lang='ja';japanese.innerHTML=(q.optionsJa&&q.optionsJa[index])||'';if(option){const english=document.createElement('span');english.className='quiz-option-en';english.textContent=option;button.appendChild(english);}if(japanese.innerHTML)button.appendChild(japanese);button.addEventListener('click',()=>{choices.querySelectorAll('button').forEach(choice=>choice.disabled=true);if(index===q.answerIndex){button.classList.add('correct');storyScore++;feedback.textContent='Correct! '+(q.explanation||'');feedback.classList.add('correct-text');}else{button.classList.add('incorrect');choices.children[q.answerIndex]?.classList.add('correct');feedback.textContent='Not quite. '+(q.explanation||'');feedback.classList.add('incorrect-text');}next.style.display='inline-flex';});choices.appendChild(button);});
    next.addEventListener('click',()=>{storyQuestionIndex++;renderMultiQuestionStory();});quiz.append(progress,questionJa,question,choices,feedback,next);root.appendChild(quiz);
  }

  function plainGrammar(value){
    return String(value||'').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/\[([ぁ-ゔァ-ヶー]+)\]/g,'').replace(/\s+/g,' ').trim();
  }
  function grammarHtml(value){
    let text=String(value||'').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ');
    text=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    return text.replace(/([\u3400-\u4dbf\u4e00-\u9fff々〆ヶ]+)\[([ぁ-ゔァ-ヶー]+)\]/g,'<ruby>$1<rt>$2</rt></ruby>');
  }
  function escapeGrammar(value){return String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
  function grammarFilteredEntries(){return grammarEntries.filter(e=>grammarLevel==='all'||e.level===grammarLevel);}
  function renderGrammarPage(){
    const loadingError=document.getElementById('grammar-load-error');
    loadingError.style.display=grammarEntries.length?'none':'block';
    if(!grammarEntries.length)loadingError.textContent=document.getElementById('built-in-loading').style.display==='none'?'Grammar could not be loaded. Check that json/grammar.json is available.':'Loading the grammar library…';
    document.querySelectorAll('[data-grammar-mode]').forEach(b=>b.classList.toggle('active',b.dataset.grammarMode===grammarMode));
    document.querySelectorAll('[data-grammar-level]').forEach(b=>b.classList.toggle('active',b.dataset.grammarLevel===grammarLevel));
    document.getElementById('grammar-level-filters').style.display=grammarMode==='compare'?'none':'flex';
    document.getElementById('grammar-learn-view').style.display=grammarMode==='learn'?'block':'none';
    document.getElementById('grammar-reference-view').style.display=grammarMode==='reference'?'block':'none';
    document.getElementById('grammar-compare-view').style.display=grammarMode==='compare'?'block':'none';
    document.getElementById('grammar-quiz-view').style.display=grammarMode==='quiz'?'block':'none';
    renderGrammarLesson();renderGrammarReference();renderGrammarComparisons();renderGrammarQuiz();
  }
  function grammarTopicEntries(){
    let options=grammarFilteredEntries();if(grammarTopicKey)options=options.filter(entry=>(entry.cat||entry.category)===grammarTopicKey);return options;
  }
  function currentGrammarLessonEntry(){return grammarTopicEntries()[grammarLessonIndex]||null;}
  function renderGrammarLesson(){
    const root=document.getElementById('grammar-learn-view');if(!root)return;
    const categories=grammarCategories.filter(category=>grammarLevel==='all'||category.level===grammarLevel);
    if(!categories.length){root.innerHTML='<p class="loading-note">Grammar topics are loading.</p>';return;}
    if(!categories.some(category=>category.key===grammarTopicKey)){grammarTopicKey=categories[0].key;grammarLessonIndex=0;}
    const entries=grammarTopicEntries();if(grammarLessonIndex>=entries.length)grammarLessonIndex=Math.max(0,entries.length-1);
    const entry=currentGrammarLessonEntry();if(!entry){root.innerHTML='<p class="loading-note">No patterns are available for this topic.</p>';return;}
    const examples=(entry.examples||[]).map(example=>`<article class="grammar-lesson-example"><p lang="ja">${grammarHtml(example.jp)}</p><span>${escapeGrammar(example.en)}</span></article>`).join('');
    const learned=grammarMastered.includes(entry.id);
    root.innerHTML=`<div class="grammar-topic-picker"><label for="grammar-topic-select">Choose a topic</label><select id="grammar-topic-select">${categories.map(category=>`<option value="${escapeGrammar(category.key)}" ${category.key===grammarTopicKey?'selected':''}>${escapeGrammar(category.label)}</option>`).join('')}</select></div><article class="grammar-lesson-card"><div class="grammar-lesson-meta"><span class="grammar-level-tag">${escapeGrammar(entry.level)}</span><span>${grammarLessonIndex+1} of ${entries.length} patterns</span></div><h3 lang="ja">${grammarHtml(entry.title)}</h3><p class="grammar-lesson-meaning">${grammarHtml(entry.meaning)}</p>${entry.formation?`<div class="grammar-formation"><b>How to form it</b><p>${grammarHtml(entry.formation)}</p></div>`:''}<div class="grammar-lesson-examples">${examples}</div>${entry.notes?`<p class="grammar-notes">${grammarHtml(entry.notes)}</p>`:''}<div class="grammar-lesson-actions"><button class="header-btn" data-lesson-action="previous" ${grammarLessonIndex===0?'disabled':''}>← Previous</button><button class="header-btn ${learned?'learned':''}" data-lesson-action="toggle-learned">${learned?'✓ Learned':'Mark learned'}</button><button class="deck-start" data-lesson-action="next" ${grammarLessonIndex+1>=entries.length?'disabled':''}>Next pattern →</button></div><button class="text-link grammar-practice-topic" data-lesson-action="practice-topic">Practise this topic →</button></article>`;
    const lookup=document.createElement('aside');lookup.className='word-lookup-panel';lookup.hidden=true;lookup.setAttribute('aria-live','polite');root.appendChild(lookup);activateWordLookups(root.querySelector('.grammar-lesson-examples'),lookup);
  }
  function renderGrammarReference(){
    const root=document.getElementById('grammar-reference-list');if(!root)return;
    const query=plainGrammar(document.getElementById('grammar-search').value).toLocaleLowerCase();
    const filtered=grammarFilteredEntries().filter(e=>!query||`${plainGrammar(e.title)} ${plainGrammar(e.meaning)} ${plainGrammar(e.formation)} ${(e.examples||[]).map(x=>plainGrammar(x.jp)+' '+plainGrammar(x.en)).join(' ')}`.toLocaleLowerCase().includes(query));
    if(!filtered.length){root.innerHTML=`<p class="loading-note">${grammarEntries.length?'No patterns match this search.':'The grammar list is loading.'}</p>`;return;}
    const groups=new Map();filtered.forEach(entry=>{if(!groups.has(entry.category||entry.cat))groups.set(entry.category||entry.cat,[]);groups.get(entry.category||entry.cat).push(entry);});
    root.innerHTML=Array.from(groups,([category,entries])=>`<section class="grammar-category"><div class="grammar-category-heading"><h3>${escapeGrammar(category)}</h3><span>${entries.length}</span></div>${entries.map(entry=>{
      const open=grammarOpenIds.has(entry.id),learned=grammarMastered.includes(entry.id);
      const examples=(entry.examples||[]).map(example=>`<div class="grammar-example"><div class="grammar-example-jp" lang="ja">${grammarHtml(example.jp)}</div><p>${escapeGrammar(example.en)}</p></div>`).join('');
      const notes=entry.notes?`<p class="grammar-notes">${grammarHtml(entry.notes)}</p>`:'';
      return `<article class="grammar-card ${open?'open':''}"><div class="grammar-card-top"><button type="button" class="grammar-card-title" data-grammar-toggle="${escapeGrammar(entry.id)}"><span class="grammar-level-tag">${escapeGrammar(entry.level)}</span><span class="grammar-pattern" lang="ja">${grammarHtml(entry.title)}</span><span class="grammar-meaning-short">${escapeGrammar(plainGrammar(entry.meaning).slice(0,150))}</span></button><button type="button" class="grammar-learn ${learned?'learned':''}" data-grammar-learn="${escapeGrammar(entry.id)}" aria-label="${learned?'Mark not learned':'Mark learned'}">${learned?'✓':'○'}</button></div>${open?`<div class="grammar-card-body"><p>${grammarHtml(entry.meaning)}</p>${entry.formation?`<p class="grammar-formation"><b>Formation:</b> ${grammarHtml(entry.formation)}</p>`:''}${examples}${notes}</div>`:''}</article>`;
    }).join('')}</section>`).join('');
  }
  function renderGrammarComparisons(){
    const root=document.getElementById('grammar-comparison-list');if(!root)return;
    root.innerHTML=grammarComparisons.length?grammarComparisons.map(item=>`<article class="grammar-compare-card"><h3 lang="ja">${grammarHtml(item.patterns)}</h3><p>${grammarHtml(item.difference)}</p><div class="grammar-compare-example" lang="ja">${grammarHtml(item.example)}</div></article>`).join(''):'<p class="loading-note">No comparison notes are available.</p>';
  }
  function grammarShortMeaning(entry){return plainGrammar(entry.meaning).split(/(?<=[.!?。])\s/)[0].slice(0,125)||entry.category;}
  function shuffleGrammar(items){const copy=items.slice();for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}
  function createGrammarQuestion(entry,pool){
    const askMeaning=Math.random()<.5;const answer=askMeaning?grammarShortMeaning(entry):entry.title;
    const labels=pool.filter(other=>other.id!==entry.id).map(other=>askMeaning?grammarShortMeaning(other):other.title);
    const unique=Array.from(new Set(labels.filter(label=>label&&label!==answer)));
    const options=shuffleGrammar([answer,...shuffleGrammar(unique).slice(0,3)]);return {entry,askMeaning,options,correctIndex:options.indexOf(answer)};
  }
  function startGrammarQuiz(count,topicPool=null){
    const pool=grammarFilteredEntries();if(!pool.length)return;
    const chosen=shuffleGrammar(topicPool&&topicPool.length?topicPool:pool).slice(0,Math.min(count,topicPool&&topicPool.length?topicPool.length:pool.length));
    grammarQuiz={phase:'active',questions:chosen.map(entry=>createGrammarQuestion(entry,pool)),index:0,correct:0,answered:false,selected:-1};renderGrammarQuiz();
  }
  function renderGrammarQuiz(){
    const root=document.getElementById('grammar-quiz-view');if(!root)return;
    if(!grammarEntries.length){root.innerHTML='';return;}
    if(grammarQuiz.phase==='setup'){
      root.innerHTML=`<div class="grammar-quiz-card"><h3>Practice grammar</h3><p>Answer short questions about patterns and meanings. Choose a size for a mixed review of ${grammarLevel==='all'?'all levels':escapeGrammar(grammarLevel)}.</p><div class="grammar-quiz-counts">${[5,10,15].map(n=>`<button type="button" class="header-btn" data-grammar-start="${n}">${n} questions</button>`).join('')}</div>${grammarTopicKey?`<button type="button" class="deck-start" data-grammar-topic-practice>Practice ${escapeGrammar((grammarCategories.find(category=>category.key===grammarTopicKey)||{}).label||'this topic')}</button>`:''}</div>`;return;
    }
    if(grammarQuiz.phase==='result'){
      root.innerHTML=`<div class="grammar-quiz-card grammar-quiz-result"><span class="grammar-level-tag">${escapeGrammar(grammarLevel==='all'?'Mixed levels':grammarLevel)}</span><h3>Quiz complete</h3><p>You got <b>${grammarQuiz.correct} of ${grammarQuiz.questions.length}</b> correct.</p><button type="button" class="deck-start" data-grammar-restart>Try another quiz</button></div>`;return;
    }
    const q=grammarQuiz.questions[grammarQuiz.index],answerLabel=i=>q.askMeaning?escapeGrammar(q.options[i]):grammarHtml(q.options[i]);
    const choices=q.options.map((label,i)=>{let cls='grammar-quiz-choice';if(grammarQuiz.answered){if(i===q.correctIndex)cls+=' correct';else if(i===grammarQuiz.selected)cls+=' incorrect';}return `<button type="button" class="${cls}" data-grammar-choice="${i}" ${grammarQuiz.answered?'disabled':''}>${answerLabel(i)}</button>`;}).join('');
    const progress=Math.round(grammarQuiz.index/grammarQuiz.questions.length*100);
    const feedback=grammarQuiz.answered?`<div class="grammar-quiz-feedback ${grammarQuiz.selected===q.correctIndex?'correct':'incorrect'}"><b>${grammarQuiz.selected===q.correctIndex?'Correct!':'Not quite.'}</b> ${grammarHtml(q.entry.meaning)}${q.entry.formation?`<br><b>Formation:</b> ${grammarHtml(q.entry.formation)}`:''}${q.entry.examples?.length?`<br><span lang="ja">${grammarHtml(q.entry.examples[0].jp)}</span> — ${escapeGrammar(q.entry.examples[0].en)}`:''}</div><button type="button" class="deck-start" data-grammar-next>${grammarQuiz.index+1===grammarQuiz.questions.length?'See result':'Next question'} →</button>`:'';
    root.innerHTML=`<div class="grammar-quiz-card"><div class="grammar-quiz-progress"><span>${grammarQuiz.index+1} / ${grammarQuiz.questions.length}</span><div><i style="width:${progress}%"></i></div></div><p class="eyebrow">${q.askMeaning?'WHAT DOES THIS PATTERN MEAN?':'WHICH PATTERN MATCHES THIS MEANING?'}</p><h3 class="grammar-quiz-prompt" ${q.askMeaning?'lang="ja"':''}>${q.askMeaning?grammarHtml(q.entry.title):escapeGrammar(grammarShortMeaning(q.entry))}</h3><div class="grammar-quiz-choices">${choices}</div>${feedback}</div>`;
  }

  function rebuildKanjiTargets(){
    const byCharacter=new Map();
    sheetCandidates.forEach(deck=>deck.cards.forEach(card=>{
      const word=card.kanji||card.front||'';
      for(const character of Array.from(word)){
        if(!/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(character))continue;
        const existing=byCharacter.get(character);
        if(existing) existing.count++;
        else byCharacter.set(character,{character,count:1,reading:card.furigana||'',meaning:card.meaning||'',word,deck:deck.name});
      }
    }));
    kanjiTargets=Array.from(byCharacter.values()).sort((a,b)=>b.count-a.count||a.character.localeCompare(b.character,'ja'));
  }

  function renderKanjiPicker(){
    rebuildKanjiTargets();updateReviewSummary();
    const list=document.getElementById('kanji-list');
    const search=document.getElementById('kanji-search');
    if(!list||!search)return;
    const query=search.value.trim().toLocaleLowerCase();
    list.innerHTML='';
    const matches=kanjiTargets.filter(item=>`${item.character} ${item.reading} ${item.meaning} ${item.word}`.toLocaleLowerCase().includes(query));
    if(!matches.length){
      const empty=document.createElement('p'); empty.className='loading-note';
      empty.textContent=kanjiTargets.length?'No kanji match that search.':'Kanji will appear here when the study library has loaded.';
      list.appendChild(empty);return;
    }
    matches.forEach(item=>{
      const button=document.createElement('button');button.type='button';button.className='kanji-choice';
      const glyph=document.createElement('span');glyph.className='kanji-choice-glyph';glyph.lang='ja';glyph.textContent=item.character;
      const reading=document.createElement('span');reading.className='kanji-choice-reading';reading.lang='ja';reading.textContent=item.reading;
      const meaning=document.createElement('span');meaning.className='kanji-choice-meaning';meaning.textContent=item.meaning;
      button.append(glyph,reading,meaning);button.addEventListener('click',()=>openKanjiPractice(kanjiTargets.indexOf(item)));
      list.appendChild(button);
    });
  }

  function openKanjiPractice(index){
    if(index<0||index>=kanjiTargets.length)return;
    activeKanjiIndex=index;
    const item=kanjiTargets[index];
    document.getElementById('kanji-practice-character').textContent=item.character;
    document.getElementById('kanji-practice-reading').textContent=item.reading?`Reading in this word: ${item.reading}`:'';
    document.getElementById('kanji-practice-meaning').textContent=item.meaning;
    document.getElementById('kanji-practice-context').textContent=`From ${item.word} · ${item.deck}`;
    document.getElementById('kanji-practice-character').style.display='';
    document.getElementById('kanji-practice-context').style.display='';
    document.getElementById('kanji-continue-round').style.display='none';
    document.getElementById('kanji-status').textContent='Loading Japanese stroke-order guide…';
    document.getElementById('kanji-retry').disabled=true;
    document.getElementById('kanji-show-order').disabled=true;
    setPage('kanji-practice');
    loadKanjiGuide(item);
  }

  async function loadKanjiGuide(item){
    activeKanjiSvg=null;kanjiDrawing=null;kanjiStrokesDone=0;kanjiAnimating=false;
    const character=item.character;
    const hex=character.codePointAt(0).toString(16).padStart(5,'0');
    const status=document.getElementById('kanji-status');
    try{
      const response=await fetch(`https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/${hex}.svg`);
      if(!response.ok)throw new Error('No stroke-order data for this character');
      const sourceText=await response.text();
      const source=new DOMParser().parseFromString(sourceText,'image/svg+xml');
      if(source.querySelector('parsererror'))throw new Error('Invalid stroke guide data');
      const sourceSvg=source.documentElement;
      const viewBox=sourceSvg.getAttribute('viewBox')||'0 0 109 109';
      const parts=viewBox.split(/[ ,]+/).map(Number);
      const vb={x:parts[0]||0,y:parts[1]||0,width:parts[2]||109,height:parts[3]||109};
      const svgGroups=Array.from(sourceSvg.getElementsByTagName('g'));
      const rootKanjiGroup=svgGroups.find(group=>group.getAttribute('kvg:element')===character)||null;
      const sourcePaths=Array.from(sourceSvg.querySelectorAll('path[id]'))
        .map(path=>{
          let child=path;
          while(rootKanjiGroup&&child.parentElement&&child.parentElement!==rootKanjiGroup)child=child.parentElement;
          const component= rootKanjiGroup&&child.parentElement===rootKanjiGroup&&child!==path
            ? (child.getAttribute('kvg:element')||child.getAttribute('id')||null) : null;
          return {path,num:Number((path.id.match(/-s(\d+)$/)||[])[1]),component};
        })
        .filter(item=>Number.isFinite(item.num)).sort((a,b)=>a.num-b.num);
      if(!sourcePaths.length)throw new Error('No strokes found for this character');
      const host=document.getElementById('kanji-drawing');host.innerHTML='';
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox',viewBox);svg.setAttribute('role','img');svg.setAttribute('aria-label',`Draw ${character} in stroke order`);svg.classList.add('kanji-guide-svg');
      const paths=[];const guideColor=getComputedStyle(document.documentElement).getPropertyValue('--ink-soft').trim()||'#777';
      sourcePaths.forEach(({path,num,component})=>{
        const guide=document.createElementNS('http://www.w3.org/2000/svg','path');
        guide.setAttribute('d',path.getAttribute('d'));guide.setAttribute('data-stroke',String(num));
        guide.setAttribute('fill','none');guide.setAttribute('stroke',guideColor);guide.setAttribute('stroke-width','2.7');
        guide.setAttribute('stroke-linecap','round');guide.setAttribute('stroke-linejoin','round');guide.style.opacity='.3';
        svg.appendChild(guide);paths.push({element:guide,num,component});
      });
      const ink=document.createElementNS('http://www.w3.org/2000/svg','g');ink.classList.add('kanji-user-ink');svg.appendChild(ink);host.appendChild(svg);
      paths.forEach(item=>{
        const path=item.element,length=path.getTotalLength();
        if(!length)throw new Error('Could not read the stroke path');
        item.length=length;
        item.samples=[];
        const steps=Math.max(18,Math.ceil(length/2));
        for(let i=0;i<=steps;i++){
          const point=path.getPointAtLength(length*i/steps);
          item.samples.push({x:point.x,y:point.y});
        }
      });
      activeKanjiSvg={svg,paths,ink,vb,character,missingStrokeIndices:[],expectedStrokeIndices:[],hideAllGuides:false};kanjiStrokeCount=paths.length;
      setKanjiRound(0);
      document.getElementById('kanji-retry').disabled=false;
      document.getElementById('kanji-retry').textContent='Restart round';
      document.getElementById('kanji-show-order').disabled=false;
      attachKanjiDrawingInput(host,svg);
    }catch(error){
      status.textContent='Could not load the Japanese stroke guide. Check your internet connection and try again.';
      document.getElementById('kanji-retry').disabled=false;
      document.getElementById('kanji-retry').textContent='Retry loading';
    }
  }

  function attachKanjiDrawingInput(host,svg){
    host.onpointerdown=(event)=>{
      if(!activeKanjiSvg||kanjiAnimating||kanjiStrokesDone>=kanjiExpectedStrokes.length||event.button!==0)return;
      event.preventDefault();host.setPointerCapture(event.pointerId);
      const point=kanjiPointFromEvent(event,svg,activeKanjiSvg.vb);
      kanjiDrawing={pointerId:event.pointerId,points:[point],polyline:document.createElementNS('http://www.w3.org/2000/svg','polyline')};
      const poly=kanjiDrawing.polyline;poly.setAttribute('fill','none');poly.setAttribute('stroke',getComputedStyle(document.documentElement).getPropertyValue('--seal').trim());
      poly.setAttribute('stroke-width','2.6');poly.setAttribute('stroke-linecap','round');poly.setAttribute('stroke-linejoin','round');poly.setAttribute('vector-effect','non-scaling-stroke');
      activeKanjiSvg.ink.appendChild(poly);updateKanjiPolyline();
    };
    host.onpointermove=(event)=>{
      if(!kanjiDrawing||event.pointerId!==kanjiDrawing.pointerId)return;
      event.preventDefault();const point=kanjiPointFromEvent(event,svg,activeKanjiSvg.vb);
      const last=kanjiDrawing.points[kanjiDrawing.points.length-1];
      if(Math.hypot(point.x-last.x,point.y-last.y)>0.7){kanjiDrawing.points.push(point);updateKanjiPolyline();}
    };
    host.onpointerup=(event)=>{
      if(!kanjiDrawing||event.pointerId!==kanjiDrawing.pointerId)return;
      event.preventDefault();const drawing=kanjiDrawing;kanjiDrawing=null;
      checkKanjiStroke(drawing);
    };
    host.onpointercancel=()=>{if(kanjiDrawing){kanjiDrawing.polyline.remove();kanjiDrawing=null;}};
  }

  function kanjiPointFromEvent(event,svg,vb){
    const rect=svg.getBoundingClientRect();
    return {x:vb.x+(event.clientX-rect.left)/rect.width*vb.width,y:vb.y+(event.clientY-rect.top)/rect.height*vb.height};
  }
  function updateKanjiPolyline(){
    if(!kanjiDrawing)return;
    kanjiDrawing.polyline.setAttribute('points',kanjiDrawing.points.map(point=>`${point.x},${point.y}`).join(' '));
  }
  function pointSegmentDistance(point,a,b){
    const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
    const t=den?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/den)):0;
    return Math.hypot(point.x-(a.x+t*dx),point.y-(a.y+t*dy));
  }
  function checkKanjiStroke(drawing){
    const status=document.getElementById('kanji-status');
    const pathIndex=kanjiExpectedStrokes[kanjiStrokesDone];
    const expected=activeKanjiSvg.paths[pathIndex];
    if(!expected)return;
    const points=drawing.points,target=expected.samples;
    let userTotal=0;for(let i=1;i<points.length;i++)userTotal+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
    const nearest=(point,others)=>Math.min(...others.map(other=>Math.hypot(point.x-other.x,point.y-other.y)));
    const userError=points.reduce((sum,point)=>sum+nearest(point,target),0)/Math.max(points.length,1);
    const coverageError=target.reduce((sum,point)=>sum+Math.min(...points.slice(1).map((end,i)=>pointSegmentDistance(point,points[i],end))),0)/target.length;
    const startError=Math.hypot(points[0].x-target[0].x,points[0].y-target[0].y);
    const endError=Math.hypot(points[points.length-1].x-target[target.length-1].x,points[points.length-1].y-target[target.length-1].y);
    const correct=userTotal>3&&userError<10&&coverageError<13&&startError<17&&endError<17;
    if(!correct){
      drawing.polyline.remove();
      expected.element.classList.add('kanji-current-stroke');
      window.setTimeout(()=>expected.element.classList.remove('kanji-current-stroke'),900);
      status.textContent=`Not quite. Try stroke ${kanjiStrokesDone+1} again, following its direction.`;
      return;
    }
    drawing.polyline.remove();
    expected.element.classList.remove('kanji-current-stroke');
    kanjiStrokesDone++;
    expected.element.setAttribute('stroke','#FFFFFF');
    expected.element.classList.add('kanji-completed-stroke');
    expected.element.setAttribute('stroke-width','3.8');
    expected.element.style.opacity='1';
    if(kanjiStrokesDone===kanjiExpectedStrokes.length){
      status.textContent=`Round ${kanjiRoundIndex+1} complete! All required strokes were in order.`;
      status.classList.add('is-complete');
      const advance=document.getElementById('kanji-continue-round');
      advance.textContent=kanjiRoundIndex<3?['Next: Missing strokes →','Next: Missing component →','Final round: Memory →'][kanjiRoundIndex]:'Choose another kanji →';
      advance.style.display='inline-flex';
    }else{
      const nextPath=activeKanjiSvg.paths[kanjiExpectedStrokes[kanjiStrokesDone]];
      status.textContent=`Good! Draw required stroke ${kanjiStrokesDone+1} of ${kanjiExpectedStrokes.length} (stroke ${nextPath.num} of ${kanjiStrokeCount}).`;
    }
  }
  function pickSpacedStrokes(count,total){
    const amount=Math.max(1,Math.min(total,count));const result=[];
    for(let i=0;i<amount;i++)result.push(Math.floor((i+1)*total/(amount+1)));
    return Array.from(new Set(result));
  }
  function chooseComponentStrokes(){
    const groups=new Map();
    activeKanjiSvg.paths.forEach((path,index)=>{
      if(path.component){if(!groups.has(path.component))groups.set(path.component,[]);groups.get(path.component).push(index);}
    });
    const candidates=Array.from(groups.values()).filter(indices=>indices.length<kanjiStrokeCount);
    if(candidates.length>1){
      const target=Math.max(1,Math.round(kanjiStrokeCount*.4));
      candidates.sort((a,b)=>Math.abs(a.length-target)-Math.abs(b.length-target));
      return candidates[0];
    }
    const amount=Math.max(1,Math.ceil(kanjiStrokeCount*.4));
    const first=Math.max(0,Math.floor((kanjiStrokeCount-amount)/2));
    return Array.from({length:amount},(_,i)=>first+i);
  }
  function setKanjiRound(roundIndex){
    if(!activeKanjiSvg)return;
    kanjiRoundIndex=roundIndex;kanjiStrokesDone=0;kanjiDrawing=null;kanjiAnimating=false;
    const total=kanjiStrokeCount,all=Array.from({length:total},(_,i)=>i);
    let missing=[];
    if(roundIndex===1)missing=pickSpacedStrokes(Math.ceil(total*.25),total);
    if(roundIndex===2)missing=chooseComponentStrokes();
    if(roundIndex===3)missing=all.slice();
    activeKanjiSvg.missingStrokeIndices=missing;
    activeKanjiSvg.hideAllGuides=roundIndex===3;
    kanjiExpectedStrokes=(roundIndex===1||roundIndex===2)?missing:all;
    activeKanjiSvg.expectedStrokeIndices=kanjiExpectedStrokes;
    const names=['Shadow guide','Missing strokes','Missing component','Memory'];
    const instructions=[
      'Trace the full shadow, one stroke at a time, in order.',
      `Some strokes are hidden. Complete the ${missing.length} missing strokes in order.`,
      `One component is hidden. Draw its ${missing.length} strokes in order.`,
      'No kanji, reading, meaning, or source word is shown. Write it from memory.'
    ];
    document.getElementById('kanji-practice-label').textContent=roundIndex===3?'WRITE FROM MEMORY':'WRITE THIS KANJI';
    document.getElementById('kanji-round-label').textContent=`ROUND ${roundIndex+1} OF 4 · ${names[roundIndex]}`;
    document.getElementById('kanji-instruction').textContent=instructions[roundIndex];
    ['kanji-practice-character','kanji-practice-reading','kanji-practice-meaning','kanji-practice-context'].forEach(id=>{document.getElementById(id).style.display=roundIndex===3?'none':'';});
    document.getElementById('kanji-continue-round').style.display='none';
    document.getElementById('kanji-retry').textContent='Restart round';
    document.getElementById('kanji-show-order').disabled=false;
    document.getElementById('kanji-show-order').style.display=roundIndex===3?'none':'';
    resetKanjiDrawing();
  }
  function resetKanjiDrawing(){
    if(!activeKanjiSvg)return;
    kanjiStrokesDone=0;kanjiDrawing=null;kanjiAnimating=false;
    activeKanjiSvg.ink.replaceChildren();
    const missing=new Set(activeKanjiSvg.missingStrokeIndices);
    activeKanjiSvg.paths.forEach((path,index)=>{
      path.element.setAttribute('stroke',getComputedStyle(document.documentElement).getPropertyValue('--ink-soft').trim());
      path.element.setAttribute('stroke-width','2.7');
      path.element.style.opacity=activeKanjiSvg.hideAllGuides||missing.has(index)?'0':'.3';
      path.element.style.stroke='';path.element.style.filter='';
      path.element.style.strokeDasharray='';path.element.style.strokeDashoffset='';path.element.classList.remove('kanji-current-stroke','kanji-completed-stroke');
    });
    const status=document.getElementById('kanji-status');status.classList.remove('is-complete');
    const firstPath=activeKanjiSvg.paths[kanjiExpectedStrokes[0]];
    if(kanjiRoundIndex===1)status.textContent=`Draw missing stroke 1 of ${kanjiExpectedStrokes.length} (stroke ${firstPath.num} of ${kanjiStrokeCount}).`;
    else if(kanjiRoundIndex===2)status.textContent=`Draw the missing component: stroke 1 of ${kanjiExpectedStrokes.length} (stroke ${firstPath.num} of ${kanjiStrokeCount}).`;
    else status.textContent=`Draw stroke 1 of ${kanjiExpectedStrokes.length}. Follow the order.`;
    document.getElementById('kanji-continue-round').style.display='none';
  }
  async function showKanjiStrokeOrder(){
    if(!activeKanjiSvg||kanjiAnimating)return;
    kanjiAnimating=true;const button=document.getElementById('kanji-show-order');button.disabled=true;
    const status=document.getElementById('kanji-status');status.classList.remove('is-complete');
    status.textContent='Watch the Japanese stroke order…';
    for(const index of kanjiExpectedStrokes){
      const item=activeKanjiSvg.paths[index],path=item.element;
      path.style.opacity='1';path.style.stroke='#FFFFFF';path.style.filter='drop-shadow(0 0 1px rgba(0,0,0,.9))';
      path.style.strokeDasharray=String(item.length);path.style.strokeDashoffset=String(item.length);
      const animation=path.animate([{strokeDashoffset:item.length},{strokeDashoffset:0}],{duration:360,easing:'linear'});
      await animation.finished;
      path.style.strokeDasharray='';path.style.strokeDashoffset='';
    }
    kanjiAnimating=false;button.disabled=false;resetKanjiDrawing();
  }

  function loadWorkbook(wb, options={}){
    const candidates = [];
    hintSheets = [];
    wb.SheetNames.forEach(name=>{
      if(/^\s*hints?(\b|[^a-z])/i.test(name)){
        const h = hintFromSheet(wb.Sheets[name], name);
        if(h) hintSheets.push(h);
        return;
      }
      if(name === 'Recognition - Active') return;
      const result = cardsFromSheet(wb.Sheets[name]);
      if(result && result.cards.length) candidates.push({name, cards: result.cards, debug: result.debug});
    });
    if(!candidates.length){
      showError("Couldn't find a usable sheet. Make sure a header row has columns like Kanji, Furigana, Romaji, Meaning, Group, with data below it.");
      return;
    }
    sheetCandidates = candidates;
    window.__lastDebug = candidates.map(c => ({sheet:c.name, ...c.debug}));
    document.getElementById('built-in-loading').style.display='none';
    rebuildKanjiTargets();renderDeckPicker(); renderHome(); renderReadingList(); renderKanjiPicker();
    if(options.custom) setPage('flashcards');
    else setPage('home');
  }

  async function loadBuiltInDatabase(){
    const dropzone = document.getElementById('dropzone');
    const loading = document.getElementById('built-in-loading');
    try{
      const [databaseResponse, hintsResponse, readingsResponse, grammarResult, kanaResult] = await Promise.all([
        fetch('json/database.json'), fetch('json/hints.json'), fetch('json/readings.json'),
        fetch('json/grammar.json').then(response=>response.ok?response.json():null).catch(()=>null),
        fetch('json/kana.json').then(response=>response.ok?response.json():null).catch(()=>null)
      ]);
      if(!databaseResponse.ok || !hintsResponse.ok || !readingsResponse.ok) throw new Error('Could not fetch the built-in data files');
      const [database, hintDatabase, readingData] = await Promise.all([databaseResponse.json(), hintsResponse.json(), readingsResponse.json()]);
      readingStories = Array.isArray(readingData.stories) ? readingData.stories : [];
      buildKanaDecks(kanaResult);
      grammarEntries = grammarResult && Array.isArray(grammarResult.entries) ? grammarResult.entries : [];
      grammarCategories = grammarResult && Array.isArray(grammarResult.categories) ? grammarResult.categories : [];
      grammarComparisons = grammarResult && Array.isArray(grammarResult.comparisons) ? grammarResult.comparisons : [];
      renderReadingList();renderGrammarPage();
      loadWorkbook(workbookFromDatabase(database, hintDatabase));
    }catch(err){
      if(loading){ loading.textContent = 'The built-in decks could not load. Start a local web server or choose an Excel file below.'; }
      if(dropzone) dropzone.style.display = 'flex';
      showError('Could not load the built-in vocabulary database.');
    }
  }

  function handleFile(file){
    clearError();
    const reader = new FileReader();
    reader.onload = function(e){
      try{
        const data = new Uint8Array(e.target.result);
        loadWorkbook(XLSX.read(data, {type:'array'}), {custom:true});
      }catch(err){
        showError("Couldn't read that file. Please upload a valid .xlsx, .xls, or .csv export.");
      }
    };
    reader.onerror = function(){ showError('There was a problem reading the file.'); };
    reader.readAsArrayBuffer(file);
  }

  function startStudy(){
    isKanaDeck=allCards.length>0&&allCards.every(card=>card.isKana);
    setPage('study');
    deckCount.textContent = allCards.length + ' cards loaded';
    document.getElementById('tabs-btn').style.display = 'inline-block';
    document.getElementById('study-title').textContent = currentSheetName;
    mode = 'cards';
    document.getElementById('settings').style.display = 'none';
    document.getElementById('settings-btn').setAttribute('aria-expanded', 'false');
    document.getElementById('settings-caret').textContent = '▾';
    document.getElementById('cheat').style.display = 'none';
    formLabels = collectFormLabels(allCards);
    buildSettings();
    buildGroupChips();
    setGroup(isKanaDeck?'Basic':'All');
  }

  function buildGroupChips(){
    const groups = ['All', ...Array.from(new Set(allCards.map(c=>c.group))).sort()];
    const el = document.getElementById('groups');
    el.innerHTML = '';
    groups.forEach(g=>{
      const btn = document.createElement('button');
      btn.className = 'chip' + (g===activeGroup ? ' active' : '');
      btn.textContent = g === 'All' ? `All (${allCards.length})` : `${g} (${allCards.filter(c=>c.group===g).length})`;
      btn.onclick = ()=> setGroup(g);
      el.appendChild(btn);
    });
  }

  // ---------- Conjugation drill ----------
  // A "form" column is any extra column that isn't descriptive info like Type or Notes.
  const NOT_A_FORM = /type|note|example|speech|recognition|active|source|group/i;
  function formsFor(c){
    return (c.extras || []).filter(x => !NOT_A_FORM.test(x.label));
  }
  function eligibleForms(c){
    return formsFor(c).filter(x => isFormOn(x.label));
  }
  function levelsPresent(){
    const order = ['N5','N4','N3','Other'];
    return order.filter(lv => formLabels.some(l => levelOf(l) === lv));
  }
  function collectFormLabels(cards){
    const seen = [];
    cards.forEach(c => formsFor(c).forEach(x => { if(!seen.includes(x.label)) seen.push(x.label); }));
    return seen;
  }
  // Plain-English names for the grammar labels used in the spreadsheet
  const FORM_INFO = {
    // verbs
    'ます':{key:'masu',level:'N5',order:1,label:'ます - Polite',long:'Polite · present · positive'},
    'ない':{key:'nai',level:'N5',order:2,label:'ない - Negative',long:'Casual · present · negative'},
    'て':{key:'te',level:'N5',order:3,label:'て-form / connect',long:'て-form (linking / requests)'},
    'た':{key:'ta',level:'N5',order:4,label:'た - Past',long:'Casual · past · positive'},
    'なかった':{key:'nakatta',level:'N5',order:5,label:'なかった - Past negative',long:'Casual · past · negative'},
    'Potential':{key:'pot',level:'N4',order:10,label:'Potential (can / be able to)',long:'Potential (can do…)'},
    'Volitional':{key:'vol',level:'N4',order:11,label:"Volitional (let's / I'll)",long:"Volitional (let's… / I will…)"},
    'ば':{key:'ba',level:'N4',order:12,label:'ば-form (if…)',long:'Conditional ば (if…)'},
    'たら':{key:'tara',level:'N4',order:13,label:'たら-form (if / when…)',long:'Conditional たら (if / when…)'},
    'なければ':{key:'nakereba',level:'N4',order:14,label:'なければ (if not… / must…)',long:'Negative conditional (if not… / must…)'},
    'なかったら':{key:'nakattara',level:'N4',order:15,label:"なかったら (if… didn't…)",long:"Negative たら (if I didn't…)"},
    'なさい':{key:'nasai',level:'N4',order:16,label:'なさい (do… / command)',long:'Gentle command (…なさい)'},
    'Imperative':{key:'imp',level:'N4',order:17,label:'Imperative (command!)',long:'Imperative (blunt command)'},
    'Passive':{key:'pass',level:'N3',order:20,label:'Passive (be done to)',long:'Passive (be …ed)'},
    'Causative':{key:'caus',level:'N3',order:21,label:'Causative (make / let someone do)',long:'Causative (make / let someone do)'},
    'Causative-passive':{key:'cpass',level:'N3',order:22,label:'Causative-passive (be made to do)',long:'Causative-passive (be made to do)'},
    'ず':{key:'zu',level:'N3',order:23,label:'ず (without / not doing)',long:'ず-form (formal negative)'},
    'ずに':{key:'zuni',level:'N3',order:24,label:'ずに (without doing)',long:'ずに ("without doing")'},
    'ぬ':{key:'nu',level:'N3',order:25,label:'ぬ (not / never)',long:'ぬ (formal / literary negative)'},
    'ん':{key:'n',level:'N3',order:26,label:'ん (casual negative)',long:'ん (casual spoken negative)'},
    // い-adjectives
    'く':{key:'ku',level:'N5',order:1,label:'く - Adverb',long:'Adverb form'},
    'くて':{key:'kute',level:'N5',order:2,label:'くて - Linking (and…)',long:'Linking form (…and…)'},
    'かった':{key:'katta',level:'N5',order:3,label:'かった - Past',long:'Casual · past · positive'},
    'くない':{key:'kunai',level:'N5',order:4,label:'くない - Negative',long:'Casual · present · negative'},
    'くなかった':{key:'kunakatta',level:'N5',order:5,label:'くなかった - Past negative',long:'Casual · past · negative'},
    // な-adjectives
    'に':{key:'ni',level:'N5',order:1,label:'に - Adverb',long:'Adverb form'},
    'で':{key:'de',level:'N5',order:2,label:'で - Linking (and…)',long:'Linking form (…and…)'},
    'です':{key:'desu',level:'N5',order:3,label:'です - Polite',long:'Polite · present · positive'},
    'だった':{key:'datta',level:'N5',order:4,label:'だった - Past',long:'Casual · past · positive'},
    'じゃない':{key:'janai',level:'N5',order:5,label:'じゃない - Negative',long:'Casual · present · negative'},
    'じゃなかった':{key:'janakatta',level:'N5',order:6,label:'じゃなかった - Past negative',long:'Casual · past · negative'}
  };
  function infoFor(label){ return FORM_INFO[normForm(label)] || null; }
  function labelText(label){ const i = infoFor(label); return i ? i.label : label; }
  function levelOf(label){ const i = infoFor(label); return i ? i.level : 'Other'; }
  function formOrder(label){ const i = infoFor(label); return i ? i.order : -1; }
  function promptFor(label){
    const i = infoFor(label);
    if(i) return i.long;
    return /form/i.test(label) ? label + '?' : label + ' form?';
  }
  function shortPromptFor(label){
    const i = infoFor(label);
    if(!i) return promptFor(label);
    const inParens = i.label.match(/\(([^()]*)\)\s*$/);
    if(inParens) return inParens[1];
    const afterDash = i.label.match(/\s[-–]\s(.+)$/);
    if(afterDash) return afterDash[1];
    return i.long.replace(/^[\u3040-\u30ff\u4e00-\u9fff]+(?:-form)?\s*/i, '').replace(/^\((.*)\)$/, '$1') || i.long;
  }
  function drillPromptParts(label){
    const raw = String(label || '').trim();
    const info = infoFor(label);
    let japanese = normForm(label);
    let english = '';
    const rawPair = raw.match(/^(.+?)\s[-–—]\s*(.+)$/);
    if(rawPair){ japanese = rawPair[1].trim(); english = rawPair[2].trim(); }
    if(!english && info){
      const infoPair = info.label.match(/^(.+?)\s[-–—]\s*(.+)$/);
      if(infoPair){ japanese = infoPair[1].trim(); english = infoPair[2].trim(); }
      else{
        const descriptor = info.label.replace(/\s*\([^()]*\)\s*$/, '').trim();
        english = descriptor
          .replace(/^[\u3040-\u30ff\u4e00-\u9fff]+(?:-form)?\s*/i, '')
          .replace(/^[-–—/:\s]+/, '').trim();
        if(!english){
          english = info.long.replace(/\s*\([^()]*\)\s*$/, '')
            .replace(/[\u3040-\u30ff\u4e00-\u9fff]+/g, ' ')
            .replace(/-?form/ig, ' ').replace(/[·:]+/g, ' ').replace(/\s+/g, ' ').trim();
        }
        if(!english){
          const parenthetical = info.label.match(/\(([^()]*)\)/);
          english = parenthetical ? parenthetical[1].trim() : 'Form';
        }
      }
    }
    english = english.replace(/\s*\([^()]*\)\s*$/, '').trim();
    if(!english) english = raw.replace(/^[\u3040-\u30ff\u4e00-\u9fff]+(?:-form)?\s*/i, '').trim() || 'Form';
    if(!/\bform\b/i.test(english)) english += ' form';
    english = english.charAt(0).toUpperCase() + english.slice(1);
    return { japanese, english };
  }
  function setDrillPrompt(el, label){
    const parts = drillPromptParts(label);
    el.textContent = settings.showFormLabel ? parts.japanese + ' - ' + parts.english : parts.english;
  }
  // ---------- Romaji typing: English letters turn into hiragana as you type ----------
  const ROMAJI = (function(){
    const T = {};
    const rows = {
      '':'あいうえお', k:'かきくけこ', s:'さしすせそ', t:'たちつてと', n:'なにぬねの', h:'はひふへほ',
      m:'まみむめも', r:'らりるれろ', g:'がぎぐげご', z:'ざじずぜぞ', d:'だぢづでど', b:'ばびぶべぼ', p:'ぱぴぷぺぽ'
    };
    const vowels = ['a','i','u','e','o'];
    Object.keys(rows).forEach(c => vowels.forEach((v,i) => { T[c+v] = rows[c][i]; }));
    T.ya='や'; T.yu='ゆ'; T.yo='よ'; T.wa='わ'; T.wo='を';
    // small kana
    ['x','l'].forEach(x => {
      vowels.forEach((v,i) => { T[x+v] = 'ぁぃぅぇぉ'[i]; });
      T[x+'ya']='ゃ'; T[x+'yu']='ゅ'; T[x+'yo']='ょ'; T[x+'tu']='っ'; T[x+'tsu']='っ'; T[x+'wa']='ゎ';
    });
    // alternative spellings
    Object.assign(T, { shi:'し', chi:'ち', tsu:'つ', fu:'ふ', ji:'じ',
      sha:'しゃ', shu:'しゅ', sho:'しょ', she:'しぇ', cha:'ちゃ', chu:'ちゅ', cho:'ちょ', che:'ちぇ',
      ja:'じゃ', ju:'じゅ', jo:'じょ', je:'じぇ',
      fa:'ふぁ', fi:'ふぃ', fe:'ふぇ', fo:'ふぉ', '-':'ー' });
    // combos like kya, gyu, ryo
    const combo = { k:'き', g:'ぎ', n:'に', h:'ひ', b:'び', p:'ぴ', m:'み', r:'り', s:'し', z:'じ', t:'ち', d:'ぢ' };
    Object.keys(combo).forEach(c => {
      T[c+'ya'] = combo[c]+'ゃ'; T[c+'yu'] = combo[c]+'ゅ'; T[c+'yo'] = combo[c]+'ょ';
    });
    return T;
  })();
  function romajiToKana(str, final){
    str = String(str).toLowerCase();
    const isVowel = ch => 'aiueo'.includes(ch);
    let out = '', i = 0;
    while(i < str.length){
      const ch = str[i];
      if(!/[a-z'\-]/.test(ch)){ out += ch; i++; continue; }   // kana and other characters pass through
      if(ch === 'n'){
        const nx = str[i+1];
        if(nx === undefined){ out += final ? 'ん' : 'n'; i++; continue; }
        if(nx === "'"){ out += 'ん'; i += 2; continue; }
        if(nx === 'n'){
          const after = str[i+2];
          if(after !== undefined && (isVowel(after) || after === 'y')){ out += 'ん'; i++; }  // konna -> こんな
          else { out += 'ん'; i += 2; }                                                       // nn -> ん
          continue;
        }
        if(!isVowel(nx) && nx !== 'y'){ out += 'ん'; i++; continue; }
      }
      if(ch !== 'n' && /[bcdfghjklmpqrstvwxyz]/.test(ch) && str[i+1] === ch){ out += 'っ'; i++; continue; }
      let hit = false;
      for(const len of [3,2,1]){
        const sub = str.substr(i, len);
        if(ROMAJI[sub]){ out += ROMAJI[sub]; i += len; hit = true; break; }
      }
      if(!hit){ out += ch; i++; }   // unfinished sound (like "k" or "sh") waits for the next letter
    }
    return out;
  }
  // ---------- end romaji ----------

  // ---------- Practice memory (saved in this browser) ----------
  const MEM_KEY = 'kotoba-drill-memory-v1';
  let HINT_AFTER = 3;     // show the rule after this many net mistakes on the same form (changeable in Settings)
  let memory = { miss:{}, seen:{}, last:{} };
  try{
    const raw = localStorage.getItem(MEM_KEY);
    if(raw){ const m = JSON.parse(raw); memory = { miss:m.miss||{}, seen:m.seen||{}, last:m.last||{} }; }
  }catch(e){ /* storage unavailable: memory just lasts for this visit */ }
  function saveMemory(){ try{ localStorage.setItem(MEM_KEY, JSON.stringify(memory)); }catch(e){} }
  const missKey = label => currentSheetName + '|' + label;
  const wordKey = c => currentSheetName + '|' + c.front + '|' + (c.furigana || '');
  const missCount = label => memory.miss[missKey(label)] || 0;
  const readingOf = c => c.furigana || c.kanji || c.front;

  // ---------- Settings (saved in this browser) ----------
  const SET_KEY = 'kotoba-settings-v1';
  let settings = { disabled: null, showReading: true, showFormLabel: true, hintAfter: 3 };
  try{
    const rawS = localStorage.getItem(SET_KEY);
    if(rawS){
      const st = JSON.parse(rawS);
      settings = { disabled: Array.isArray(st.disabled) ? st.disabled : null, showReading: st.showReading !== false,
                   showFormLabel: st.showFormLabel !== false,
                   hintAfter: Math.max(1, Math.min(10, parseInt(st.hintAfter) || 3)) };
    }
  }catch(e){ /* settings just last for this visit */ }
  HINT_AFTER = settings.hintAfter;
  function saveSettings(){ try{ localStorage.setItem(SET_KEY, JSON.stringify(settings)); }catch(e){} }
  // first time: only N5 forms are switched on, so nothing is overwhelming
  function defaultDisabled(){ return Object.keys(FORM_INFO).filter(k => FORM_INFO[k].level !== 'N5'); }
  function disabledList(){ if(!settings.disabled) settings.disabled = defaultDisabled(); return settings.disabled; }
  function isFormOn(label){ return !disabledList().includes(normForm(label)); }
  function setFormOn(label, on){
    const k = normForm(label), d = disabledList(), i = d.indexOf(k);
    if(on && i >= 0) d.splice(i, 1);
    if(!on && i < 0) d.push(k);
  }
  const isFormColumn = x => !NOT_A_FORM.test(x.label);
  const shownExtras = c => (c.extras || []).filter(x => !isFormColumn(x) || isFormOn(x.label));

  function buildSettings(){
    const box = document.getElementById('set-forms'); box.innerHTML = '';
    const levels = levelsPresent();
    levels.forEach(lv => {
      const labels = formLabels.filter(l => levelOf(l) === lv).sort((a, b) => formOrder(a) - formOrder(b));
      const sec = document.createElement('div'); sec.className = 'set-level';
      if(levels.length > 1){
        const head = document.createElement('label'); head.className = 'set-level-head';
        const lvCb = document.createElement('input'); lvCb.type = 'checkbox'; lvCb.dataset.level = lv;
        const t = document.createElement('span'); t.textContent = lv === 'Other' ? 'Other forms' : lv + ' forms';
        const cnt = document.createElement('span'); cnt.className = 'set-count';
        head.appendChild(lvCb); head.appendChild(t); head.appendChild(cnt);
        lvCb.addEventListener('change', () => { labels.forEach(l => setFormOn(l, lvCb.checked)); saveSettings(); refreshSettingsUI(); applySettings(); });
        sec.appendChild(head);
      }
      const grid = document.createElement('div'); grid.className = 'set-grid';
      if(levels.length <= 1) grid.style.marginLeft = '0';
      labels.forEach(l => {
        const lab = document.createElement('label'); lab.className = 'set-item';
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.dataset.form = l;
        cb.addEventListener('change', () => { setFormOn(l, cb.checked); saveSettings(); refreshSettingsUI(); applySettings(); });
        const sp = document.createElement('span'); sp.textContent = labelText(l);
        const wk = document.createElement('span'); wk.className = 'set-weak'; wk.textContent = '●'; wk.title = 'You often miss this one'; wk.dataset.weak = l;
        lab.appendChild(cb); lab.appendChild(sp); lab.appendChild(wk); grid.appendChild(lab);
      });
      sec.appendChild(grid); box.appendChild(sec);
    });
    refreshSettingsUI();
  }
  function refreshSettingsUI(){
    document.querySelectorAll('#set-forms input[data-form]').forEach(cb => { cb.checked = isFormOn(cb.dataset.form); });
    document.querySelectorAll('#set-forms input[data-level]').forEach(cb => {
      const ls = formLabels.filter(l => levelOf(l) === cb.dataset.level), on = ls.filter(isFormOn).length;
      cb.checked = on === ls.length; cb.indeterminate = on > 0 && on < ls.length;
      cb.parentElement.querySelector('.set-count').textContent = '(' + on + '/' + ls.length + ')';
    });
    document.querySelectorAll('#set-forms [data-weak]').forEach(el => { el.style.display = missCount(el.dataset.weak) >= HINT_AFTER ? 'inline' : 'none'; });
    const on = formLabels.filter(isFormOn).length;
    const sum = document.getElementById('settings-summary');
    if(sum) sum.textContent = on + ' of ' + formLabels.length + ' forms';
    document.getElementById('opt-reading').checked = settings.showReading;
    document.getElementById('opt-form-label').checked = settings.showFormLabel;
    document.getElementById('opt-hint').value = settings.hintAfter;
  }
  function applySettings(){
    if(!filteredCards.length && mode !== 'drill') return;
    if(mode === 'drill'){ setGroup(activeGroup); return; }
    const card = document.getElementById('card'), was = card.classList.contains('flipped');
    renderCard();
    if(was) card.classList.add('flipped');
  }

  // ---------- Hint tabs from the spreadsheet ----------
  // A tab named "Hint - Godan" holds a table: first column = word endings, other columns = forms.
  function normForm(label){
    return String(label||'').trim()
      .replace(/\s*\([^()]*\)\s*$/, '')
      .replace(/\s*\/\s*.*$/, '')
      .replace(/\s[-–—]\s.*$/, '')
      .replace(/[-\s]*form$/i, '')
      .trim();
  }
  function hintFromSheet(ws, name){
    if(!ws || !ws['!ref']) return null;
    const range = XLSX.utils.decode_range(ws['!ref']);
    const txt = (r, c) => {
      const cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
      return cell && cell.v != null ? String(cell.v).trim() : '';
    };
    const cols = [];
    for(let c = range.s.c; c <= range.e.c; c++){
      const t = txt(range.s.r, c);
      if(t) cols.push({ c: c, label: t, norm: normForm(t) });
    }
    const meaningRow = /^form meaning$/i.test(txt(range.s.r + 1, range.s.c)) ? range.s.r + 1 : -1;
    if(cols.length < 2) return null;
    const endCol = cols.find(x => /ending|語尾/i.test(x.label)) || cols[0];
    const noteCol = cols.find(x => /^(notes?|memo|備考)$/i.test(x.label));
    const formCols = cols.filter(x => x !== endCol && x !== noteCol);
    const meanings = {};
    if(meaningRow >= 0) formCols.forEach(f => { meanings[f.norm] = txt(meaningRow, f.c); });
    const rows = [];
    for(let r = range.s.r + 1; r <= range.e.r; r++){
      if(r === meaningRow) continue;
      const raw = txt(r, endCol.c);
      if(!raw) continue;
      const values = {};
      formCols.forEach(f => { const v = txt(r, f.c); if(v) values[f.norm] = v; });
      rows.push({ raw: raw, endings: raw.split(/[・、,，\/／\s]+/).filter(Boolean), values: values, note: noteCol ? txt(r, noteCol.c) : '' });
    }
    return rows.length ? { name: name, endLabel: endCol.label, forms: formCols, rows: rows, meanings: meanings, hasMeanings: Object.values(meanings).some(Boolean), hasNotes: rows.some(r => r.note) } : null;
  }
  // "Hint - Godan" applies to the tab whose name contains "godan"; plain "Hints" applies to every tab
  function hintSheetsFor(sheetName){
    const tab = String(sheetName).toLowerCase();
    return hintSheets.filter(h => {
      const rest = h.name.toLowerCase().replace(/^\s*hints?/, '').replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff]+/g, ' ').trim();
      const first = rest.split(' ')[0];
      return !first || tab.includes(first);
    });
  }
  // Find the table row that fits this word (the longest matching ending wins, so 行く beats く)
  function hintRowFor(c, label){
    const nl = normForm(label);
    const rd = readingOf(c), kj = c.kanji || '', fr = c.front || '';
    let best = null, bestLen = 0;
    hintSheetsFor(currentSheetName).forEach(h => {
      h.rows.forEach(r => {
        if(!r.values[nl]) return;
        r.endings.forEach(e => {
          if((e === '*' || e === '＊') && bestLen < 0.5){ best = { sheet: h, row: r, ending: e, value: r.values[nl] }; bestLen = 0.5; return; }
          const quoted = /^「(.+)」$/.exec(e);
          if(quoted || e.charAt(0) === '=' || e.charAt(0) === '＝'){   // 「いい」 means the whole word must be exactly いい
            const x = quoted ? quoted[1] : e.slice(1);
            if(x && (rd === x || kj === x || fr === x) && x.length > bestLen){
              best = { sheet: h, row: r, ending: e, value: r.values[nl] }; bestLen = x.length;
            }
            return;
          }
          if((rd.endsWith(e) || kj.endsWith(e) || fr.endsWith(e)) && e.length > bestLen){
            best = { sheet: h, row: r, ending: e, value: r.values[nl] }; bestLen = e.length;
          }
        });
      });
    });
    return best;
  }
  const noteLines = t => String(t || '').split(/\s*\|\|\s*/).join('\n');
  const showEndings = t => String(t).replace(/[*＊]/g, 'any word').replace(/「([^」]+)」/g, '$1 (exact word)').replace(/[=＝]([^・]+)/g, '$1 (exact word)');
  function buildHintTable(h, onlyNorm, hitRow){
    const table = document.createElement('table'); table.className = 'hint-table';
    const forms = onlyNorm ? h.forms.filter(f => f.norm === onlyNorm) : h.forms;
    const head = document.createElement('tr');
    [h.endLabel].concat(forms.map(f => f.label)).concat(!onlyNorm && h.hasNotes ? ['Note'] : []).forEach(t => {
      const th = document.createElement('th'); th.textContent = t; head.appendChild(th);
    });
    table.appendChild(head);
    if(h.hasMeanings){
      const tr = document.createElement('tr'); tr.className = 'form-meaning-row';
      const label = document.createElement('td'); label.textContent = 'Form meaning'; tr.appendChild(label);
      forms.forEach(f => { const td = document.createElement('td'); td.textContent = h.meanings[f.norm] || ''; tr.appendChild(td); });
      if(!onlyNorm && h.hasNotes){ const td = document.createElement('td'); td.textContent = 'Usage notes and exceptions'; tr.appendChild(td); }
      table.appendChild(tr);
    }
    h.rows.forEach(r => {
      const tr = document.createElement('tr');
      if(r === hitRow) tr.className = 'hit';
      const td0 = document.createElement('td'); td0.textContent = showEndings(r.raw); tr.appendChild(td0);
      forms.forEach(f => { const td = document.createElement('td'); td.textContent = r.values[f.norm] || ''; tr.appendChild(td); });
      if(!onlyNorm && h.hasNotes){ const tn = document.createElement('td'); tn.textContent = noteLines(r.note); tn.style.whiteSpace = 'pre-line'; tn.style.fontFamily = 'Inter,system-ui,sans-serif'; tn.style.fontWeight = '400'; tr.appendChild(tn); }
      table.appendChild(tr);
    });
    return table;
  }
  function renderCheat(){
    const box = document.getElementById('cheat');
    box.innerHTML = '';
    hintSheetsFor(currentSheetName).forEach(h => {
      const block = document.createElement('div'); block.className = 'cheat-block';
      const t = document.createElement('h3'); t.textContent = h.name;
      block.appendChild(t); block.appendChild(buildHintTable(h, null, null));
      box.appendChild(block);
    });
  }

  // Pick a form for this word: use up every form before repeating one
  function chooseForm(c, options){
    if(options.length === 1) return options[0];
    const wk = wordKey(c);
    let all = memory.seen[wk] || [];
    const inOptions = l => options.some(o => o.label === l);
    let pool = options.filter(o => !all.includes(o.label));
    if(!pool.length){
      all = all.filter(l => !inOptions(l));                       // start a fresh cycle
      pool = options.filter(o => o.label !== memory.last[wk]);    // but not the one just asked
      if(!pool.length) pool = options;
    }
    const pick = pool[Math.floor(Math.random()*pool.length)];
    memory.seen[wk] = all.concat(pick.label);
    memory.last[wk] = pick.label;
    saveMemory();
    return pick;
  }

  // ---------- Grammar rules for hints ----------
  const GODAN_I = {う:'い',く:'き',ぐ:'ぎ',す:'し',つ:'ち',ぬ:'に',ぶ:'び',む:'み',る:'り'};
  const GODAN_A = {う:'わ',く:'か',ぐ:'が',す:'さ',つ:'た',ぬ:'な',ぶ:'ば',む:'ま',る:'ら'};
  const GODAN_E = {う:'え',く:'け',ぐ:'げ',す:'せ',つ:'て',ぬ:'ね',ぶ:'べ',む:'め',る:'れ'};
  const GODAN_O = {う:'お',く:'こ',ぐ:'ご',す:'そ',つ:'と',ぬ:'の',ぶ:'ぼ',む:'も',る:'ろ'};
  const GODAN_TE = {う:'って',つ:'って',る:'って',む:'んで',ぶ:'んで',ぬ:'んで',く:'いて',ぐ:'いで',す:'して'};
  function grammarRule(c, label){
    const info = infoFor(label); if(!info) return '';
    const rd = readingOf(c), end = rd.slice(-1);
    const where = (c.group || '') + ' ' + currentSheetName;
    const k = info.key;
    const DERIVED = {
      nakatta:'Take the ない-form, drop い, then add かった.',
      nakereba:'Take the ない-form, drop い, then add ければ.',
      tara:'Take the た-form and add ら.',
      nakattara:'Take the なかった-form and add ら.',
      nasai:'Take the ます-stem (the part before ます) and add なさい.'
    };
    if(DERIVED[k]) return DERIVED[k];
    const ICHI = { pot:'られる', vol:'よう', ba:'れば', imp:'ろ', pass:'られる', caus:'させる', cpass:'させられる', zu:'ず', zuni:'ずに', nu:'ぬ', n:'ん' };
    const G_ROW = { pot:[GODAN_E,'る'], vol:[GODAN_O,'う'], ba:[GODAN_E,'ば'], imp:[GODAN_E,''], pass:[GODAN_A,'れる'], caus:[GODAN_A,'せる'],
                    cpass:[GODAN_A,'せられる'], zu:[GODAN_A,'ず'], zuni:[GODAN_A,'ずに'], nu:[GODAN_A,'ぬ'], n:[GODAN_A,'ん'] };
    if(ICHI[k] !== undefined){
      if(/irregular|group 3|不規則/i.test(where)) return 'Irregular verb: there is no pattern to follow, so this one has to be memorised.';
      if(/ichidan|group 2|一段/i.test(where)) return 'Ichidan verb: drop る, then add ' + ICHI[k] + '.';
      if(/godan|group 1|五段/i.test(where) && G_ROW[k][0][end]){
        const t = G_ROW[k][0][end], tail = G_ROW[k][1];
        return 'Godan verb ending in ' + end + ': change ' + end + ' to ' + t + (tail ? ', then add ' + tail : '') + (end === 'う' && G_ROW[k][0] === GODAN_A ? ' (う becomes わ, not あ).' : '.');
      }
      return '';
    }
    const verbAdd = { masu:'ます', te:'て', nai:'ない', ta:'た' };
    if(verbAdd[info.key]){
      if(/irregular|group 3|不規則/i.test(where)) return 'Irregular verb: there is no pattern to follow, so this one has to be memorised.';
      if(/ichidan|group 2|一段/i.test(where)) return 'Ichidan verb: drop る, then add ' + verbAdd[info.key] + '.';
      if(/godan|group 1|五段/i.test(where)){
        if(info.key === 'masu' && GODAN_I[end]) return 'Godan verb ending in ' + end + ': change ' + end + ' to ' + GODAN_I[end] + ', then add ます.';
        if(info.key === 'nai' && GODAN_A[end]) return 'Godan verb ending in ' + end + ': change ' + end + ' to ' + GODAN_A[end] + ', then add ない' + (end === 'う' ? ' (う becomes わ, not あ).' : '.');
        if((info.key === 'te' || info.key === 'ta') && GODAN_TE[end]){
          let x = GODAN_TE[end]; if(info.key === 'ta') x = x.replace(/て$/, 'た').replace(/で$/, 'だ');
          return 'Godan verb ending in ' + end + ': change ' + end + ' to ' + x + (rd === 'いく' ? ' (exception: いく becomes いって / いった).' : '.');
        }
      }
      return '';
    }
    const irregI = /いい$/.test(rd) ? ' (いい is irregular: it changes to よ-, as in よく / よかった / よくない).' : '.';
    if(info.key === 'ku') return 'い-adjective: drop い, then add く' + irregI;
    if(info.key === 'katta') return 'い-adjective: drop い, then add かった' + irregI;
    if(info.key === 'kunai') return 'い-adjective: drop い, then add くない' + irregI;
    if(info.key === 'kute') return 'い-adjective: drop い, then add くて' + irregI;
    if(info.key === 'kunakatta') return 'い-adjective: drop い, then add くなかった' + irregI;
    if(info.key === 'de') return 'な-adjective: keep the word as it is and add で.';
    if(info.key === 'desu') return 'な-adjective: keep the word as it is and add です.';
    if(info.key === 'janakatta') return 'な-adjective: keep the word as it is and add じゃなかった.';
    if(info.key === 'ni') return 'な-adjective: keep the word as it is and add に.';
    if(info.key === 'datta') return 'な-adjective: keep the word as it is and add だった.';
    if(info.key === 'janai') return 'な-adjective: keep the word as it is and add じゃない.';
    return '';
  }
  // What changed for this exact word, worked out from your spreadsheet
  function changeFor(c, answer){
    const rd = readingOf(c);
    let n = 0;
    while(n < rd.length && n < answer.length && rd[n] === answer[n]) n++;
    const drop = rd.slice(n), add = answer.slice(n);
    return rd + ' → ' + answer + ':  ' + (drop ? 'drop ' + drop + ', ' : '') + (add ? 'add ' + add : 'nothing to add');
  }
  function showHint(afterMiss){
    const box = document.getElementById('d-hint');
    const c = drill.card, label = drill.pick.label, info = infoFor(label);
    const rule = grammarRule(c, label);
    box.innerHTML = '';
    const head = document.createElement('b');
    const title = info ? info.long : label;
    head.textContent = afterMiss
      ? '💡 You have slipped on “' + title + '” ' + missCount(label) + ' times. Here is the rule:'
      : '💡 Hint: ' + title;
    box.appendChild(head);
    const m = hintRowFor(c, label);
    if(m){
      box.appendChild(document.createTextNode('From your hint sheet:  ' + showEndings(m.row.endings.join('・')) + '  →  ' + m.value));
      if(m.row.note){
        const nt = document.createElement('span'); nt.style.cssText = 'display:block; margin-top:3px; color:var(--ink-soft); white-space:pre-line;';
        nt.textContent = noteLines(m.row.note); box.appendChild(nt);
      }
    }else{
      box.appendChild(document.createTextNode(rule || 'Compare this form with the dictionary form and look at what changes at the end.'));
    }
    if(afterMiss){
      const tw = document.createElement('span'); tw.className = 'thisword jp';
      tw.textContent = changeFor(c, drill.pick.value);
      box.appendChild(tw);
    }
    if(m) box.appendChild(buildHintTable(m.sheet, normForm(label), m.row));
    box.style.display = 'block';
  }

  function norm(t){ return String(t||'').normalize('NFKC').replace(/\s+/g,''); }
  // If the word has kanji, build the kanji spelling of a form (あきらめて -> 諦めて)
  function altKanji(c, form){
    const k = c.kanji, f = c.furigana;
    if(!k || !f || k === f) return '';
    let i = 0;
    while(i < k.length && i < f.length && k[k.length-1-i] === f[f.length-1-i]) i++;
    const kStem = k.slice(0, k.length - i), fStem = f.slice(0, f.length - i);
    if(!kStem || !fStem || !form.startsWith(fStem)) return '';
    return kStem + form.slice(fStem.length);
  }

  function updateModeUI(){
    document.getElementById('mem-reset').style.display = mode === 'drill' && formLabels.length ? 'inline-block' : 'none';
    const hasHints = hintSheetsFor(currentSheetName).length > 0;
    document.getElementById('cheat-btn').style.display = hasHints ? 'inline-block' : 'none';
    document.getElementById('tools-row').style.display = (formLabels.length || hasHints) ? 'flex' : 'none';
    document.getElementById('settings-row').style.display = formLabels.length ? 'block' : 'none';
    if(!formLabels.length) document.getElementById('settings').style.display = 'none';
    if(!hasHints) document.getElementById('cheat').style.display = 'none';
    else if(document.getElementById('cheat').style.display === 'block') renderCheat();
    const sw = document.getElementById('mode-switch');
    sw.style.display = formLabels.length && !isKanaDeck ? 'inline-flex' : 'none';
    sw.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    refreshSettingsUI();
  }

  function renderDrill(c){
    const options = eligibleForms(c);
    const pick = chooseForm(c, options);
    drill = { card: c, pick: pick, answered: false };

    document.getElementById('d-tag').textContent = c.group;
    document.getElementById('d-idx').textContent = (pos+1) + ' / ' + queue.length;
    document.getElementById('d-word').textContent = c.front;
    document.getElementById('d-reading').textContent = (c.kanji && c.furigana && settings.showReading) ? c.furigana : '';
    document.getElementById('d-meaning').textContent = c.meaning || '';
    const pr = document.getElementById('d-prompt');
    setDrillPrompt(pr, pick.label);
    const input = document.getElementById('d-input');
    input.value = ''; input.disabled = false; input.className = '';
    const fb = document.getElementById('d-feedback');
    fb.textContent = ''; fb.className = 'd-feedback';
    document.getElementById('d-extras').innerHTML = '';
    document.getElementById('d-show').style.display = '';
    document.getElementById('d-primary').textContent = 'Check';
    document.getElementById('d-hint').style.display = 'none';
    document.getElementById('d-hint-btn').style.display = missCount(pick.label) >= HINT_AFTER ? '' : 'none';
    document.getElementById('mem-reset').style.display = 'inline-block';

    document.getElementById('progress-label').textContent = pos + ' / ' + sessionTotal;
    document.getElementById('known-label').textContent = knownCount + ' known';
    document.getElementById('progress-fill').style.width = (sessionTotal ? (pos/sessionTotal*100) : 0) + '%';
    input.focus();
  }

  function revealDrill(correct, gaveUp){
    if(!drill || drill.answered) return;
    drill.answered = true;
    drill.correct = correct;
    const c = drill.card, answer = drill.pick.value;
    const input = document.getElementById('d-input');
    const fb = document.getElementById('d-feedback');
    input.disabled = true;
    input.className = correct ? 'ok' : 'bad';
    const mk = missKey(drill.pick.label);
    memory.miss[mk] = correct ? Math.max(0, (memory.miss[mk] || 0) - 1) : (memory.miss[mk] || 0) + 1;
    saveMemory();
    document.getElementById('d-hint-btn').style.display = 'none';
    const alt = altKanji(c, answer);
    if(correct){
      fb.className = 'd-feedback ok';
      fb.textContent = '✓ Correct!';
    }else{
      fb.className = 'd-feedback bad';
      fb.innerHTML = '';
      fb.appendChild(document.createTextNode(gaveUp ? 'Answer: ' : 'Not quite — answer: '));
      const a = document.createElement('span'); a.className = 'ans';
      a.textContent = answer + (alt ? '  (' + alt + ')' : '');
      fb.appendChild(a);
    }
    // show every form of this word, highlighting the one that was asked
    const ex = document.getElementById('d-extras');
    ex.innerHTML = '';
    const shownR = shownExtras(c);
    ex.classList.toggle('dense', shownR.length > 40);
    document.getElementById('d-reading').textContent = (c.kanji && c.furigana) ? c.furigana : '';
    shownR.forEach(x => {
      const d = document.createElement('div');
      d.className = 'extra' + (x.value.length > 14 ? ' wide' : '') + (x === drill.pick ? ' hit' : '');
      const l = document.createElement('span'); l.className = 'lbl'; l.textContent = labelText(x.label);
      const v = document.createElement('span'); v.className = 'val'; v.textContent = x.value;
      d.appendChild(l); d.appendChild(v);
      ex.appendChild(d);
    });
    document.getElementById('d-show').style.display = 'none';
    document.getElementById('d-primary').textContent = 'Next →';
    if(!correct && missCount(drill.pick.label) >= HINT_AFTER) showHint(true);
    else document.getElementById('d-hint').style.display = 'none';
  }

  function drillPrimary(){
    if(!drill) return;
    if(!drill.answered){
      const typed = norm(romajiToKana(document.getElementById('d-input').value, true));
      if(!typed) return;
      const answer = norm(drill.pick.value);
      const alt = norm(altKanji(drill.card, drill.pick.value));
      revealDrill(typed === answer || (alt && typed === alt), false);
      return;
    }
    // move on: correct answers are done, misses go to the back of the queue
    if(drill.correct){
      knownCount++;
      pos++;
    }else{
      const cur = queue[pos];
      queue.splice(pos, 1);
      queue.push(cur);
    }
    renderCard();
  }

  document.getElementById('d-primary').addEventListener('click', drillPrimary);
  document.getElementById('cheat-btn').addEventListener('click', ()=>{
    const box = document.getElementById('cheat');
    if(box.style.display === 'block'){ box.style.display = 'none'; return; }
    renderCheat(); box.style.display = 'block';
  });
  document.getElementById('d-hint-btn').addEventListener('click', ()=>{ if(drill && !drill.answered) showHint(false); });
  (function(){
    const btn = document.getElementById('mem-reset'); let armed = false, timer = null;
    btn.addEventListener('click', ()=>{
      if(!armed){
        armed = true; btn.textContent = 'Tap again to erase your mistake history';
        timer = setTimeout(()=>{ armed = false; btn.textContent = 'Reset practice memory'; }, 4000);
        return;
      }
      clearTimeout(timer); armed = false;
      memory = { miss:{}, seen:{}, last:{} }; saveMemory();
      btn.textContent = 'Memory cleared ✓';
      setTimeout(()=>{ btn.textContent = 'Reset practice memory'; }, 2000);
      updateModeUI();
    });
  })();
  document.getElementById('d-show').addEventListener('click', ()=> revealDrill(false, true));
  document.getElementById('d-input').addEventListener('input', (e)=>{
    if(e.isComposing) return;   // a real Japanese keyboard is doing the work
    const el = e.target, v = el.value, k = romajiToKana(v, false);
    if(k !== v){ el.value = k; el.setSelectionRange(k.length, k.length); }
  });
  document.getElementById('d-input').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' && !e.isComposing){ e.preventDefault(); drillPrimary(); }
  });
  document.addEventListener('keydown', (e)=>{
    // after answering, Enter anywhere goes to the next question
    if(mode === 'drill' && drill && drill.answered && e.key === 'Enter' && studyScreen.style.display !== 'none'
       && document.getElementById('done-screen').style.display !== 'block' && e.target.id !== 'd-input' && e.target.tagName !== 'BUTTON'){
      e.preventDefault(); drillPrimary();
    }
  });
  document.getElementById('mode-switch').addEventListener('click', (e)=>{
    const b = e.target.closest('button[data-mode]');
    if(!b || b.dataset.mode === mode) return;
    mode = b.dataset.mode;
    setGroup(activeGroup);
  });

  function shuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }

  function setGroup(g){
    activeGroup = g;
    filteredCards = g==='All' ? allCards.slice() : allCards.filter(c=>c.group===g);
    if(mode === 'drill') filteredCards = filteredCards.filter(c => eligibleForms(c).length > 0);
    queue = shuffle(filteredCards.map((_,i)=>i));
    pos = 0;
    knownCount = 0;
    sessionTotal = filteredCards.length;
    buildGroupChips();
    document.getElementById('done-screen').style.display = 'none';
    document.getElementById('stage').style.display = mode==='cards' ? 'flex' : 'none';
    document.getElementById('controls').style.display = mode==='cards' ? 'flex' : 'none';
    document.getElementById('drill').style.display = mode==='drill' ? 'flex' : 'none';
    updateModeUI();
    renderCard();
  }

  function renderCard(){
    const card = document.getElementById('card');
    card.classList.remove('flipped');
    const emptyMsg = document.getElementById('drill-empty');
    emptyMsg.style.display = 'none';
    if(mode === 'drill' && filteredCards.length === 0){
      document.getElementById('drill').style.display = 'none';
      emptyMsg.style.display = 'block';
      return;
    }
    if(pos >= queue.length){
      showDone();
      return;
    }
    const c = filteredCards[queue[pos]];
    if(mode === 'drill'){ renderDrill(c); return; }
    document.getElementById('front-kanji').textContent = c.front;
    document.getElementById('front-furigana').textContent = (c.kanji && c.furigana) ? c.furigana : '';
    document.getElementById('back-furigana').textContent = c.furigana || (c.kanji ? '' : '');
    document.getElementById('back-romaji').textContent = c.romaji || '';
    document.getElementById('back-meaning').textContent = c.isKana ? '' : (c.meaning || '—');
    const extrasEl = document.getElementById('back-extras');
    extrasEl.innerHTML = '';
    const shownC = shownExtras(c);
    shownC.forEach(x => {
      const d = document.createElement('div');
      d.className = 'extra' + (x.value.length > 14 ? ' wide' : '');
      const l = document.createElement('span'); l.className = 'lbl'; l.textContent = labelText(x.label);
      const v = document.createElement('span'); v.className = 'val'; v.textContent = x.value;
      d.appendChild(l); d.appendChild(v);
      extrasEl.appendChild(d);
    });
    card.classList.toggle('has-extras', shownC.length > 0);
    extrasEl.scrollTop = 0;
    extrasEl.classList.toggle('dense', shownC.length > 40);
    document.getElementById('tag-front').textContent = c.group;
    document.getElementById('tag-back').textContent = c.group;
    document.getElementById('idx-front').textContent = (pos+1) + ' / ' + queue.length;
    document.getElementById('idx-back').textContent = (pos+1) + ' / ' + queue.length;

    document.getElementById('progress-label').textContent = (pos) + ' / ' + sessionTotal;
    document.getElementById('known-label').textContent = knownCount + ' known';
    document.getElementById('progress-fill').style.width = (sessionTotal ? (pos/sessionTotal*100) : 0) + '%';
  }

  function showDone(){
    document.getElementById('stage').style.display = 'none';
    document.getElementById('controls').style.display = 'none';
    document.getElementById('drill').style.display = 'none';
    document.getElementById('done-screen').style.display = 'block';
    document.getElementById('done-summary').textContent =
      `You reviewed ${sessionTotal} card${sessionTotal===1?'':'s'} — ${knownCount} marked as known.`;
    document.getElementById('progress-fill').style.width = '100%';
    document.getElementById('progress-label').textContent = sessionTotal + ' / ' + sessionTotal;
  }

  document.getElementById('card').addEventListener('click', ()=>{
    document.getElementById('card').classList.toggle('flipped');
  });
  document.getElementById('prev-btn').addEventListener('click', ()=>{
    if(pos>0){ pos--; renderCard(); }
  });
  document.getElementById('next-btn').addEventListener('click', ()=>{
    if(pos < queue.length){ pos++; renderCard(); }
  });
  document.getElementById('know-btn').addEventListener('click', ()=>{
    const current=filteredCards[queue[pos]];if(current&&!current.isKana)recordReview(cardReviewKey(current),true);updateReviewSummary();
    knownCount++;
    pos++;
    renderCard();
  });
  document.getElementById('again-btn').addEventListener('click', ()=>{
    const current=filteredCards[queue[pos]];if(current&&!current.isKana)recordReview(cardReviewKey(current),false);updateReviewSummary();
    // move current card to the back of the queue for another pass
    const cur = queue[pos];
    queue.splice(pos,1);
    queue.push(cur);
    renderCard();
  });
  document.getElementById('restart-btn').addEventListener('click', ()=> setGroup(activeGroup));
  function goToTabs(){
    deckCount.textContent = '';
    renderDeckPicker();
    setPage('flashcards');
  }
  document.getElementById('tabs-btn').addEventListener('click', goToTabs);
  document.getElementById('back-extras').addEventListener('click', (e)=>{ if(e.target.id === 'back-extras') e.stopPropagation(); });
  document.getElementById('settings-btn').addEventListener('click', ()=>{
    const panel = document.getElementById('settings'), open = panel.style.display !== 'block';
    panel.style.display = open ? 'block' : 'none';
    document.getElementById('settings-btn').setAttribute('aria-expanded', open ? 'true' : 'false');
    document.getElementById('settings-caret').textContent = open ? '▴' : '▾';
    if(open) refreshSettingsUI();
  });
  document.getElementById('set-all').addEventListener('click', ()=>{ formLabels.forEach(l => setFormOn(l, true)); saveSettings(); refreshSettingsUI(); applySettings(); });
  document.getElementById('set-none').addEventListener('click', ()=>{ formLabels.forEach(l => setFormOn(l, false)); saveSettings(); refreshSettingsUI(); applySettings(); });
  document.getElementById('set-default').addEventListener('click', ()=>{ settings.disabled = defaultDisabled(); saveSettings(); refreshSettingsUI(); applySettings(); });
  document.getElementById('opt-reading').addEventListener('change', (e)=>{
    settings.showReading = e.target.checked; saveSettings();
    if(mode === 'drill' && drill && !drill.answered){
      const c = drill.card; document.getElementById('d-reading').textContent = (c.kanji && c.furigana && settings.showReading) ? c.furigana : '';
    }
  });
  document.getElementById('opt-form-label').addEventListener('change', (e)=>{
    settings.showFormLabel = e.target.checked; saveSettings();
    if(mode === 'drill' && drill && !drill.answered) setDrillPrompt(document.getElementById('d-prompt'), drill.pick.label);
  });
  document.getElementById('opt-hint').addEventListener('change', (e)=>{
    let v = parseInt(e.target.value) || 3; v = Math.max(1, Math.min(10, v));
    e.target.value = v; settings.hintAfter = v; HINT_AFTER = v; saveSettings(); refreshSettingsUI();
  });

  document.addEventListener('keydown', (e)=>{
    if(studyScreen.style.display === 'none') return;
    if(mode === 'drill') return;
    if(document.getElementById('done-screen').style.display === 'block') return;
    if(e.code === 'Space'){ e.preventDefault(); document.getElementById('card').classList.toggle('flipped'); }
    if(e.key === 'ArrowRight') document.getElementById('next-btn').click();
    if(e.key === 'ArrowLeft') document.getElementById('prev-btn').click();
  });

  // Drag-to-scroll for the group chip row (works with mouse or touch)
  (function(){
    const el = document.getElementById('groups');
    let dragging = false, moved = false, startX = 0, startScroll = 0, pid = null;

    el.addEventListener('pointerdown', (e)=>{
      dragging = true; moved = false;
      startX = e.clientX;
      startScroll = el.scrollLeft;
      pid = e.pointerId;
      el.classList.add('dragging');
      // NOTE: intentionally not calling setPointerCapture — that would redirect
      // the eventual click to the container instead of the tapped chip button.
    });
    window.addEventListener('pointermove', (e)=>{
      if(!dragging || e.pointerId !== pid) return;
      const dx = e.clientX - startX;
      if(Math.abs(dx) > 6){
        moved = true;
        el.scrollLeft = startScroll - dx;
      }
    });
    function endDrag(e){
      if(!dragging || (e && e.pointerId !== pid)) return;
      dragging = false;
      el.classList.remove('dragging');
      if(moved){
        // swallow just the next click, so a real drag doesn't also select a chip
        const suppress = (ev)=>{ ev.stopPropagation(); ev.preventDefault(); };
        el.addEventListener('click', suppress, { capture:true, once:true });
      }
    }
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  })();
  updateTimeGreeting();chooseEncouragement();
  loadBuiltInDatabase();
})();
