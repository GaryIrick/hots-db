resource "azurerm_app_service_plan" "consumption" {
  name                = "hots-db-on-demand"
  location            = local.location
  resource_group_name = local.resource_group
  kind                = "FunctionApp"
  sku {
    tier = "Dynamic"
    size = "Y1"
  }
}

resource "azurerm_function_app" "hots_db_functions" {
  name                       = "hots-db-functions"
  location                   = local.location
  resource_group_name        = local.resource_group
  app_service_plan_id        = azurerm_app_service_plan.consumption.id
  storage_account_name       = azurerm_storage_account.functions.name
  storage_account_access_key = azurerm_storage_account.functions.primary_access_key
  version                    = "~4"
  https_only                 = true
  app_settings = {
    https_only                     = true
    FUNCTIONS_WORKER_RUNTIME       = "node"
    WEBSITE_NODE_DEFAULT_VERSION   = "~14"
    FUNCTION_APP_EDIT_MODE         = "readonly"
    WEBSITE_RUN_FROM_PACKAGE       = "1"
    SCM_DO_BUILD_DURING_DEPLOYMENT = "false"
    # AZURE_LOG_LEVEL                = "verbose"
    APPINSIGHTS_INSTRUMENTATIONKEY = azurerm_application_insights.functions_logs.instrumentation_key
    SUBSCRIPTION_ID                = data.azurerm_client_config.current.subscription_id
  }
  identity {
    type = "SystemAssigned"
  }
  site_config {
    cors {
      allowed_origins = [
        "https://hots-helper.com",
        "https://www.hots-helper.com",
      ]
    }
  }
}

resource "azurerm_application_insights" "functions_logs" {
  name                = "hots-db-function-logs"
  location            = local.location
  resource_group_name = local.resource_group
  application_type    = "web"
}
