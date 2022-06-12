# resource "azurerm_cosmosdb_account" "cosmos_account" {
#   name                = "hots-db-cosmos"
#   location            = local.location
#   resource_group_name = local.resource_group
#   offer_type          = "Standard"
#   kind                = "GlobalDocumentDB"

#   capabilities {
#     name = "EnableServerless"
#   }

#   geo_location {
#     location          = local.location
#     failover_priority = 0
#   }

#   consistency_policy {
#     consistency_level = "Eventual"
#   }
# }

# resource "azurerm_cosmosdb_sql_database" "player_index_database" {
#   name                = "player-index-database"
#   resource_group_name = local.resource_group
#   account_name        = azurerm_cosmosdb_account.cosmos_account.name
# }

# resource "azurerm_cosmosdb_sql_container" "player_index_container" {
#   name                  = "player-index-container"
#   resource_group_name   = local.resource_group
#   account_name          = azurerm_cosmosdb_account.cosmos_account.name
#   database_name         = "player-index-database"
#   partition_key_path    = "/id"
#   partition_key_version = 1
# }

