let tokenizerPromise;

function loadTokenizer(){
  if(tokenizerPromise)return tokenizerPromise;
  self.postMessage({type:'status',message:'Loading the Japanese reading dictionary…'});
  tokenizerPromise=new Promise((resolve,reject)=>{
    try{
      importScripts('https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/build/kuromoji.js');
      self.kuromoji.builder({dicPath:'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/'}).build((error,tokenizer)=>{
        if(error)reject(error);else resolve(tokenizer);
      });
    }catch(error){reject(error);}
  }).then(tokenizer=>{
    self.postMessage({type:'ready'});
    return tokenizer;
  }).catch(error=>{
    tokenizerPromise=null;
    throw error;
  });
  return tokenizerPromise;
}

function katakanaToHiragana(value){
  return Array.from(String(value||'')).map(char=>{
    const code=char.charCodeAt(0);
    return code>=0x30a1&&code<=0x30f6?String.fromCharCode(code-0x60):char;
  }).join('');
}

function annotate(source,tokenizer){
  return String(source).split(/(\r?\n)/).map(part=>{
    if(/^\r?\n$/.test(part))return part;
    return tokenizer.tokenize(part).map(token=>{
      const surface=token.surface_form||'';
      if(!/[\u3400-\u4dbf\u4e00-\u9fff々〆ヶ]/.test(surface)||!token.reading||token.reading==='*')return surface;
      const reading=katakanaToHiragana(token.reading);
      const tail=(surface.match(/[ぁ-ゖァ-ヺー]+$/)||[''])[0];
      const tailReading=katakanaToHiragana(tail);
      if(tail&&reading.endsWith(tailReading)&&reading.length>tailReading.length){
        return `${surface.slice(0,-tail.length)}(${reading.slice(0,-tailReading.length)})${tail}`;
      }
      return `${surface}(${reading})`;
    }).join('');
  }).join('');
}

self.onmessage=async event=>{
  const data=event.data||{};
  if(data.type==='init'){
    try{await loadTokenizer();}catch(error){self.postMessage({type:'status',message:'Could not load the Japanese reading dictionary. Check your connection and try again.'});}
    return;
  }
  if(data.type!=='suggest')return;
  try{
    const tokenizer=await loadTokenizer();
    const text=annotate(data.source,tokenizer);
    self.postMessage({type:'result',id:data.id,text});
  }catch(error){
    self.postMessage({type:'error',id:data.id,message:'Could not load the Japanese reading helper. Check your connection and try again.'});
  }
};
