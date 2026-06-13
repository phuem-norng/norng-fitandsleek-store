/**
 * Reference formulas for every chart on /admin/reports.
 * Values match backend ReportController calculations.
 */

export const REPORT_FORMULA_NOTE_KH =
  "រូបមន្តគណនាលេខទាំងអស់នៃក្រាប — ប្រើដើម្បីយល់ថាតួលេខនីមួយៗមកពីណា និងគណនាយ៉ាងដូចម្តេច។";

export const REPORT_FORMULA_NOTE_EN =
  "Calculation formulas for every chart and KPI on this page. Cancelled orders are excluded unless noted.";

export const REPORT_FORMULA_COMMON = [
  {
    labelEn: "Share % (donut / legend)",
    labelKh: "ភាគរយ % (ដូណាត / របៀប)",
    formulaEn: "percentage = round((slice value ÷ total) × 100, 1 decimal)",
    formulaKh: "ភាគរយ = បង្គត់((តម្លៃផ្នែក ÷ សរុប) × 100, ទសភាគ ១)",
  },
  {
    labelEn: "Store revenue (Orders, Reports KPI, Revenue year total, Plan)",
    labelKh: "ចំណូលហាង (រួមគ្នា)",
    formulaEn: "SUM(orders.total) where status ≠ 'cancelled' and created_at is in the selected date range",
    formulaKh: "ចំណូល = ផលបូក orders.total · មិនរាប់ cancelled · តាមថ្ងៃបង្កើត order",
  },
  {
    labelEn: "Product / category charts",
    labelKh: "ក្រាបផលិតផល / ប្រភេទ",
    formulaEn: "SUM(order_items.line_total) or SUM(qty) — breakdown only; may not equal store revenue total",
    formulaKh: "ក្រាបបែងចែកប្រើ line_total ឬ qty · អាចមិនស្មើសរុបចំណូលហាង",
  },
];

