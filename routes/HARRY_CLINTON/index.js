const express = require('express');
const router = express.Router();
const { poolConnect } = require('../../config/db_harry_clinton');

// Connect pool once when this module loads
poolConnect
  .then(() => console.log('✓ HARRY_CLINTON database pool connected'))
  .catch(err => console.error('✗ HARRY_CLINTON database pool connection failed:', err));

router.use('/Auth', require('./A_Auth_Mail_FileUpload/Auth'));
router.use('/Users', require('./A_User_Access_Management/User'));
router.use('/Roles', require('./A_User_Access_Management/Roles'));
router.use('/User-Roles', require('./A_User_Access_Management/UserRoles'));
router.use('/Running-Bar', require('./HC_A_Header_Running_Bars/RunningBar'));
router.use('/Running-Bar-Items', require('./HC_A_Header_Running_Bars/RunningBarItems'));
router.use('/Menu-Category', require('./HC_B_Menu_Navigation/MenuCategory'));
router.use('/Menu-Sub-Category', require('./HC_B_Menu_Navigation/MenuSubCategory'));

router.use('/Products', require('./C_Product_Catalog_&_Configuration/Products'));
router.use('/Products-Variants', require('./C_Product_Catalog_&_Configuration/Products_Variants'));
router.use('/Products-Attributes', require('./C_Product_Catalog_&_Configuration/Products_Attributes'));
router.use('/Products-Attributes-Values', require('./C_Product_Catalog_&_Configuration/Products_Attributes_Values'));
router.use('/Products-Sizes', require('./C_Product_Catalog_&_Configuration/Products_Sizes'));

router.use('/Products-Cloth-Types', require('./C_Product_Catalog_&_Configuration/Products_Cloth_Types'));
router.use('/Products-Care-Instructions', require('./C_Product_Catalog_&_Configuration/Products_Care_Instructions'));
router.use('/Products-Cloth-Type-Care-Instructions', require('./C_Product_Catalog_&_Configuration/Products_Cloth_Type_Care_Instructions'));

router.use('/Products-Seo', require('./C_Product_Catalog_&_Configuration/Products_Seo'));
router.use('/Products-Media', require('./C_Product_Catalog_&_Configuration/Products_Media'));

router.use('/Appointment-Date-Slots', require('./HC_F_Appointments/AppointmentDateSlots'));
router.use('/Appointment-Slot-Blocks', require('./HC_F_Appointments/AppointmentSlotBlocks'));
router.use('/Appointment-Time-Slots', require('./HC_F_Appointments/AppointmentTimeSlots'));
router.use('/Custom-Appointments', require('./HC_F_Appointments/CustomAppointments'));



router.use('/Profiles', require('./B_Customer_Management/Profiles'));
router.use('/Addresses', require('./B_Customer_Management/Addresses'));

// D) Wishlist Management
router.use('/Wishlists', require('./D_Wishlist_Management/Wishlists'));
router.use('/Wishlist-Items', require('./D_Wishlist_Management/Wishlist_Items'));

// E) Cart Management
router.use('/Carts', require('./E_Cart_Management/Carts'));
router.use('/Cart-Items', require('./E_Cart_Management/Cart_Items'));

// F) Order Management
router.use('/Order-Status-Master', require('./F_Order_Management/Order_Status_Master'));
router.use('/Orders', require('./F_Order_Management/Orders'));
router.use('/Order-Items', require('./F_Order_Management/Order_Items'));
router.use('/Order-Addresses', require('./F_Order_Management/Order_Addresses'));
router.use('/Order-Status-History', require('./F_Order_Management/Order_Status_History'));
router.use('/Order-Cancellations', require('./F_Order_Management/Order_Cancellations'));
router.use('/Invoices', require('./F_Order_Management/Invoices'));

// G) Payments
router.use('/Payments', require('./G_Payments/Payments'));

// H) Coupons & Discounts
router.use('/Coupons', require('./H_Coupons_&_Discounts/Coupons'));
router.use('/Discounts', require('./H_Coupons_&_Discounts/Discounts'));
router.use('/Discount-Targets', require('./H_Coupons_&_Discounts/Discount_Targets'));
router.use('/Coupon-Usage', require('./H_Coupons_&_Discounts/Coupon_Usage'));
router.use('/Order-Promotions', require('./H_Coupons_&_Discounts/Order_Promotions'));

// I) Shipping & Delivery
router.use('/Courier-Partners', require('./I_ Shipping_&_Delivery/Courier_Partners'));
router.use('/Shipments', require('./I_ Shipping_&_Delivery/Shipments'));
router.use('/Shipment-Events', require('./I_ Shipping_&_Delivery/Shipment_Events'));

// J) Returns & Refunds
router.use('/Returns', require('./J_Returns_&_Refunds/Returns'));
router.use('/Refunds', require('./J_Returns_&_Refunds/Refunds'));

// K) Support, Content & System Configuration
router.use('/Support-Contacts', require('./K_Support_Content_&_System_Configuration/Support_Contacts'));
router.use('/FAQs', require('./K_Support_Content_&_System_Configuration/FAQs'));
router.use('/Newsletter-Subscriptions', require('./K_Support_Content_&_System_Configuration/Newsletter_Subscriptions'));
router.use('/Settings', require('./K_Support_Content_&_System_Configuration/Settings'));



router.use('/Image-Sliders', require('./HC_C_Home_Visuals/Image_Sliders'));
router.use('/Menu-Video', require('./HC_C_Home_Visuals/Menu_Video'));



router.use('/Spotlight-Media', require('./HC_D_Spotlight/Spotlight_Media'));
router.use('/Spotlight-Entries', require('./HC_D_Spotlight/Spotlight_Entries'));



router.use('/Style-Collection-Media', require('./HC_E_Style_by_HC/Style_Collection_Media'));
router.use('/Style-Collections', require('./HC_E_Style_by_HC/Style_Collections'));


router.use('/Legal-Page-Headers', require('./K_Support_Content_&_System_Configuration/Legal_Page_Headers'));
router.use('/Legal-Page-Sections', require('./K_Support_Content_&_System_Configuration/Legal_Page_Sections'));


router.use('/Reviews', require('./L_Ratings_&_Reviews/Reviews'));
router.use('/Review-Media', require('./L_Ratings_&_Reviews/Review_Media'));
router.use('/Review-Votes', require('./L_Ratings_&_Reviews/Review_Votes'));
router.use('/Variant-Rating-Summary', require('./L_Ratings_&_Reviews/Variant_Rating_Summary'));
router.use('/Product-Rating-Summary', require('./L_Ratings_&_Reviews/Product_Rating_Summary'));


router.use('/FileUpload', require('./A_Auth_Mail_FileUpload/FileUpload'));
router.use('/Mail', require('./A_Auth_Mail_FileUpload/Mail'));

module.exports = router;
