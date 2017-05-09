# Parse Google Docs

This is a parser for journo-developers. It's for this workflow:

1. Share a Google Doc in your newsroom
2. Collaborate on the story
3. Publish that story through your code
4. Repeat as necessary

Google Docs is fantastic for editing but icky for publishing. This library
lets you decide how to convert your Google Doc to HTML (or any other format).

# Usage

google-docs-markup is a **parser** that outputs a **JSON Array**. You can render
its output with any programming language. To use the parser, though, you'll need
[NodeJS](https://nodejs.org/), at least version 5.11.

## Using google-docs-markup

First, install it:

    npm init -y # if you haven't already
    npm install --save-dev google-docs-markup

Then pass it HTML:

    const gdm = require('google-docs-markup')
    const html = '' // get a document's HTML somehow
    const blocks = gdm.parse_google_docs_html(html)

Now you have "Blocks"!

## Downloading from the Google Drive API

We skipped the hard part: grabbing the HTML from the
[Google Drive API](https://developers.google.com/drive/v3/web/manage-downloads).
Beware: **you must use the API**, because "published" Google Docs use different
HTML conventions. The API uses OAuth, so it's confusing. We suggest you use
google-docs-markup _offline_ and store the resulting documents in your project's
repository. Here's how we do it:

Install [google-docs-console-download](https://github.com/huffpostdata/google-docs-console-download):

    npm install --save-dev google-docs-console-download

Create a function to download a file:

    const gdcd = require('google-docs-console-download')(null)

    function downloadGoogleDocAsBlocks(docId, callback) {
      gdcd.download(docId, (err, html) => {
        if (err) return callback(err)
        const blocks = gdm.parse_google_docs_html(html)
        callback(null, blocks)
      })
    }

And if your project uses multiple files, maybe you'll want a config file.
Perhaps write "config/google-docs.json" with these contents:

    [
      { "slug": "index", "googleId": "1qLoJYmUEJvpQdP4Xplp6I5JBsMpRY9RZTnak2gPhiEQ" },
      { "slug": "page1", "googleId": "1qLoJYmUEJvpQdP4Xplp6I5JBsMpRY9RZTnak2gPhiEQ" }
    ]

Write a script that downloads them all:

    const docs_config = require('./config/google-docs')
    const fs = require('fs')

    function downloadAndSaveAll(docs, dirname, callback) {
      const todo = docs.slice()

      (function tick() {
        const doc = todo.shift()
        if (!doc) return callback()

        downloadGoogleDocAsBlocks(doc.googleId, (err, blocks) => {
          if (err) return callback(err)
          fs.writeFile(`${dirname}/${doc.slug}.json`, JSON.stringify(blocks), callback)
        })
      })()
    }

    downloadAndSaveAll(docs_config, '.', (err) => {
      if (err) console.error(err)
    })

Run that script manually every time editors modify the Google Docs.

Now you have JSON markup in `./index.json` and `./page1.json`. If you're loading
it in Node, it's easy:

    const index_blocks = require('./index')
    const page1_blocks = require('./page1')

# "Blocks" Output Format

google-docs-markup output looks like this:

```javascript
const blocks = [
  { type: 'h1', texts: [ { type: '', text: 'The title' } ] },
  { type: 'p', texts: [
    { text: 'This sentence contains ' },
    { text: 'italics', italic: true },
    { text: ', ' },
    { text: 'bold italics', italic: true, bold: true },
    { text: ' and ' },
    { text: 'links', href: '#' },
    { text: ' and ' },
    { text: 'underlines', underline: true },
    { text: '.' }
  ] },
  { type: 'page-break' },
  { type: 'hr' },
  { type: 'img', src: '#' },
  { type: 'ul', blocks: [
    { type: 'li', texts: [ { text: 'List item' } ] }
  ] },
  { type: 'ol', blocks: [
    { type: 'li', texts: [ { text: 'Numbered list item' } ] }
  ] }
]
```

## Blocks

Think of this tree as a super-duper-simple HTML document. A document is made of
"blocks". Some blocks have "block" children. Other blocks have "text" children.
We never mix the two.

Blocks can have these types, derived from HTML:

* `h1`, `h2`, `h3`, `h4`: headers. Contain texts.
* `p`: paragraph. Contains texts.
* `ul`, `ol`: lists. Contain `li` blocks.
* `li`: list item. Contains texts.
* `img`: image. Contains src.
* `hr`: horizontal rule. Contains nothing.
* `page-break`: page break. Contains nothing. Not HTML.

There is *no recursive nesting*. You can't build a list of lists. You can't
put a header in a list or a list in a paragraph.

There are *no attributes*. Blocks don't have HTML classes or any other
formatting information. We leave that to texts.

There are *no empty blocks*. If there's no text, there's nothing.

## Texts

Texts always have a `text` attribute. They can also have:

* `italic`: true if the text is italicized in the Google Doc
* `bold`: true if the text is bolded in the Google Doc
* `underline`: true if the text is underlined in the Google Doc
* `href`: set if the text was originally a link.

There are no empty texts.

# Tips and tricks

## Use underline to build a templating engine

Here's the nifty thing: you probably aren't going to output underlined text.
Who even does that these days? We underline *code*.

For example, in our Google Doc, we underline something like `render(...)`. Then
when we render our blocks and texts, we replace any `text` with
`underlined:true` with `eval(text)`.

Beware smart quotes: Google Docs usually turns `render("foo")` into
`render(“foo”)`, which is invalid in most programming languages. It does the
same thing with single quotes. Try to keep those characters out of your
underlined code, or your newsroom practices will probably break it:

* If you're rendering with `eval()` in JavaScript, write Strings `\`like this\``
  (backticks are an alternative to single or double quotes).
* If you're rendering with `eval()` in Ruby, write Strings `%{like this}` (that
  escape sequence is an alternative to single or double quotes).
* If you're using a programming language with fewer features (like Python or a
  compiled language), don't use `eval()`: parse the underlying code using a
  mini-language you design yourself (one that doesn't use require single or
  double quotes).

## Include instructions below a page break

We maintain [an example Google Doc](https://docs.google.com/document/d/1qLoJYmUEJvpQdP4Xplp6I5JBsMpRY9RZTnak2gPhiEQ)
that shows off all features. It doubles as a page of instructions.

Copy/paste that page into a fresh Google Doc. Write your story above the
instructions; then write any notes (a scratchpad), then leave the instructions.
Add a page break after the story and before the notes.

The instructions will help journalists with syntax. And you can easily drop
everything after the first page break. For instance:

```javascript
const html = ...;
const blocks = gdm.parse_google_docs_html(html);
blocks.splice(blocks.find(b => b.type === 'page-break'))
```

# Adding features and fixing bugs

1. Run `node_modules/.bin/mocha -w` and verify all tests pass
2. Write a new test in the `test/` directory and verify that mocha reports failure
3. Edit code in `index.js` until tests pass
4. `git commit -a` with a descriptive message
5. Repeat from step 2 until this library has all the features you want and no bugs you know of
6. `git push`

## Releasing

After you've developed, you probably want other people to use your changes.

So publish to [npm](http://npmjs.com):

1. Edit `package.json` and set a new [semantic version](http://semver.org/) number.
2. `git commit package.json`
3. `git push`
4. `npm publish`

Then make your other projects depend on this new version:

```
npm install --save google-docs-markup
```
