resource "azurerm_service_plan" "consumption" {
  name                = "hots-db-on-demand"
  location            = local.location
  resource_group_name = local.resource_group
  os_type             = "Windows"
  sku_name            = "Y1"
}

resource "azurerm_windows_function_app" "hots_db_functions" {
  name                        = "hots-db-functions"
  location                    = local.location
  resource_group_name         = local.resource_group
  service_plan_id             = azurerm_service_plan.consumption.id
  storage_account_name        = azurerm_storage_account.functions.name
  storage_account_access_key  = azurerm_storage_account.functions.primary_access_key
  https_only                  = true
  functions_extension_version = "~4"

  app_settings = {
    FUNCTION_APP_EDIT_MODE         = "readonly"
    WEBSITE_RUN_FROM_PACKAGE       = "1"
    SCM_DO_BUILD_DURING_DEPLOYMENT = "false"
    SUBSCRIPTION_ID                = data.azurerm_client_config.current.subscription_id
    # AZURE_LOG_LEVEL                = "verbose"
  }

  identity {
    type = "SystemAssigned"
  }

  site_config {
    application_insights_key = azurerm_application_insights.functions_logs.instrumentation_key

    application_stack {
      node_version = "~16"
    }

    cors {
      allowed_origins = [
        "https://hots-helper.com",
        "https://www.hots-helper.com",
      ]
    }
  }

  tags = {
  }

  lifecycle {
    ignore_changes = [tags]
  }
}

resource "azurerm_application_insights" "functions_logs" {
  name                = "hots-db-function-logs"
  location            = local.location
  resource_group_name = local.resource_group
  application_type    = "web"
}


data "azurerm_function_app_host_keys" "function_keys" {
  name                = azurerm_windows_function_app.hots_db_functions.name
  resource_group_name = local.resource_group
  depends_on = [
    azurerm_windows_function_app.hots_db_functions
  ]
}
