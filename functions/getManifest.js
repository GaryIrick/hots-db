module.exports = async function (request, context) {
  const isLocal = process.env.OnLocalHost === 'true'

  return {
    jsonBody: {
      schema_version: 'v1',
      name_for_human: 'Heroes Stats' + (isLocal ? ' - localhost' : ''),
      name_for_model: 'herostats',
      description_for_human: 'Get statistics about Heroes of the Storm',
      description_for_model: 'Help the user find statistics for heroes in the game Heroes of the Storm',
      auth: {
        type: 'none'
      },
      api: {
        type: 'openapi',
        url: isLocal ? 'http://localhost:7071/openapi' : 'https://api.hots-helper.com/openapi'
      },
      logo_url: 'https://hots-helper.com/hots-logo.png',
      contact_email: 'admin@hots-helper.com',
      legal_info_url: 'https://hots-helper.com/legal.html'
    }
  }
}
