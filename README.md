# Parse Google Docs

This is a tool for journ-developers. It's for this workflow:

1. Share a Google Doc in your newsroom
2. Collaborate on the story
3. Publish that story through your code
4. Repeat as necessary

Basically, Google Docs is fantastic for editing but the stuff it outputs isn't
code-friendly. This library defines and parses a simple markup.

# Usage

First, install it:

    npm install --save-dev google-docs-markup

(You'll need [NodeJS](https://nodejs.org/), at least version 5.11.)

Then you'll need to find a way to grab the document's HTML. Here's a simple one:
just publish the story from within Google Docs, and then download it as
"embedded". We'll do that in this example:

    const request = require('request')
    const gdm = require('google-docs-markup')

    request(
      'https://docs.google.com/document/u/2/d/1MjYZNpQDpfDG0h0DFfTP9qElymKepvK8QsfozjjEfRw/pub?embedded=true',
      (err, response, body) => {
        if (err) throw err

        const blocks = gdm.parse_google_docs_html(body)
        // now you have "blocks"!
      }
    )

... but that leads to the question: What's a block?

# Output

Basically, your document is going to look like this:

```javascript
const blocks = [
  { type: 'h1', texts: [ { type: '', text: 'The title' } ] },
  { type: 'p', texts: [
    { text: 'This sentence contains ' },
    { text: 'italics', italic: true },
    { text: ', ' },
    { text: 'bold italics', italic: true, bold: true },
    { text: ' and ' },
    { text: 'underlines', underline: true },
    { text: '.' }
  ] },
  { type: 'page-break' },
  { type: 'hr' },
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
* `hr`: horizontal rule. Contains nothing.
* `page-break`: page break. Contains nothing. Not HTML.

There is *no recursive nesting*. You can't build a list of lists. You can't
put a header in a list or a list in a header.

There are *no attributes*. Blocks don't have HTML classes or any other
formatting information. We leave that to texts.

There are *no empty blocks*. If there's no text, there's nothing.

## Texts

Texts always have a `text` attribute. They can also have:

* `italic`: true if the text is italicized in the Google Doc
* `bold`: true if the text is bolded in the Google Doc
* `underline`: true if the text is underlined in the Google Doc

There are no empty texts.

Here's the nifty thing: you probably aren't going to output underlined text.
Who even does that these days? So we recommend you use underlined text as
"code": for example, in the Google Doc, underline something like `render(...)`
and then pass that underlined text to something `eval()`-ish. Get creative :).

# Developing

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
