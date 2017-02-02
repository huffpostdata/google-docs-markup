'use strict'

const expect = require('chai').expect
const fs = require('fs')

const index = require('../index')

describe('index', () => {
  describe('parse_google_docs_html()', () => {
    const example_html = fs.readFileSync(`${__dirname}/files/example.html`)
    const output = index.parse_google_docs_html(example_html)

    it('should parse a <p>', () => {
      expect(output[1]).to.deep.eq({
        type: 'p',
        texts: [
          { text: 'This is a Google Docs document. A program will put this into a web page. That web page will look different from this document! Here are the rules:' }
        ]
      })
    })

    it('should skip an empty <p>', () => {
      // The doc has an extra newline at position 2
      expect(output[2].type).not.to.eq('p')
    })

    it('should parse a <ul>', () => {
      const ul = output[2]
      expect(ul.type).to.eq('ul')
      expect(ul.blocks.length).to.eq(7)
      expect(ul.blocks[0].texts[0].text).to.eq('We ignore empty paragraphs, like the previous one.')
    })

    it('should parse bold and italic', () => {
      const li = output[2].blocks[2];
      expect(li.texts).to.deep.eq([
        { text: 'If you mark text ' },
        { text: 'bold', bold: true },
        { text: ' or ' },
        { text: 'italic', italic: true },
        { text: ', we will publish it as ' },
        { text: 'bold', bold: true },
        { text: ' or ' },
        { text: 'italic', italic: true },
        { text: '.' }
      ])
    })

    it('should parse underline but ignore others', () => {
      const li = output[2].blocks[3];
      expect(li.texts).to.deep.eq([
        { text: '(We ignore ' },
        { text: 'underline', underline: true },
        { text: ', foreground and background colors, font families and font sizes.)' }
      ])
    })

    it('should parse h1, h2, h3, h4', () => {
      expect(output.slice(3, 7).map((b) => b.type)).to.deep.eq([ 'h1', 'h2', 'h3', 'h4' ])
    })

    it('should parse a horizontal line', () => {
      expect(output[9]).to.deep.eq({ type: 'hr' })
    })

    it('should skip tables', () => {
      expect(output[10]).to.deep.eq({
        type: 'p',
        texts: [ { text: 'Everything after this page break will be published:' } ]
      })
    })

    it('should parse a page-break', () => {
      expect(output[11]).to.deep.eq({ type: 'page-break' })
    })

    it('should parse a link', () => {
      const li = output[2].blocks[4];
      expect(li.texts).to.deep.eq([
        { text: 'Use ' },
        { text: 'absolute links', href: 'http://whatis.techtarget.com/definition/absolute-link' },
        { text: ' as in any Google Docs, to link to other stories on other websites.' }
      ])
    })

    it('should parse a mailto: link', () => {
      const example_html = '<html><body><p><span>Here is a </span><span><a href="mailto:foo@bar.com">mailto a tag</a></span></p></body></html>'
      const output = index.parse_google_docs_html(example_html)
      expect(output[0].texts).to.deep.eq([
        { text: 'Here is a ' },
        { text: 'mailto a tag', href: 'mailto:foo@bar.com' }
      ])
    })
  })
})
