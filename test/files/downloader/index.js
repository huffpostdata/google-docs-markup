#!/usr/bin/env node
'use strict'

const auth_config = {"installed":{"client_id":"810251190899-t1jakerani5c7jepjjced708u5vnvfej.apps.googleusercontent.com","project_id":"skilful-gantry-151315","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://accounts.google.com/o/oauth2/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_secret":"aDfXE8Jw6LUgmHgb3AQ0bKxR","redirect_uris":["urn:ietf:wg:oauth:2.0:oob","http://localhost"]}}
const gdcd = require('google-docs-console-download')(auth_config)
const fs = require('fs')

const DocId = '1qLoJYmUEJvpQdP4Xplp6I5JBsMpRY9RZTnak2gPhiEQ'
const Filename = `${__dirname}/../example.html`

gdcd.download(DocId, (err, html) => {
  if (err) return callback(err)
  fs.writeFile(Filename, html, err => {
    if (err) {
      console.error(err)
    } else {
      console.log(`Wrote ${Filename}`)
    }
  })
})
