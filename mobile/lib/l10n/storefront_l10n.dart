/// Storefront UI copy — English + Khmer (aligned with web i18n).
class StorefrontL10n {
  const StorefrontL10n(this.language);

  final String language;

  bool get isKm => language == 'km';

  String _t(String en, String km) => isKm ? km : en;

  /// Retail terms commonly kept in English in Cambodia apps.
  String _keep(String value) => value;

  // Bottom nav
  String get navHome => _t('Home', 'ទំព័រដើម');
  String get navShop => _t('Shop', 'ហាង');
  String get navSearch => _t('Search', 'ស្វែងរក');
  String get navCart => _t('Cart', 'កន្ត្រក');
  String get navWishlist => _t('Wishlist', 'ចង់បាន');
  String get navAccount => _t('Account', 'គណនី');

  // Shop toolbar — Filter / Sort kept as standard retail English in both locales.
  String get filter => _keep('Filter');
  String filterWithCount(int count) => count > 0 ? '$filter ($count)' : filter;
  String get sortBy => _keep('Sort by');
  String get recommend => _keep('Recommend');

  String sortLabel(String value) {
    switch (value) {
      case 'new':
        return _t('New items', 'ទំនិញថ្មី');
      case 'price_high':
        return _t('Price (High First)', 'តម្លៃ (ខ្ពស់ → ទាប)');
      case 'price_low':
        return _t('Price (Low First)', 'តម្លៃ (ទាប → ខ្ពស់)');
      case 'discount_high':
        return _t('Discount (High First)', 'បញ្ចុះតម្លៃ (ខ្ពស់ → ទាប)');
      case 'discount_low':
        return _t('Discount (Low First)', 'បញ្ចុះតម្លៃ (ទាប → ខ្ពស់)');
      default:
        return recommend;
    }
  }

  List<({String value, String label})> get sortOptions => [
        (value: 'recommend', label: recommend),
        (value: 'new', label: sortLabel('new')),
        (value: 'price_high', label: sortLabel('price_high')),
        (value: 'price_low', label: sortLabel('price_low')),
        (value: 'discount_high', label: sortLabel('discount_high')),
        (value: 'discount_low', label: sortLabel('discount_low')),
      ];

  // Header / search
  String get appName => 'Fit & Sleek';
  String get location => _t('Phnom Penh, Cambodia', 'ភ្នំពេញ, កម្ពុជា');
  String get searchPlaceholder => _t('Search products…', 'ស្វែងរកទំនិញ...');
  String get popularSearchTerms => _t('Popular Search Terms', 'ពាក្យស្វែងរកពេញនិយម');
  String get collectionsLabel => _keep('Collections');
  String get categoriesLabel => _t('Categories', 'ប្រភេទ');

  String get newIn => _t('NEW IN', 'ថ្មីៗ');
  String get women => _t('WOMEN', 'ស្ត្រី');
  String get men => _t('MEN', 'បុរស');
  String get belts => _t('Belts', 'ខ្សែក្រវាត់');
  String get shoes => _t('Shoes', 'ស្បែកជើង');
  String get hoodies => _t('Hoodies', 'អាវហ៊ូឌី');
  String get tShirts => _t('T-Shirts', 'អាវយឺត');
  String get jeans => _t('Jeans', 'ខោជើង');

  // Home
  String get topBrands => _t('Top Brands', 'ម៉ាកល្បីៗ');
  String get newArrivals => _t('New Arrivals', 'មកថ្មី');
  String get seeAll => _t('See All', 'មើលទាំងអស់');
  String get chipAll => _t('All', 'ទាំងអស់');
  String get heroBadge => _t('NEW COLLECTION', 'ទំនិញថ្មី');
  String get heroTitleKm => 'ម៉ូដថ្មី រដូវក្តៅ 2025';
  String get heroTitleEn => 'New Summer Styles';
  String get heroTitle => _t(heroTitleEn, heroTitleKm);
  String get heroTitleSecondary => _t(heroTitleKm, heroTitleEn);
  String get shopNow => _t('Shop Now', 'ទិញឥឡូវ');

