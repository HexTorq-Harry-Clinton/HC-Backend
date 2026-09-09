$ErrorActionPreference='Stop'
$src='D:/2026/Harry-Clinton/HC-BACKEND/reports/route-files-endpoints-source-20260414.json'
$items=Get-Content -Raw -Path $src | ConvertFrom-Json

$level1='D:/2026/Harry-Clinton/HC-BACKEND/reports/API-Level-1-Module-Endpoint-Index-20260414.md'
$level1csv='D:/2026/Harry-Clinton/HC-BACKEND/reports/API-Level-1-Module-Endpoint-Index-20260414.csv'

$moduleInfo = @{
  '/Users'=@{Table='tbl_users'; Purpose='Manage user accounts, profile identity details, and account lifecycle actions.'}
  '/Roles'=@{Table='tbl_roles'; Purpose='Define role types used for permission control across the platform.'}
  '/User-Roles'=@{Table='tbl_user_roles'; Purpose='Assign roles to users so the right people can access the right features.'}
  '/Profiles'=@{Table='tbl_profiles'; Purpose='Store customer profile information used across shopping and checkout journeys.'}
  '/Addresses'=@{Table='tbl_addresses'; Purpose='Manage saved customer addresses used for shipping and billing.'}

  '/Products'=@{Table='tbl_products'; Purpose='Manage core product records shown in catalog and product listing pages.'}
  '/Products-Variants'=@{Table='tbl_product_variants'; Purpose='Manage purchasable product variants such as color, fit, or style options.'}
  '/Products-Media'=@{Table='tbl_product_media'; Purpose='Manage product images/videos used in product detail pages.'}
  '/Products-Attributes'=@{Table='tbl_attributes'; Purpose='Define product attribute types used for filtering and merchandising.'}
  '/Products-Attributes-Values'=@{Table='tbl_product_attribute_values'; Purpose='Store allowed values for product attributes such as pattern, fabric, or occasion.'}
  '/Products-Sizes'=@{Table='tbl_sizes'; Purpose='Manage size master data used while creating variants and size selection options.'}
  '/Products-Cloth-Types'=@{Table='tbl_cloth_types'; Purpose='Manage cloth/fabric categories used in product metadata and filtering.'}
  '/Products-Care-Instructions'=@{Table='tbl_care_instructions'; Purpose='Manage care instruction entries displayed to customers after purchase consideration.'}
  '/Products-Cloth-Type-Care-Instructions'=@{Table='tbl_cloth_type_care_instructions'; Purpose='Map fabrics to recommended care guidance for consistency and customer trust.'}
  '/Products-Seo'=@{Table='tbl_product_seo'; Purpose='Manage SEO metadata so product pages are discoverable in search engines.'}

  '/Wishlists'=@{Table='tbl_wishlists'; Purpose='Manage customer wishlist containers for save-for-later behavior.'}
  '/Wishlist-Items'=@{Table='tbl_wishlist_items'; Purpose='Add or remove products in customer wishlists.'}
  '/Carts'=@{Table='tbl_carts'; Purpose='Manage active shopping carts before order placement.'}
  '/Cart-Items'=@{Table='tbl_cart_items'; Purpose='Manage products, quantities, and prices inside carts.'}

  '/Orders'=@{Table='tbl_orders'; Purpose='Manage order headers representing customer purchases.'}
  '/Order-Items'=@{Table='tbl_order_items'; Purpose='Manage line items that belong to each order.'}
  '/Order-Addresses'=@{Table='tbl_order_addresses'; Purpose='Store delivery and billing address snapshots for each order.'}
  '/Order-Status-Master'=@{Table='tbl_order_status_master'; Purpose='Manage valid order statuses used in lifecycle tracking.'}
  '/Order-Status-History'=@{Table='tbl_order_status_history'; Purpose='Track every order status transition over time.'}
  '/Order-Cancellations'=@{Table='tbl_order_cancellations'; Purpose='Capture cancellation requests, reasons, and outcomes.'}
  '/Invoices'=@{Table='tbl_invoices'; Purpose='Manage invoice records generated for completed or billable orders.'}

  '/Payments'=@{Table='tbl_payments'; Purpose='Record payment transactions, status, and reconciliation fields.'}

  '/Coupons'=@{Table='tbl_coupons'; Purpose='Manage coupon definitions and eligibility settings.'}
  '/Discounts'=@{Table='tbl_discounts'; Purpose='Manage discount rules that can apply across product/order contexts.'}
  '/Discount-Targets'=@{Table='tbl_discount_targets'; Purpose='Map discounts to applicable targets such as products or collections.'}
  '/Coupon-Usage'=@{Table='tbl_coupon_usage'; Purpose='Track coupon consumption by users and orders to control misuse.'}
  '/Order-Promotions'=@{Table='tbl_order_promotions'; Purpose='Store promotion benefits actually applied to placed orders.'}

  '/Courier-Partners'=@{Table='tbl_courier_partners'; Purpose='Manage courier providers and their operational profile data.'}
  '/Shipments'=@{Table='tbl_shipments'; Purpose='Manage shipment records linked to orders and couriers.'}
  '/Shipment-Events'=@{Table='tbl_shipment_events'; Purpose='Track shipment movement events for customer tracking visibility.'}

  '/Returns'=@{Table='tbl_returns'; Purpose='Manage customer return requests and their processing state.'}
  '/Refunds'=@{Table='tbl_refunds'; Purpose='Manage refund records linked to approved return/payment flows.'}

  '/Support-Contacts'=@{Table='tbl_support_contacts'; Purpose='Manage support channels shown to customers.'}
  '/FAQs'=@{Table='tbl_faqs'; Purpose='Manage frequently asked questions displayed on help pages.'}
  '/Newsletter-Subscriptions'=@{Table='tbl_newsletter_subscriptions'; Purpose='Manage newsletter opt-ins and audience records.'}
  '/Settings'=@{Table='tbl_settings'; Purpose='Manage system-level configuration values used by business flows.'}
  '/Legal-Page-Headers'=@{Table='tbl_legal_page_header'; Purpose='Manage legal page header content such as page title and intro metadata.'}
  '/Legal-Page-Sections'=@{Table='tbl_legal_page_sections'; Purpose='Manage legal content sections displayed on policy/terms pages.'}

  '/Image-Sliders'=@{Table='tbl_image_sliders'; Purpose='Manage homepage slider visuals and ordering.'}
  '/Menu-Video'=@{Table='tbl_menu_videos'; Purpose='Manage menu/hero videos used in visual merchandising.'}
  '/Spotlight-Entries'=@{Table='tbl_spotlight_entries'; Purpose='Manage spotlight stories or featured blocks.'}
  '/Spotlight-Media'=@{Table='tbl_spotlight_media'; Purpose='Manage media assets for spotlight entries.'}
  '/Style-Collections'=@{Table='tbl_style_collections'; Purpose='Manage style collections for lookbook-like discovery.'}
  '/Style-Collection-Media'=@{Table='tbl_style_collection_media'; Purpose='Manage media items attached to style collections.'}

  '/Appointment-Date-Slots'=@{Table='tbl_appointment_date_slots'; Purpose='Manage available appointment dates.'}
  '/Appointment-Time-Slots'=@{Table='tbl_appointment_time_slots'; Purpose='Manage available appointment times under date slots.'}
  '/Appointment-Slot-Blocks'=@{Table='tbl_appointment_slot_blocks'; Purpose='Block date/time windows to prevent booking in unavailable periods.'}
  '/Custom-Appointments'=@{Table='tbl_custom_appointments'; Purpose='Manage appointment bookings submitted by customers.'}

  '/Running-Bar'=@{Table='tbl_running_bars'; Purpose='Manage running information bars used for high-visibility announcements.'}
  '/Running-Bar-Items'=@{Table='tbl_running_bar_items'; Purpose='Manage items/messages shown inside each running bar.'}
  '/Menu-Category'=@{Table='tbl_menu_categories'; Purpose='Manage top-level menu categories used for site navigation.'}
  '/Menu-Sub-Category'=@{Table='tbl_menu_subcategories'; Purpose='Manage sub-categories under top-level navigation.'}

  '/Reviews'=@{Table='tbl_product_reviews'; Purpose='Manage customer product reviews and moderation state.'}
  '/Review-Media'=@{Table='tbl_review_media'; Purpose='Manage photos/videos attached to customer reviews.'}
  '/Review-Votes'=@{Table='tbl_review_votes'; Purpose='Track helpfulness votes on reviews.'}
  '/Product-Rating-Summary'=@{Table='tbl_product_rating_summary'; Purpose='Store aggregate rating values for product-level display.'}
  '/Variant-Rating-Summary'=@{Table='tbl_variant_rating_summary'; Purpose='Store aggregate rating values for variant-level display.'}

  '/Auth'=@{Table='auth_sp_flows'; Purpose='Support registration, login, OTP, and password recovery flows.'}
  '/Mail'=@{Table='mail_service'; Purpose='Send transactional and OTP emails to customers.'}
  '/FileUpload'=@{Table='file_storage'; Purpose='Upload and store files/media for modules that need attachments.'}
}

