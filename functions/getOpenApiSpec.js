module.exports = async function (request, context) {
  const isLocal = process.env.OnLocalHost === 'true'

  return {
    jsonBody: {
      openapi: '3.0.0',
      info: {
        title: 'Hero Stats API',
        description: 'This API returns statistics about heroes in the game Heroes of the Storm.',
        version: '1.0.0'
      },
      servers: [
        {
          url: isLocal ? 'http://localhost:7071' : 'https://api.hots-helper.com',
          description: 'Azure Functions'
        }
      ],
      paths: {
        '/hero-stats': {
          get: {
            summary: 'returns statistics for all heroes for a given date range',
            description: 'Pass in a date range and get statistics for all heroes over that date range',
            operationId: 'heroesByDate',
            parameters: [
              {
                name: 'startDate',
                in: 'query',
                description: 'first day of the date range',
                required: true,
                schema: {
                  type: 'string',
                  format: 'date'
                }
              },
              {
                name: 'lastDate',
                in: 'query',
                description: 'last day of the date range',
                required: true,
                schema: {
                  type: 'string',
                  format: 'date'
                }
              },
              {
                name: 'role',
                in: 'query',
                description: 'if given, only return heroes for this role',
                required: false,
                schema: {
                  type: 'string',
                  enum: [
                    'Ranged Assassin',
                    'Melee Assassin',
                    'Healer',
                    'Tank',
                    'Bruiser',
                    'Support'
                  ]
                }
              }
            ],
            responses: {
              200: {
                description: 'hero statistics',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/HeroStats'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      components: {
        schemas: {
          HeroStats: {
            required: [
              'name',
              'role',
              'winRate'
            ],
            type: 'object',
            properties: {
              name: {
                type: 'string'
              },
              role: {
                type: 'string',
                enum: [
                  'Ranged Assassin',
                  'Melee Assassin',
                  'Healer',
                  'Tank',
                  'Bruiser',
                  'Support'
                ]
              },
              winRate: {
                type: 'number',
                description: 'always show as a percentage'
              },
              gamesPlayed: {
                type: 'number'
              }
            }
          }
        }
      }
    }
  }
}