  // Cart
  String get cartTitle => _t('Shopping Cart', 'កន្ត្រកទំនិញ');
  String get cartEmpty => _t('Your cart is empty', 'កន្ត្រកទទេ');
  String get cartEmptySubtitle => _t('Start shopping!', 'ចាប់ផ្ដើមទិញទំនិញ!');
  String get cartEmptyHint => _t(
        'Go to Shop tab → pick items → add to cart to see your cart summary.',
        'ទៅ tab ហាង → ជ្រើសទំនិញ → បន្ថែមទៅកន្ត្រក ដើម្បីឃើញរូបមន្តកាត និងសរុបតម្លៃ។',
      );
  String get cartUnavailable => _t('Cart unavailable', 'មិនអាចបើកកន្ត្រកបាន');
  String get retry => _t('Retry', 'ព្យាយាមម្តងទៀត');
  String get moveToWishlist => _t('Move to wishlist', 'ផ្លាស់ទៅបញ្ជីចង់បាន');
  String get subtotal => _t('Subtotal', 'សរុបរង');
  String get saved => _t('You saved', 'សន្សំបាន');
  String get shipping => _t('Shipping', 'ដឹកជញ្ជូន');
  String get shippingAtCheckout => _t('Calculated at checkout', 'គណនានៅពេលទូទាត់');
  String get totalToPay => _t('Total', 'សរុប');
  String get signInCheckout => _t('Sign in to checkout', 'ចូលដើម្បីទូទាត់');
  String get proceedCheckout => _t('Checkout', 'ទូទាត់');
  String get guestCartNote =>
      _t('Sign in to checkout. Your cart is saved on this device.', 'ចូលគណនីដើម្បីទូទាត់។ កន្ត្រកត្រូវបានរក្សាទុកលើឧបករណ៍នេះ។');
  String get checkoutNote =>
      _t('Pay with Bakong KHQR after placing your order.', 'បង់ប្រាក់ដោយ Bakong KHQR បន្ទាប់ពីបញ្ជាទិញ។');
  String get addedToCart => _t('Added to cart', 'បានបន្ថែមកន្ត្រក');
  String get addedToCartSignIn => _t('Added to cart. Sign in to checkout.', 'បានបន្ថែមកន្ត្រក។ ចូលដើម្បីទូទាត់។');
  String get signIn => _t('Sign in', 'ចូល');

  // Wishlist
  String get wishlistEmpty => _t('Wishlist is empty', 'បញ្ជីចង់បានទទេ');
  String get wishlistEmptySubtitle => _t('Explore new arrivals', 'មើលទំនិញមកថ្មី');
  String get wishlistTitle => _t('Wishlist', 'បញ្ជីចង់បាន');

  // Account
  String get accountTitle => _t('Account', 'គណនី');
  String get statOrders => _t('Orders', 'ការបញ្ជាទិញ');
  String get statWishlist => _t('Wishlist', 'ចង់បាន');
  String get statReviews => _t('Reviews', 'មតិ');
  String get menuOrders => _t('My Orders', 'ការបញ្ជាទិញ');
  String get menuWishlist => _t('Wishlist', 'បញ្ជីចង់បាន');
  String get menuNotifications => _t('Notifications', 'ការជូនដំណឹង');
  String get notificationsEmpty => _t('No notifications yet', 'មិនទាន់មានការជូនដំណឹង');
  String get markAllRead => _t('Mark all read', 'សម្គាល់ថាបានអាន');
  String get menuSettings => _t('Settings', 'ការកំណត់');
  String get menuHelp => _t('Help & Support', 'ជំនួយ');
  String get signOut => _t('Sign Out', 'ចាកចេញ');
  String get signedOut => _t('Signed out', 'បានចាកចេញ');