function BuildDesc($method,$sub,$mount,$purpose){
  if($mount -eq '/Auth'){
    switch($sub){
      '/Register' { return @('Register a new user','Useful for onboarding a new customer account so they can sign in and place orders.') }
      '/Password-Login' { return @('Login with password','Useful for authenticating existing users using email and password.') }
      '/OTP-Login' { return @('Start OTP login','Useful for sending a one-time code to user email for secure sign-in.') }
      '/Verify-Login-OTP' { return @('Verify OTP code','Useful for completing OTP login after user enters the received code.') }
      '/Forgot-Password' { return @('Start password reset','Useful when users forget password and need reset initiation.') }
      '/Reset-Password' { return @('Set new password','Useful for saving a new password after reset validation.') }
      '/Forgot-Password-Confirm' { return @('Confirm reset process','Useful for final verification step in password recovery workflow.') }
    }
  }

  if($mount -eq '/Mail'){
    switch($sub){
      '/SendMail' { return @('Send custom email','Useful for sending transactional or support emails to customers.') }
      '/SendOTPEmail' { return @('Send OTP email','Useful for delivering one-time verification codes to user inbox.') }
    }
  }

  if($mount -eq '/FileUpload' -and $method -eq 'POST'){
    return @('Upload file','Useful for uploading images or documents used by product/content modules.')
  }

  if($mount -eq '/User-Roles'){
    switch($sub){
      '/add' { return @('Assign role to user','Useful for granting additional permissions to an existing user.') }
      '/remove' { return @('Remove role from user','Useful for revoking permissions from a user account.') }
      '/user/:user_id' { return @('View roles for one user','Useful for checking access roles currently mapped to a specific user.') }
    }
  }

  if($mount -eq '/Appointment-Time-Slots' -and $sub -eq '/by-date/:appointment_date_slot_id'){
    return @('View time slots by date','Useful for showing available appointment times for a selected date.')
  }

  switch($method){
    'GET' {
      if($sub -eq '/'){
        return @('View records list','Useful for listing and browsing records in admin/customer interfaces.')
      }
      return @('View one record','Useful for opening one specific record in detail view screens.')
    }
    'POST' {
      return @('Create new record','Useful when business users add new data needed for operations and customer experience.')
    }
    'PUT' {
      return @('Update existing record','Useful for correcting details, status changes, and keeping live data accurate.')
    }
    'PATCH' {
      return @('Partially update record','Useful for quick changes to selected fields without replacing full record data.')
    }
    'DELETE' {
      return @('Delete/disable record','Useful for removing inactive data from active flows while maintaining data hygiene.')
    }
    default {
      return @('Business operation','Useful for workflow actions required by this module.')
    }
  }
}

