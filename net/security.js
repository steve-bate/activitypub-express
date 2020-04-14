'use strict'
const httpSignature = require('http-signature')
// http communication middleware
module.exports = {
  auth,
  verifySignature
}

function auth (req, res, next) {
  // no client-to-server support at this time
  if (req.app.get('env') !== 'development') {
    return res.status(405).send()
  }
  next()
}

async function verifySignature (req, res, next) {
  try {
    const apex = req.__apex
    // support for apps not using signature extension to ActivityPub
    if (!req.get('authorization') && !req.get('signature')) {
      const actor = await apex.pub.object.resolve(apex.pub.utils.actorFromActivity(req.body))
      if (actor.publicKey && req.app.get('env') !== 'development') {
        console.log('Missing http signature')
        return res.status(400).send('Missing http signature')
      }
      return next()
    }
    const sigHead = httpSignature.parse(req)
    const signer = await apex.pub.object.resolve(sigHead.keyId, req.app.get('db'))
    const valid = httpSignature.verifySignature(sigHead, signer.publicKey.publicKeyPem)
    if (!valid) {
      console.log('signature validation failure', sigHead.keyId)
      return res.status(400).send('Invalid http signature')
    }
    next()
  } catch (err) {
    if (req.body.type === 'Delete' && err.message.startsWith('410')) {
      // user delete message that can't be verified because we don't have the user cached
      return res.status(200).send()
    }
    console.log('error during signature verification', err.message, req.body)
    return res.status(500).send()
  }
}