export const REPORT_FORMULA_SECTIONS = [
  {
    id: "kpi",
    titleEn: "KPI cards (top row)",
    titleKh: "កាតសរុប (ជួរខាងលើ)",
    items: [
      {
        visualEn: "Revenue",
        visualKh: "ចំណូល",
        formulaEn: "SUM(orders.total) in period, status ≠ cancelled (same rules as Revenue year total)",
        formulaKh: "ផ្នែកចំណូល = ផលបូក orders.total · ស្មើផ្នែក Revenue",
      },
      {
        visualEn: "Orders",
        visualKh: "បញ្ជាទិញ",
        formulaEn: "COUNT(orders) in period; pending / processing / completed = COUNT where status matches",
        formulaKh: "ចំនួនបញ្ជាទិញ = រាប់ orders ក្នុងរយៈពេល · រងចាំ/កំពុង/បញ្ចប់ = រាប់តាម status",
      },
      {
        visualEn: "Products",
        visualKh: "ផលិតផល",
        formulaEn: "total = COUNT(products); active = is_active true; low stock = stock < 10 (not period-based)",
        formulaKh: "សរុបផលិតផល = រាប់ products · សកម្ម = is_active · ស្តុកទាប = stock < 10",
      },
      {
        visualEn: "Customers",
        visualKh: "អតិថិជន",
        formulaEn: "total = COUNT(users) where role = customer; new in period = customers created in selected range",
        formulaKh: "អតិថិជនសរុប = រាប់ user role customer · ថ្មី = បង្កើតក្នុងរយៈពេល",
      },
    ],
  },
  {
    id: "revenue",
    titleEn: "Revenue section",
    titleKh: "ផ្នែក Revenue",
    items: [
      {
        visualEn: "Monthly line & column charts",
        visualKh: "ក្រាបបន្ទាត់ និងឈរ (រាល់ខែ)",
        formulaEn:
          "Per month M in selected year (no category/product filter): SUM(orders.total) for non-cancelled orders in that month. With category/product filter: SUM(line_total) for matching lines only",
        formulaKh:
          "គ្មានច្រោះប្រភេទ/ផលិតផល៖ ផលបូក orders.total ក្នុងខែ · មានច្រោះ៖ ផលបូក line_total តែមាតិកាដែលច្រោះ",
      },
      {
        visualEn: "Section subtitle total",
        visualKh: "សរុបក្នុងចំណងជើង",
        formulaEn: "total_revenue = SUM(orders.total) for the full year (same as Orders page year filter)",
        formulaKh: "សរុបចំណូល = ផលបូក orders.total ឆ្នាំពេញ (ដូចទំព័រ Orders)",
      },
      {
        visualEn: "Product revenue (horizontal bars)",
        visualKh: "ចំណូលតាមផលិតផល",
        formulaEn: "Per product: SUM(line_total) in year, top 20 by revenue; filters apply",
        formulaKh: "ផលិតផលមួយៗ = ផលបូក line_total ក្នុងឆ្នាំ · បង្ហាញ ២០ ខ្ពស់បំផុត",
      },
      {
        visualEn: "Revenue by country",
        visualKh: "ចំណូលតាមប្រទេស",
        formulaEn:
          "Group by shipping_address.country on the order; revenue = SUM(line_total) per country (max 12 bars)",
        formulaKh: "ដាក់ក្រុមតាមប្រទេសដឹកជញ្ជូន · ចំណូល = ផលបូក line_total ក្នុងប្រទេសនោះ",
      },
    ],
  },
  {
    id: "stock",
    titleEn: "Stock section",
    titleKh: "ផ្នែក Stock",
    items: [
      {
        visualEn: "Stock by label (donut)",
        visualKh: "ស្តុកតាម label (ដូណាត)",
        formulaEn:
          "Per master inventory label: units = GREATEST(COALESCE(stock, 0), 0); center = SUM(units); % = units ÷ total_stock",
        formulaKh: "ឯកតាក្នុង label = stock (≥ 0) · កណ្តាល = ផលបូកឯកតា · % = ឯកតា ÷ ស្តុកសរុប",
      },
      {
        visualEn: "Stock in by month (clustered columns)",
        visualKh: "ស្តុកចូលតាមខែ (ឈរប្រៀបរៀប)",
        formulaEn:
          "For each year in range and month M: units = SUM(GREATEST(COALESCE(stock_received, stock, 0), 0)) on child labels where EXTRACT(YEAR FROM date_in) = year and month = M",
        formulaKh:
          "ខែ M ឆ្នាំ Y៖ ឯកតាចូល = ផលបូក stock_received (ឬ stock) ពី label កូនដែល date_in នៅខែ/ឆ្នាំនោះ",
      },
    ],
  },
  {
    id: "plan",
    titleEn: "Plan section (gauge)",
    titleKh: "ផ្នែក Plan (ក្រាបវាស់)",
    items: [
      {
        visualEn: "Current revenue (center number)",
        visualKh: "ចំណូលបច្ចុប្បន្ន",
        formulaEn:
          "SUM(orders.total) from plan start (1st day of start month) through min(today, plan end), status ≠ cancelled",
        formulaKh:
          "ចំណូលបច្ចុប្បន្ន = ផលបូក orders.total ពីដើមខែចាប់ផ្តើម ដល់ថ្ងៃនេះ (ឬចុងផែនការ បើផុតហើយ)",
      },
      {
        visualEn: "Progress % & gauge arc",
        visualKh: "ភាគរយ & ក្រាប",
        formulaEn:
          "displayPercent = min(round((current ÷ target) × 1000) / 10, 999); arc fill = min(displayPercent, 100)",
        formulaKh: "ភាគរយ = (ចំណូលបច្ចុប្បន្ន ÷ គោលដៅ) × 100 · ក្រាបបំពេញ = min(ភាគរយ, 100)",
      },
      {
        visualEn: "Remaining",
        visualKh: "នៅសល់",
        formulaEn: "remaining = max(target − current, 0)",
        formulaKh: "នៅសល់ = max(គោលដៅ − ចំណូលបច្ចុប្បន្ន, 0)",
      },
    ],
  },
  {
    id: "sales-overview",
    titleEn: "Sales overview (daily bar chart)",
    titleKh: "Sales overview (ក្រាបឈរប្រចាំថ្ងៃ)",
    items: [
      {
        visualEn: "Bar height per day",
        visualKh: "កម្ពស់ឈររៀងថ្ងៃ",
        formulaEn:
          "For each calendar date D: revenue = SUM(orders.total) where DATE(created_at) = D, status ≠ cancelled, within global period filter",
        formulaKh: "រៀងថ្ងៃ D៖ ចំណូល = ផលបូក orders.total របស់ orders ក្នុងថ្ងៃ D (មិន cancelled)",
      },
    ],
  },
  {
    id: "product-analysis",
    titleEn: "Product analysis",
    titleKh: "វិភាគផលិតផល",
    items: [
      {
        visualEn: "Products by category (donut)",
        visualKh: "ផលិតផលតាមប្រភេទ",
        formulaEn: "COUNT(products) per storefront category; stock-inventory categories → “Uncategorized”; center = total catalogue count",
        formulaKh: "រាប់ products ក្នុងប្រភេទ · កណ្តាល = ចំនួនផលិតផលសរុបក្នុង catalog",
      },
      {
        visualEn: "Products by country (bars)",
        visualKh: "ផលិតផលតាមប្រទេស",
        formulaEn: "COUNT(products) grouped by stock label origin (inventory source country); not sales geography",
        formulaKh: "រាប់ products តាមប្រទេសប្រភពស្តុក (origin លើ stock label) · មិនមែនប្រទេសលក់",
      },
      {
        visualEn: "Top 10 selling products (bars)",
        visualKh: "ផលិតផលលក់ដាច់ ១០",
        formulaEn:
          "Per product in period: unitsSold = SUM(order_items.qty); revenue = SUM(line_total); ranked by units sold, limit 10",
        formulaKh: "ឯកតាលក់ = ផលបូក qty · ចំណូល = ផលបូក line_total · តម្រៀបតាមឯកតាលក់",
      },
    ],
  },
  {
    id: "category-analysis",
    titleEn: "Category analysis",
    titleKh: "វិភាគប្រភេទ",
    items: [
      {
        visualEn: "Categories revenue (donut)",
        visualKh: "ចំណូលតាមប្រភេទ",
        formulaEn:
          "Per category: revenue = SUM(line_total) in period; center = SUM(all category revenue); % = category revenue ÷ total_revenue",
        formulaKh: "ចំណូលប្រភេទ = ផលបូក line_total · កណ្តាល = ចំណូលសរុបរយៈពេល",
      },
      {
        visualEn: "Top sale categories (clustered bars)",
        visualKh: "ប្រភេទលក់ដាច់ (ឈរប្រៀបរៀប)",
        formulaEn:
          "Per category (top N): unitsSold = SUM(qty); revenue = SUM(line_total); two bars share same category axis",
        formulaKh: "ឯកតាលក់ = ផលបូក qty · ចំណូល = ផលបូក line_total · ឈរពីរក្នុងប្រភេទដូចគ្នា",
      },
    ],
  },
  {
    id: "order-analysis",
    titleEn: "Order analysis",
    titleKh: "វិភាគបញ្ជាទិញ",
    items: [
      {
        visualEn: "Order status (donut)",
        visualKh: "ស្ថានភាពបញ្ជាទិញ",
        formulaEn: "COUNT(orders) per status in period; center = total orders in period; % = count ÷ total_orders",
        formulaKh: "រាប់ orders តាម status · កណ្តាល = បញ្ជាទិញសរុបក្នុងរយៈពេល",
      },
      {
        visualEn: "Orders by category (donut)",
        visualKh: "បញ្ជាទិញតាមប្រភេទ",
        formulaEn:
          "COUNT(DISTINCT orders.id) that have at least one line item in that product category; non-cancelled; center = sum of slice counts (orders may appear in multiple categories)",
        formulaKh: "រាប់បញ្ជាទិញដែលមានផលិតផលក្នុងប្រភេទនោះ (DISTINCT) · បញ្ជាមួយអាចរាប់ច្រើនប្រភេទ",
      },
    ],
  },
  {
    id: "detail-table",
    titleEn: "Top selling products (table)",
    titleKh: "តារាងលម្អិត",
    items: [
      {
        visualEn: "Units sold & revenue columns",
        visualKh: "ជួរឯកតា និងចំណូល",
        formulaEn: "Same as Top 10 chart: SUM(qty) and SUM(line_total) per product_id for the selected period",
        formulaKh: "ដូចក្រាប Top 10៖ ផលបូក qty និង line_total តាម product",
      },
    ],
  },
];