$lines=@()
$rows=@()
$lines += '# API Level 1 Document (User-Friendly)'
$lines += ''
$lines += 'Audience: Business users, QA, support teams, product managers.'
$lines += 'Source: route files only.'
$lines += 'Base URL: /API/HARRY-CLINTON'
$lines += ''

$grouped = $items | Group-Object ModuleFolder | Sort-Object Name
foreach($g in $grouped){
  $lines += ('## Module Group: ' + $g.Name)
  $lines += ''

  foreach($m in ($g.Group | Sort-Object Mount)){
    $info = $moduleInfo[$m.Mount]
    $table = if($info){$info.Table}else{'unknown_table'}
    $purpose = if($info){$info.Purpose}else{'Manages core business operations for this module.'}

    $lines += ('### Module: ' + $m.Mount)
    $lines += ('Table/Schema Reference: ' + $table)
    $lines += ('Module Purpose: ' + $purpose)
    $lines += ''

    foreach($e in $m.Endpoints){
      $d = BuildDesc $e.Method $e.SubPath $m.Mount $purpose
      $short = $d[0]
      $long = $d[1] + ' ' + $purpose
      $lines += ('- Endpoint: ' + $e.Method + ' ' + $e.FullPath)
      $lines += ('  Short Description: ' + $short)
      $lines += ('  Long Description: ' + $long)

      $rows += [pscustomobject]@{
        ModuleGroup=$g.Name
        Module=$m.Mount
        TableReference=$table
        ModulePurpose=$purpose
        HttpMethod=$e.Method
        Endpoint=$e.FullPath
        ShortDescription=$short
        LongDescription=$long
      }
    }
    $lines += ''
  }
}

$lines += '## Not Yet Created Endpoints (Current Gap)'
$lines += '- tbl_about_us_pages'
$lines += '- tbl_privacy_policy_pages'
$lines += '- tbl_terms_conditions_pages'
$lines += '- tbl_notification_bars'
$lines += '- tbl_menu_section_images'
$lines += '- tbl_subcategory_sections'

Set-Content -Path $level1 -Value $lines -Encoding UTF8
$rows | Export-Csv -Path $level1csv -NoTypeInformation -Encoding UTF8

Write-Output "Generated: $level1"
Write-Output "Generated: $level1csv"
