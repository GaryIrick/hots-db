resource "azurerm_cosmosdb_account" "cosmos_account" {
  name                = "hots-db-cosmos"
  location            = local.location
  resource_group_name = local.resource_group
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"

  capabilities {
    name = "EnableServerless"
  }

  geo_location {
    location          = local.location
    failover_priority = 0
  }

  consistency_policy {
    consistency_level = "Eventual"
  }
}

resource "azurerm_cosmosdb_sql_database" "database" {
  name                = "hots"
  resource_group_name = local.resource_group
  account_name        = azurerm_cosmosdb_account.cosmos_account.name
}

resource "azurerm_cosmosdb_sql_container" "teams_container" {
  name                  = "ngs-teams"
  resource_group_name   = local.resource_group
  account_name          = azurerm_cosmosdb_account.cosmos_account.name
  database_name         = azurerm_cosmosdb_sql_database.database.name
  partition_key_path    = "/id"
  partition_key_version = 1
}

resource "azurerm_cosmosdb_sql_container" "matches_container" {
  name                  = "ngs-matches"
  resource_group_name   = local.resource_group
  account_name          = azurerm_cosmosdb_account.cosmos_account.name
  database_name         = azurerm_cosmosdb_sql_database.database.name
  partition_key_path    = "/id"
  partition_key_version = 1
}

resource "azurerm_cosmosdb_sql_container" "players_container" {
  name                  = "players"
  resource_group_name   = local.resource_group
  account_name          = azurerm_cosmosdb_account.cosmos_account.name
  database_name         = azurerm_cosmosdb_sql_database.database.name
  partition_key_path    = "/id"
  partition_key_version = 1
}

resource "azurerm_cosmosdb_sql_container" "herostats_container" {
  name                  = "hero-stats"
  resource_group_name   = local.resource_group
  account_name          = azurerm_cosmosdb_account.cosmos_account.name
  database_name         = azurerm_cosmosdb_sql_database.database.name
  partition_key_path    = "/date"
  partition_key_version = 1
}
