let tokenizerPromise;

function loadTokenizer(){
  if(tokenizerPromise)return tokenizerPromise;
  self.postMessage({type:'status',message:'Loading the Japanese reading dictionary…'});
  tokenizerPromise=new Promise((resolve,reject)=>{
    try{
      importScripts('https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/build/kuromoji.js');
      // Kuromoji's bundled path.join collapses the double slash in an https URL
      // (https://cdn… becomes https:/cdn…), which the browser treats as a
      // same-origin path. Restore the URL before the dictionary XHR is opened.
      const originalOpen=XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open=function(method,url,...args){
        const fixedUrl=typeof url==='string'?url.replace(/^https:\/(?!\/)/,'https://'):url;
        return originalOpen.call(this,method,fixedUrl,...args);
      };
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

function kanaReading(value){return katakanaToHiragana(value);}

function annotateToken(surface,reading){
  if(!/[\u3400-\u4dbf\u4e00-\u9fff々〆ヶ]/.test(surface))return surface;
  const chunks=surface.match(/[\u3400-\u4dbf\u4e00-\u9fff々〆ヶ]+|[ぁ-ゖァ-ヺー]+|[^\u3400-\u4dbf\u4e00-\u9fff々〆ヶぁ-ゖァ-ヺー]+/g)||[surface];
  let cursor=0,output='';
  for(let i=0;i<chunks.length;i++){
    const chunk=chunks[i];
    if(/[\u3400-\u4dbf\u4e00-\u9fff々〆ヶ]/.test(chunk)){
      const nextKana=chunks.slice(i+1).find(part=>/^[ぁ-ゖァ-ヺー]+$/.test(part));
      if(nextKana){
        const kana=kanaReading(nextKana),index=reading.indexOf(kana,cursor);
        if(index<cursor)return `${surface}(${reading})`;
        const chunkReading=reading.slice(cursor,index);
        output+=chunkReading?`${chunk}(${chunkReading})`:chunk;
        cursor=index;
      }else{
        const chunkReading=reading.slice(cursor);
        output+=chunkReading?`${chunk}(${chunkReading})`:chunk;
        cursor=reading.length;
      }
    }else if(/^[ぁ-ゖァ-ヺー]+$/.test(chunk)){
      const kana=kanaReading(chunk),index=reading.indexOf(kana,cursor);
      if(index<cursor)return `${surface}(${reading})`;
      output+=chunk;cursor=index+kana.length;
    }else output+=chunk;
  }
  return cursor===reading.length?output:`${surface}(${reading})`;
}

function annotate(source,tokenizer){
  return String(source).split(/(\r?\n)/).map(part=>{
    if(/^\r?\n$/.test(part))return part;
    return tokenizer.tokenize(part).map(token=>{
      const surface=token.surface_form||'';
      if(!/[\u3400-\u4dbf\u4e00-\u9fff々〆ヶ]/.test(surface)||!token.reading||token.reading==='*')return surface;
      const reading=katakanaToHiragana(token.reading);
      return annotateToken(surface,reading);
    }).join('');
  }).join('');
}

self.onmessage=async event=>{
  const data=event.data||{};
  if(data.type==='init'){
    try{await loadTokenizer();}catch(error){self.postMessage({type:'status',message:'Could not load the Japanese reading dictionary. Check your connection and try again.'});}
    return;
  }
  if(data.type!=='suggest'&&data.type!=='lookup')return;
  try{
    const tokenizer=await loadTokenizer();
    if(data.type==='lookup'){
      const lemmas=tokenizer.tokenize(String(data.word||'')).map(token=>({surface:token.surface_form||'',lemma:token.basic_form&&token.basic_form!=='*'?token.basic_form:token.surface_form||'',reading:token.reading&&token.reading!=='*'?katakanaToHiragana(token.reading):''}));
      self.postMessage({type:'lookup-result',id:data.id,lemmas});
      return;
    }
    const text=annotate(data.source,tokenizer);
    self.postMessage({type:'result',id:data.id,text});
  }catch(error){
    self.postMessage({type:'error',id:data.id,message:'Could not load the Japanese reading helper. Check your connection and try again.'});
  }
};
