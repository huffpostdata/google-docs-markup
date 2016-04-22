'use strict'

const htmlparser = require('htmlparser2')

class Text {
  constructor(text, bold, italic, underline) {
    this.text = text
    if (bold) this.bold = true
    if (italic) this.italic = true
    if (underline) this.underline = true
  }
}

class H1 {
  constructor(texts) {
    this.type = 'h1'
    this.texts = texts
  }
}

class H2 {
  constructor(texts) {
    this.type = 'h2'
    this.texts = texts
  }
}

class H3 {
  constructor(texts) {
    this.type = 'h3'
    this.texts = texts
  }
}

class H4 {
  constructor(texts) {
    this.type = 'h4'
    this.texts = texts
  }
}

class P {
  constructor(texts) {
    this.type = 'p'
    this.texts = texts
  }
}

class Ol {
  constructor(blocks) {
    this.type = 'ol'
    this.blocks = blocks
  }
}

class Ul {
  constructor(blocks) {
    this.type = 'ul'
    this.blocks = blocks
  }
}

class Li {
  constructor(texts) {
    this.type = 'li'
    this.texts = texts
  }
}

class Hr {
  constructor() {
    this.type = 'hr'
  }
}

class PageBreak {
  constructor() {
    this.type = 'page-break'
  }
}

// Parses CSS questions, and then answers: is [class name] italic? bold? etc
class CssStyle {
  constructor(text) {
    this.bold = new Set()
    this.italic = new Set()
    this.underline = new Set()

    // Look for ".c12{...}". We only care about the ".cNN" classes.
    const rule_set_re = /\.(c\d+){([^}]*)}/g
    const bold_re = /\bfont-weight:bold\b/
    const italic_re = /\bfont-style:italic\b/
    const underline_re = /\btext-decoration:underline\b/

    let m
    while ((m = rule_set_re.exec(text)) !== null) {
      const selector = m[1]
      const rules = m[2]

      if (bold_re.test(rules)) this.bold.add(selector)
      if (italic_re.test(rules)) this.italic.add(selector)
      if (underline_re.test(rules)) this.underline.add(selector)
    }
  }
}

// Takes in an Array of texts; outputs an array in which identically-styled
// texts are merged together.
//
// This makes a big difference: colors and fonts will create new <span>s in
// Google Docs HTML, and we don't want them in our final HTML.
function normalize_texts(texts) {
  let ret = []

  let content = []
  let cur_text = texts[0] // Holds the styles in this group of texts

  for (const text of texts) {
    if (text.bold !== cur_text.bold || text.italic !== cur_text.italic || text.underline !== cur_text.underline) {
      ret.push(new Text(
        content.join(''),
        cur_text.bold,
        cur_text.italic,
        cur_text.underline
      ))
      cur_text = text
      content = []
    }

    content.push(text.text)
  }

  // content is non-empty: texts is never empty
  ret.push(new Text(
    content.join(''),
    cur_text.bold,
    cur_text.italic,
    cur_text.underline
  ))

  return ret
}

function create_parser() {
  let css_style = null

  const output = []       // Array of blocks
  let in_table = false
  let style_texts = null  // Array when we're in a <style>. (Parser may give many texts).
  let blocks = null       // Array when we're in a <ol> or <ul>
  let texts = null      // Array when we're in a <hN>, <p> or <li>
  let span_texts = null   // Text when we're in a <span>. (Parser may give many texts.)
  let span_classes = null // HTML "class"es when we're in a <span>

  function onopentag(name, attributes) {
    if (in_table) return;

    switch (name) {
      case 'table': in_table = true; break
      case 'style':
        style_texts = []
        break
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'li':
      case 'p':
        texts = []
        break
      case 'ol':
      case 'ul':
        blocks = []
        break
      case 'span':
        span_texts = []
        span_classes = (attributes['class'] || '')
          .split(' ')
          .filter((s) => /c\d+/.test(s))
        break
      case 'hr':
        if (/\bpage-break-before:always\b/.test(attributes.style || '')) {
          output.push(new PageBreak())
        } else {
          output.push(new Hr())
        }
      default:
        // ignore the tag
    }
  }

  function ontext(text) {
    if (in_table) return;
    if (span_texts) span_texts.push(text)
    if (style_texts) style_texts.push(text)
  }

  function close_simple_block(name, container) {
    if (texts.length > 0) {
      const normalized_texts = normalize_texts(texts)

      let b

      switch (name) {
        case 'h1': b = new H1(normalized_texts); break
        case 'h2': b = new H2(normalized_texts); break
        case 'h3': b = new H3(normalized_texts); break
        case 'h4': b = new H4(normalized_texts); break
        case 'p': b = new P(normalized_texts); break
        case 'li': b = new Li(normalized_texts); break
        default: throw new Error(`Code error: block type ${name} should not reach here`)
      }

      container.push(b)
    }

    texts = null
  }

  function onclosetag(name) {
    if (in_table) {
      if (name == 'table') in_table = false
      return
    }

    switch (name) {
      case 'style':
        const style_text = style_texts.join('')
        style_texts = null
        css_style = new CssStyle(style_text)
        break
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
        close_simple_block(name, output)
        break
      case 'li': close_simple_block(name, blocks); break
      case 'p':
        const container = blocks === null ? output : blocks
        close_simple_block(name, container)
        break
      case 'ol': output.push(new Ol(blocks)); blocks = null; break
      case 'ul': output.push(new Ul(blocks)); blocks = null; break
      case 'span':
        const text = span_texts
          .join('')
          .replace(/ /g, ' ') // replace nbsp

        if (text) {
          texts.push(new Text(
            text,
            span_classes.some((c) => css_style.bold.has(c)),
            span_classes.some((c) => css_style.italic.has(c)),
            span_classes.some((c) => css_style.underline.has(c))
          ))
          break
        }
        span_texts = null
        span_classes = null
        break
      default:
        // ignore the tag
    }
  }

  const parser = new htmlparser.Parser({
    onopentag: onopentag,
    ontext: ontext,
    onclosetag: onclosetag
  }, { decodeEntities: true })

  parser.output = output

  return parser
}

function parse_google_docs_html(html) {
  const parser = create_parser()
  parser.write(html)
  parser.end()
  return parser.output
}

let GoogleDocsMarkup = {
  parse_google_docs_html: parse_google_docs_html
}

module.exports = GoogleDocsMarkup