  // Guest account
  String get guestAccountTitle => _t('Your account', 'គណនីរបស់អ្នក');
  String get guestAccountSubtitle =>
      _t('Sign in to view orders and manage your profile.', 'ចូលគណនីដើម្បីមើលការបញ្ជាទិញ');
  String get signUp => _t('Sign up', 'ចុះឈ្មោះ');
  String get preferences => _t('Preferences', 'ការកំណត់');
  String get languageTitle => _t('Language', 'ភាសា');
  String get appearance => _t('Appearance', 'របៀបបង្ហាញ');
  String get darkMode => _t('Dark mode', 'របៀបងងឹត');
  String get lightMode => _t('Light mode', 'របៀបភ្លឺ');
  String get supportLegal => _t('Support & Legal', 'ជំនួយ & ច្បាប់');
  String get contactUs => _t('Contact Us', 'ទំនាក់ទំនង');
  String get privacyPolicy => _t('Privacy Policy', 'គោលការណ៍ភាពឯកជន');
  String get termsConditions => _t('Terms & Conditions', 'លក្ខខណ្ឌ & កិច្ចសន្យា');
  String get cookiesPolicy => _t('Cookies Policy', 'គោលការណ៍ Cookies');
  String get faq => _keep('FAQ');
  String get editProfile => _t('Edit profile', 'កែប្រែគណនី');
  String get saveChanges => _t('Save changes', 'រក្សាទុក');
  String get profileUpdated => _t('Profile updated', 'បានធ្វើបច្ចុប្បន្នភាពគណនី');
  String get changePhoto => _t('Change photo', 'ផ្លាស់ប្តូររូប');
  String get fullName => _t('Full name', 'ឈ្មោះ');
  String get phone => _t('Phone', 'ទូរស័ព្ទ');
  String get email => _t('Email', 'អ៊ីមែល');
  String get fieldRequired => _t('Required', 'ត្រូវបំពេញ');
  String get savedAddresses => _t('Saved Addresses', 'អាសយដ្ឋាន');
  String get addAddress => _t('Add address', 'បន្ថែមអាសយដ្ឋាន');
  String get editAddress => _t('Edit address', 'កែប្រែអាសយដ្ឋាន');
  String get deleteAddress => _t('Delete', 'លុប');
  String get cancel => _t('Cancel', 'បោះបង់');
  String get setDefaultAddress => _t('Set as default', 'កំណត់ជាលំនាំដើម');
  String get defaultAddress => _t('Default', 'លំនាំដើម');
  String get confirmDeleteAddress =>
      _t('Delete this address?', 'លុបអាសយដ្ឋាននេះ?');
  String get addressesEmpty => _t('No saved addresses yet', 'មិនទាន់មានអាសយដ្ឋាន');
  String get addressLabel => _t('Label', 'ប្រភេទ');
  String get receiverName => _t('Receiver name', 'ឈ្មោះអ្នកទទួល');
  String get receiverPhone => _t('Receiver phone', 'ទូរស័ព្ទអ្នកទទួល');
  String get houseNo => _t('House No.', 'ផ្ទះលេខ');
  String get streetNo => _t('Street', 'ផ្លូវ');
  String get sangkat => _t('Sangkat / Commune', 'សង្កាត់/ឃុំ');
  String get khan => _t('District', 'ខណ្ឌ/ស្រុក');
  String get province => _t('Province / City', 'រាជធានី/ខេត្ត');
  String get landmark => _t('Landmark (optional)', 'ចំណុចសម្គាល់ (ជម្រើស)');
  String get menuLoyalty => _t('Loyalty', 'Loyalty');
  String get menuReplacements => _t('Replacements', 'Replacement');
  String get menuTrackDelivery => _t('Track delivery', 'តាមដានដឹកជញ្ជូន');
  String get statLoyalty => _t('Loyalty', 'Loyalty');
  String get loyaltyUnavailable => _t('Loyalty unavailable', 'មិនអាចផ្ទុក Loyalty');
  String get loyaltyLifetimeSpend => _t('Lifetime spend', 'ចំណាយសរុប');
  String loyaltyTierLabel(String tier) {
    final normalized = tier.trim();
    if (normalized.isEmpty) return _t('Member tier', 'កម្រិតសមាជិក');
    final label = normalized[0].toUpperCase() + normalized.substring(1);
    return _t('$label tier', 'កម្រិត ${normalized.toUpperCase()}');
  }
  String loyaltyDiscount(int percent) => _t('Checkout discount: $percent%', 'បញ្ចុះតម្លៃពេលទូទាត់: $percent%');
  String loyaltyNextTier(int points, String tier) =>
      _t('Need $points pts to reach $tier', 'ត្រូវការ $points pts ដើម្បីឈានដល់ $tier');
  String get requestReplacement => _t('Request Replacement', 'Request Replacement');
  String get replacementsEmpty => _t('No replacement requests', 'មិនមាន Replacement');
  String get replacementsEmptySub =>
      _t('Tap below to request a replacement for a delivered order.', 'ចុចខាងក្រោមដើម្បីស្នើ Replacement សម្រាប់ការបញ្ជាទិញដែលបានដឹកជញ្ជូន។');
  String get replacementsUnavailable => _t('Replacements unavailable', 'មិនអាចផ្ទុក Replacement');
  String get replacementNoEligibleOrders =>
      _t('No eligible orders yet. Delivered orders can request replacement.', 'មិនមានការបញ្ជាទិញដែលអាចស្នើ Replacement បានទេ។');
  String get replacementSubmitted => _t('Replacement request submitted', 'បានដាក់ស្នើ Replacement');
  String get replacementSelectItems => _t('Select at least one item', 'សូមជ្រើសរើសទំនិញ');
  String get replacementReasonRequired => _t('Reason is required', 'សូមបញ្ចូលមូលហេតុ');
  String get replacementReasonLabel => _t('Reason', 'មូលហេតុ');
  String get replacementNotesLabel => _t('Notes (optional)', 'ចំណាំ (ជម្រើស)');
  String get selectOrderForReplacement => _t('Select an order', 'ជ្រើសរើសការបញ្ជាទិញ');
  String get submitRequest => _t('Submit request', 'ដាក់ស្នើ');
  String submittedOn(String date) => _t('Submitted $date', 'បានដាក់ស្នើ $date');
  String get trackOrder => _t('Track order', 'តាមដានការបញ្ជាទិញ');
  String get trackingNumber => _t('Tracking number', 'លេខតាមដាន');
  String get openTrackingLink => _t('Open tracking link', 'បើកតំណតាមដាន');
  String get inProgress => _t('In progress…', 'កំពុងដំណើរការ…');
  String get estimatedDelivery => _t('Estimated soon', 'ប៉ាន់ស្មានឆាប់ៗ');
  String get ordersEmpty => _t('No orders yet', 'មិនទាន់មានការបញ្ជាទិញ');
  String get ordersEmptySub => _t('Your purchases will appear here after checkout.', 'ការបញ្ជាទិញនឹងបង្ហាញនៅទីនេះបន្ទាប់ពីទូទាត់។');
  String get ordersUnavailable => _t('Could not load orders', 'មិនអាចផ្ទុកការបញ្ជាទិញ');

