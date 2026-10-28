# Kotoba

Kotoba is a free, mobile-friendly Japanese study site for building vocabulary, practising kanji and grammar, and reading short stories. It runs as a static website, so there is no account or server to set up.

## What you can study

- **Flashcards:** study vocabulary by deck and practise conjugation.
- **Hiragana and katakana:** practise basic characters, voiced sounds, and combined sounds with kana-first recognition cards and optional device text-to-speech.
- **Spaced review:** missed vocabulary returns to the word review queue; items you remember are scheduled at wider intervals. Progress is saved in the browser you use.
- **Saved vocabulary:** tap underlined vocabulary in readings and grammar lessons to see its meaning, then save it to a personal list for later.
- **Kanji writing:** practise stroke order with a mouse, stylus, or touchscreen, then work toward writing from memory.
- **Guided reading:** read original N5–N3 passages with furigana, look up supported vocabulary by tapping it, reveal translations, and answer Japanese questions after each full passage.
- **Personal readings:** paste Japanese text, generate editable furigana suggestions in your browser, preview it, and save the passage on your device.
- **Grammar:** follow topic-based N5–N3 lessons, practise patterns, browse the reference, and compare commonly confused forms.
- **Daily study:** find a new word of the day on the home page.

## Use Kotoba

Open the hosted site in a modern browser. The built-in study library loads automatically; no installation or sign-in is required.

## Project structure

```text
index.html       Main page and study views
css/styles.css   Layout, themes, and responsive styles
js/app.js        Study interactions and application logic
json/            Vocabulary, kana, hints, readings, and grammar content
```

## Content and contributions

The vocabulary, stories, and grammar lessons are included in the public site data. Contributions that improve explanations, add accurate examples, fix typos, or make the site easier to use are welcome. Please keep Japanese text, readings, and translations consistent and check that new content works on both desktop and mobile layouts.

## Kanji stroke data

Kanji stroke-order paths are provided by [KanjiVG](https://github.com/KanjiVG/kanjivg), © Ulrich Apel, under the [Creative Commons Attribution-ShareAlike 3.0 license](https://creativecommons.org/licenses/by-sa/3.0/). Kotoba loads the paths from KanjiVG when a learner opens a character. If you redistribute or adapt KanjiVG data, retain attribution and follow the license terms.

## Third-party services

The site uses Google Fonts for typography, SheetJS for spreadsheet import, jsDelivr to load KanjiVG stroke data, and Kuromoji.js plus its dictionary for local furigana suggestions. The dictionary and libraries require an internet connection when used; the pasted passage is analyzed in the browser and is not sent to a reading-generation service. The rest of the site is a static client-side application.

Kuromoji.js is provided under the [Apache License 2.0](https://github.com/takuyaa/kuromoji.js/blob/master/LICENSE-2.0.txt). The Japanese morphological dictionary is distributed by the Kuromoji project; see its [notice](https://github.com/takuyaa/kuromoji.js/blob/master/NOTICE.md).
