'use strict'

const htmlparser = require('htmlparser2')
const querystring = require('querystring')

class Text {
  constructor(text, bold, italic, underline, href) {
    this.text = text
    if (bold) this.bold = true
    if (italic) this.italic = true
    if (underline) this.underline = true
    if (href) this.href = href
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

class CssStyle {
  constructor(text, parentProperties) {
    // We assume Google Docs doesn't "un-underline", etc.
    Object.assign(this, parentProperties, this._parse(text))
  }

  _parse(text) {
    const ret = {}
    if (/\bfont-weight:bold\b/.test(text)) ret.bold = true
    if (/\bfont-style:italic\b/.test(text)) ret.italic = true
    if (/\btext-decoration:underline\b/.test(text)) ret.underline = true
    return ret
  }
}

// Returns the URL we want from the given <a>'s `href`.
//
// Google Docs gives us something like https://www.google.com/url?q=http://whatis.techtarget.com/definition/absolute-link&amp;sa=D&amp;ust=1461346989252000&amp;usg=AFQjCNFFy1rqPkARlwWuYtcWV9C-AhRPSg ... which means we want http://whatis.techtarget.com/definition/absolute-link
//
// TODO figure out the encoding mechanism. We know it isn't encodeURIComponent()
// because the slashes aren't `%2F`.
function parse_href(href) {
  const index = href.indexOf('?')
  if (index === -1) throw new Error(`Got an <a> href from Google Docs we did not expect: ${href}`)

  const params = querystring.parse(href.substring(index + 1))
  if (!params.q) throw new Error(`This <a> href from Google Docs did not contain a 'q': ${href}`)

  return params.q
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
    if (text.bold !== cur_text.bold
        || text.italic !== cur_text.italic
        || text.underline !== cur_text.underline
        || text.href !== cur_text.href) {
      ret.push(new Text(
        content.join(''),
        cur_text.bold,
        cur_text.italic,
        cur_text.underline,
        cur_text.href
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
    cur_text.underline,
    cur_text.href
  ))

  return ret
}

function create_parser() {
  let css_style = null

  const output = []       // Array of blocks

  let in_table = false
  let in_editor_comments = false
  let style_texts = null  // Array when we're in a <style>. (Parser may give many texts).
  let blocks = null       // Array when we're in a <ol> or <ul>
  let texts = null        // Array when we're in a <hN>, <p> or <li>
  let span_texts = null   // Text when we're in a <span>. (Parser may give many texts.)
  let block_style = null  // CssStyle
  let span_style = null   // CssStyle
  let span_href = null    // HTML will be <span><a>blah</a></span>; this holds the href

  function onopentag(name, attributes) {
    if (in_table) return
    if (in_editor_comments) return

    switch (name) {
      case 'table':
        in_table = true
        break
      case 'div':
        in_editor_comments = true
        break
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
        block_style = new CssStyle(attributes.style)
        break
      case 'ol':
      case 'ul':
        blocks = []
        break
      case 'span':
        span_texts = []
        span_style = new CssStyle(attributes.style, block_style)
        break
      case 'a':
        // Some of these are internal "<a id='#abcd...'>", which we can ignore
        if (attributes.href && !/^#cmnt\d/.test(attributes.href)) {
          span_href = parse_href(attributes.href)
          // We don't need to watch for the closing tag: it'll be `</a></span>`
        }
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

    block_style = null
    texts = null
  }

  function onclosetag(name) {
    if (in_table) {
      if (name === 'table') in_table = false
      return
    }

    if (in_editor_comments) {
      if (name === 'div') in_editor_comments = false
      return
    }

    switch (name) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
        close_simple_block(name, output)
        break
      case 'li':
        close_simple_block(name, blocks)
        break
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
            span_style.bold === true,
            span_style.italic === true,
            // Google Docs underlines `<span><a>` elements. We don't.
            span_href === null && span_style.underline === true,
            span_href
          ))
        }

        span_texts = null
        span_href = null
        span_style = null
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
