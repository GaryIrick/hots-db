data "azurerm_dns_zone" "hots_helper" {
  name                = "hots-helper.com"
  resource_group_name = local.domain_names_resource_group
}

resource "azurerm_dns_cname_record" "api_cname" {
  name                = "api"
  resource_group_name = local.domain_names_resource_group
  zone_name           = data.azurerm_dns_zone.hots_helper.name
  ttl                 = 60
  record              = azurerm_function_app.hots_db_functions.default_hostname
}

resource "azurerm_dns_txt_record" "api_txt" {
  name                = "asuid.${azurerm_dns_cname_record.api_cname.name}"
  resource_group_name = local.domain_names_resource_group
  zone_name           = data.azurerm_dns_zone.hots_helper.name
  ttl                 = 300
  record {
    value = azurerm_function_app.hots_db_functions.custom_domain_verification_id
  }
}

resource "azurerm_dns_a_record" "apex_alias" {
  name                = "@"
  resource_group_name = local.domain_names_resource_group
  zone_name           = data.azurerm_dns_zone.hots_helper.name
  ttl                 = 60
  target_resource_id  = azurerm_cdn_endpoint.web.id
}

resource "azurerm_dns_cname_record" "www_alias" {
  name                = "www"
  resource_group_name = local.domain_names_resource_group
  zone_name           = data.azurerm_dns_zone.hots_helper.name
  ttl                 = 60
  target_resource_id  = azurerm_cdn_endpoint.web.id
}

# Need this?

resource "azurerm_dns_cname_record" "cdnverify_cname" {
  name                = "cdnverify"
  resource_group_name = local.domain_names_resource_group
  zone_name           = data.azurerm_dns_zone.hots_helper.name
  ttl                 = 60
  record              = "cdnverify.${azurerm_cdn_endpoint.web.fqdn}"
}

resource "azurerm_app_service_custom_hostname_binding" "api_hostname_binding" {
  resource_group_name = local.resource_group
  hostname            = trim(azurerm_dns_cname_record.api_cname.fqdn, ".")
  app_service_name    = azurerm_function_app.hots_db_functions.name
  depends_on          = [azurerm_dns_txt_record.api_txt]

  lifecycle {
    ignore_changes = [ssl_state, thumbprint]
  }
}

resource "azurerm_app_service_managed_certificate" "api_cert" {
  custom_hostname_binding_id = azurerm_app_service_custom_hostname_binding.api_hostname_binding.id
}

resource "azurerm_app_service_certificate_binding" "api_cert_binding" {
  hostname_binding_id = azurerm_app_service_custom_hostname_binding.api_hostname_binding.id
  certificate_id      = azurerm_app_service_managed_certificate.api_cert.id
  ssl_state           = "SniEnabled"
}

resource "azurerm_cdn_profile" "web_profile" {
  name                = "hots-db-web-cdn"
  location            = local.location
  resource_group_name = local.resource_group
  sku                 = "Standard_Microsoft"
}

resource "azurerm_cdn_endpoint" "web" {
  name                = "hots-db-web-endpoint"
  location            = local.location
  resource_group_name = local.resource_group
  profile_name        = azurerm_cdn_profile.web_profile.name
  origin_host_header  = azurerm_storage_account.web.primary_web_host
  is_http_allowed     = true
  is_https_allowed    = true

  origin {
    name      = "hots-helper-origin"
    host_name = azurerm_storage_account.web.primary_web_host
  }

  delivery_rule {
    name  = "EnforceHTTPS"
    order = 1
    request_scheme_condition {
      match_values = [
        "HTTP"
      ]
      operator         = "Equal"
      negate_condition = false
    }
    url_redirect_action {
      protocol      = "Https"
      redirect_type = "Found"
    }
  }
}

# We don't set up the custom domain for the CDN endpoint here.  2 reasons:
# - The terraform provider only supports HTTP custom domains.
# - When creating the custom domain for the apex domain, even with HTTPS disabled,
#   the terraform provider fails.
#
# It would be really nice to use managed certificates, but Azure doesn't support
# that for apex domains, so we roll our own and use it.
#
# Here are the instructions for onboard an apex domain.  This terraform should
# take care of creating all of the DNS records needed, just add the endpoint.
#
# https://docs.microsoft.com/en-us/azure/cdn/onboard-apex-domain
#
# Here are the steps you'll need to take to add the endpoint:
# - Add the custom domain to the endpoint by hand in the Azure console.
# - Run renewCertificate.js to get a new certificate and attach it to the endpoint.
# - RUn renewCertificate.js regularly to get fresh certificates.