  // Filters
  String get priceRange => _t('Price Range', 'ជួរតម្លៃ');
  String get gender => _t('Gender', 'ភេទ');
  String get brand => _t('Brand', 'ម៉ាក');
  String get clearAll => _t('Clear all', 'លុបទាំងអស់');
  String get applyFilters => _t('Apply filters', 'អនុវត្ត Filter');

  String genderLabel(String value) {
    switch (value) {
      case 'women':
        return _t('Women', 'ស្ត្រី');
      case 'men':
        return _t('Men', 'បុរស');
      case 'boys':
        return _t('Boys', 'ក្មេងប្រុស');
      case 'girls':
        return _t('Girls', 'ក្មេងស្រី');
      default:
        return value;
    }
  }

  List<({String value, String label})> get genderOptions => [
        (value: 'women', label: genderLabel('women')),
        (value: 'men', label: genderLabel('men')),
        (value: 'boys', label: genderLabel('boys')),
        (value: 'girls', label: genderLabel('girls')),
      ];

  // Product detail
  String get brandName => appName;
  String get addToCart => _t('Add to cart', 'បន្ថែមកន្ត្រក');
  String get buyNow => _t('Buy now', 'ទិញឥឡូវ');
  String get selectSize => _t('Please select a size', 'សូមជ្រើសរើសទំហំ');
  String get colorLabel => _t('Color', 'ពណ៌');
  String get sizeLabel => _t('Size', 'ទំហំ');
  String get colorsAvailable => _t('Colors available', 'ពណ៌ដែលមាន');
  String get sizeAvailable => _t('Size available', 'ទំហំដែលមាន');
  String get quantityLabel => _t('Quantity', 'ចំនួន');
  String get productDetails => _t('Product details', 'ព័ត៌មានផលិតផល');
  String get modelInfo => _t('Model info', 'ព័ត៌មានម៉ូដែល');
  String get noProductDetails => _t('No additional details for this product.', 'មិនមានព័ត៌មានបន្ថែមសម្រាប់ផលិតផលនេះទេ។');
  String get similarItems => _t('Similar Items', 'ទំនិញស្រដៀងគ្នា');
  String get fastDelivery => _t('Fast Delivery', 'ដឹកជញ្ជូនលឿន');
  String get fastDeliverySub => _t('From 1 – 3 days', 'រយៈពេល ១ – ៣ ថ្ងៃ');
  String get supportHotline => _t('Support Hotline', 'ខ្សែទូរស័ព្ទ');
  String get supportHotlineSub => '+855 12 345 678';
  String get easyPayment => _t('Easy Payment', 'បង់ប្រាក់ងាយស្រួល');
  String get easyPaymentSub => _keep('KHQR, Cash, Card');
  String get skuLabel => _t('SKU', 'SKU');
  String get categoryLabel => _t('Category', 'ប្រភេទ');

  // Order tracking
  String get orderTrackingTitle => _t('Order Tracking', 'តាមដានការបញ្ជាទិញ');
  String get orderTrackingHeading => orderTrackingTitle;
  String get deliveryAddress => _t('Delivery address', 'អាសយដ្ឋានដឹកជញ្ជូន');

  List<String> get orderTrackingSteps => [
        _t('Order Placed', 'ការបញ្ជាទិញ'),
        _t('Payment Confirmed', 'ការបង់ប្រាក់'),
        _t('Packing', 'ការវេចខ្ចប់'),
        _t('Shipped', 'ការដឹកជញ្ជូន'),
        _t('Delivered', 'ការដឹកជញ្ជូនបាន'),
      ];

  String qtyLabel(int quantity) => _t('Qty: $quantity', 'ចំនួន: $quantity');

  // Misc
  String get shopTitle => _t('Shop', 'ហាង');
  String get footerBrand => 'Fit & Sleek · Cambodia Fashion App';
  String get clear => _t('Clear', 'លុប');
  String get noProductsFound => _t('No products found', 'រកមិនឃើញផលិតផល');
  String get searchUnavailable => _t('Search unavailable', 'មិនអាចស្វែងរកបាន');
  String get recommendedForYou => _t('Recommended for you', 'ណែនាំសម្រាប់អ្នក');
}
