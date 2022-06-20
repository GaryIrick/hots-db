import cosmos = require('@azure/cosmos')

declare function getCosmos(containerName: string, writable: Boolean): cosmos.Container
export = getCosmos
