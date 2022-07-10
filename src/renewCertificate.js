const acme = require('acme-client')
const uuid = require('uuid').v4
const forge = require('node-forge')
const { DefaultAzureCredential } = require('@azure/identity')
const { CertificateClient } = require('@azure/keyvault-certificates')
const { DnsManagementClient } = require('@azure/arm-dns')
const { CdnManagementClient } = require('@azure/arm-cdn')
const getServiceCredentials = require('./lib/getServiceCredentials')
const {
  acme: { caUrl, email },
  azure: {
    resourceGroup,
    keyVault,
    cdn: { domainNamesResourceGroup, domain, cdnProfile, cdnEndpoint, certificateName }
  }
} = require('./config')

const getChallengeRecord = (hostname) => {
  if (hostname === domain) {
    return '_acme-challenge'
  } else {
    return `_acme-challenge.${hostname.replace(`.${domain}`, '')}`
  }
}

const addChallengeToDns = async (authz, challenge, keyAuthorization, hostname) => {
  const { credentials, subscriptionId } = getServiceCredentials()
  const client = new DnsManagementClient(credentials, subscriptionId)

  await client.recordSets.createOrUpdate(domainNamesResourceGroup, domain, getChallengeRecord(hostname), 'TXT', { ttl: 60, txtRecords: [{ value: [keyAuthorization] }] })
}

const removeChallengeFromDns = async (authz, challenge, keyAuthorization, hostname) => {
  const { credentials, subscriptionId } = getServiceCredentials()
  const client = new DnsManagementClient(credentials, subscriptionId)
  await client.recordSets.delete(domainNamesResourceGroup, domain, getChallengeRecord(hostname), 'TXT')
}

const generateNewCertificate = async (log) => {
  const client = new acme.Client({
    directoryUrl: caUrl,
    accountKey: await acme.forge.createPrivateKey()
  })

  log('creating account')

  await client.createAccount({
    termsOfServiceAgreed: true,
    contact: [`mailto:${email}`]
  })

  log('created account')

  const order = await client.createOrder({
    identifiers: [
      { type: 'dns', value: domain },
      { type: 'dns', value: `www.${domain}` }
    ]
  })

  log('created order')

  const authorizations = await client.getAuthorizations(order)

  for (const authz of authorizations) {
    console.log(`handling authorization for ${authz.identifier.value}`)
    const { challenges } = authz
    // We only know how to handle DNS challenges in this code.
    const challenge = challenges.filter(c => c.type === 'dns-01')[0]
    const keyAuthorization = await client.getChallengeKeyAuthorization(challenge)

    try {
      log('adding record to DNS')
      await addChallengeToDns(authz, challenge, keyAuthorization, authz.identifier.value)
      log('verifying challenge')
      await client.verifyChallenge(authz, challenge)
      log('completing challenge')
      await client.completeChallenge(challenge)
      log('waiting for valid status')
      await client.waitForValidStatus(challenge)
    } finally {
      log('removing record from DNS')
      await removeChallengeFromDns(authz, challenge, keyAuthorization, authz.identifier.value)
      log('removed record from DNS')
    }

    console.log('finished with authorization')
  }

  const [keyPem, csrPem] = await acme.forge.createCsr({
    commonName: domain,
    altNames: [`www.${domain}`]
  })

  console.log('finalizing order')
  await client.finalizeOrder(order, csrPem)
  console.log('getting certificate')
  const certPem = await client.getCertificate(order)

  const password = uuid()
  const privateKey = forge.pki.privateKeyFromPem(keyPem)
  const cert = forge.pki.certificateFromPem(certPem)
  const p12 = forge.pkcs12.toPkcs12Asn1(privateKey, [cert], password)
  const der = forge.asn1.toDer(p12)
  // getBytes() returns a string, not an array.  Grr.
  const certBytes = Buffer.from(der.getBytes(), 'binary')

  return {
    bytes: certBytes,
    bitLength: cert.publicKey.n.bitLength(),
    password
  }
}

const uploadCertificate = async (certBytes, bitLength, password) => {
  const vaultUrl = `https://${keyVault}.vault.azure.net`
  const certClient = new CertificateClient(vaultUrl, new DefaultAzureCredential())
  const uploadedCert = await certClient.importCertificate(certificateName, certBytes, {
    password,
    policy: {
      enabled: true,
      contentType: 'application/x-pkcs12',
      keySize: bitLength
    }
  })

  return uploadedCert
}

const updateEndpoints = async () => {
  const { credentials, subscriptionId } = getServiceCredentials()
  const cdnClient = new CdnManagementClient(credentials, subscriptionId)
  const endpoints = await cdnClient.customDomains.listByEndpoint(resourceGroup, cdnProfile, cdnEndpoint)

  for await (const endpoint of endpoints) {
    const friendlyName = endpoint.name
    await cdnClient.customDomains.enableCustomHttps(resourceGroup, cdnProfile, cdnEndpoint, friendlyName, {
      customDomainHttpsParameters: {
        protocolType: 'ServerNameIndication',
        certificateSource: 'AzureKeyVault',
        certificateSourceParameters: {
          subscriptionId,
          resourceGroupName: resourceGroup,
          vaultName: keyVault,
          secretName: certificateName,
          updateRule: 'NoAction',
          deleteRule: 'NoAction'
        }
      }
    })
  }
}

module.exports = async (log) => {
  try {
    const { bytes, bitLength, password } = await generateNewCertificate(log)
    console.log('got new certificate')
    await uploadCertificate(bytes, bitLength, password)
    console.log('uploaded certificates')
    await updateEndpoints()
    log('updated endpoints')
    return true
  } catch (err) {
    log('failed to renew certificate')
    log(err)
    return false
  }
}
