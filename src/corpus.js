// The demo help centre: twenty articles for a fictional outdoor-clothing store,
// Lumen Outfitters. The content is written to be retrievable — each article has
// a narrow title, a handful of tags and sentences that answer one question.
//
// Nothing here is scraped or real. It is the corpus the BM25 index is built over,
// and the eval harness labels questions against these ids.

export const HELP_CENTRE = [
  {
    id: "kb-order-status",
    title: "Checking your order status",
    category: "Orders",
    tags: ["order", "status", "where", "processing", "shipped", "delivered"],
    body:
      "You can check an order's status under Account, then Orders. Every order shows one of four states: processing, shipped, delivered or returned. Processing means the warehouse is still packing the parcel. Shipped means a carrier has collected it and a tracking number is available. If an order has not moved out of processing after five working days, contact support and we will chase the warehouse.",
  },
  {
    id: "kb-order-tracking",
    title: "Tracking a shipped parcel",
    category: "Orders",
    tags: ["tracking", "parcel", "courier", "tracking number", "link"],
    body:
      "When an order ships we email a tracking link to the address on the order. The carrier usually activates the link within 24 hours of pickup. You can also open Account, then Orders, and select the shipped order to see the same tracking number. Tracking updates can lag by up to a day at weekends. If the link says the number is unknown after two days, contact support with the order number.",
  },
  {
    id: "kb-delivery-times",
    title: "Standard and express delivery times",
    category: "Shipping",
    tags: ["delivery", "time", "how long", "standard", "express", "days"],
    body:
      "Standard delivery takes three to five working days inside Nepal. Express delivery takes one to two working days and is available for most Kathmandu addresses. Remote districts can take up to seven working days with standard delivery. Orders placed after 3 pm are collected the next working day. Sale weeks can add one or two days because the warehouse handles more parcels.",
  },
  {
    id: "kb-shipping-fees",
    title: "What shipping costs",
    category: "Shipping",
    tags: ["shipping", "cost", "fee", "free shipping", "delivery charge"],
    body:
      "Standard shipping costs NPR 150. Express shipping costs NPR 450. Standard shipping is free on orders over NPR 2,500 after any discount is applied. Shipping is calculated at checkout before payment. If a parcel is returned because the address was incomplete, the original shipping fee is not refunded.",
  },
  {
    id: "kb-international-shipping",
    title: "Shipping outside Nepal",
    category: "Shipping",
    tags: ["international", "bhutan", "india", "abroad", "customs", "duties"],
    body:
      "We ship to India and Bhutan. International delivery takes seven to fourteen working days and costs NPR 1,200 for the first kilogram. Customs duties and local taxes are charged by the destination country and are not included at checkout. We cannot mark a parcel as a gift or lower the declared value. If a customs office holds a parcel, the carrier will contact the recipient directly.",
  },
  {
    id: "kb-return-window",
    title: "The 30-day return window",
    category: "Returns",
    tags: ["return", "window", "30 days", "unused", "tags", "send back"],
    body:
      "Unused items can be returned within 30 days of delivery. Items must have their original tags attached and be in a resellable condition. The return window starts on the delivery date recorded by the carrier, not the order date. Final-sale items, gift cards and worn clothing cannot be returned. If you are close to the 30-day limit, start the return before the window closes even if you cannot post the parcel immediately.",
  },
  {
    id: "kb-return-process",
    title: "Starting a return",
    category: "Returns",
    tags: ["return", "start", "label", "pickup", "drop off", "process"],
    body:
      "Start a return under Account, then Orders, and choose Return or exchange. Select a reason and the item you are sending back. We generate a prepaid return label you can print, or a QR code for a courier drop-off. In Kathmandu you can also request a pickup for an extra NPR 100. Pack the item with its tags and include the return slip. Once the courier scans the parcel, the return appears in your account.",
  },
  {
    id: "kb-refund-timing",
    title: "When a refund appears",
    category: "Returns",
    tags: ["refund", "timing", "how long", "money back", "card", "credit"],
    body:
      "Refunds are issued after the warehouse inspects the returned item. Inspection usually takes two working days. Card refunds appear five to seven working days after inspection, depending on the bank. Refunds to eSewa or Khalti usually arrive within one working day. Store credit is available immediately. Rejected returns are sent back with a note explaining the reason, and the original shipping fee is not refunded.",
  },
  {
    id: "kb-refund-eligibility",
    title: "What can be refunded",
    category: "Returns",
    tags: ["refund", "eligible", "eligibility", "final sale", "gift card"],
    body:
      "A refund is available when the item is within the 30-day return window and is unused with its tags attached. Final-sale items and gift cards are not refundable. Items paid for with a gift card are refunded as store credit rather than cash. If part of an order is returned, shipping fees are refunded only when the whole order is returned. Damage reported within 48 hours of delivery is refunded in full.",
  },
  {
    id: "kb-exchanges",
    title: "Exchanging an item",
    category: "Returns",
    tags: ["exchange", "size", "colour", "swap", "different"],
    body:
      "Exchanges are available for a different size or colour within 14 days of delivery. The item must be unused with its tags. Start an exchange under Account, then Orders, and choose the replacement size or colour. We reserve the replacement for five working days while the original is in transit. If the replacement is out of stock, the exchange becomes a refund or store credit.",
  },
  {
    id: "kb-damaged-items",
    title: "Reporting a damaged item",
    category: "Returns",
    tags: ["damaged", "broken", "defect", "photos", "replacement"],
    body:
      "Report a damaged item within 48 hours of delivery. Attach two photos: one of the damage and one of the shipping label. We will arrange a free replacement or a full refund, including shipping. Do not send a damaged item back before support replies, because the returns label needs a damage code. Damage reported after 48 hours is reviewed under the standard return policy.",
  },
  {
    id: "kb-missing-package",
    title: "A parcel marked delivered but missing",
    category: "Shipping",
    tags: ["missing", "not received", "delivered", "stolen", "neighbours"],
    body:
      "If tracking says delivered but the parcel is missing, check with neighbours and the building reception first. Wait 48 hours from the delivery scan before filing a claim; carriers sometimes scan a parcel a day before it reaches the door. Then contact support with the order number and a description of the delivery address. We open a carrier investigation and send a replacement if the parcel is not found within five working days.",
  },
  {
    id: "kb-payment-methods",
    title: "Accepted payment methods",
    category: "Payments",
    tags: ["payment", "card", "esewa", "khalti", "bank transfer", "pay"],
    body:
      "We accept these payment methods: Visa and Mastercard, eSewa, Khalti and bank transfer. Cash on delivery is available for orders under NPR 10,000 inside Nepal. Card details are handled by the payment provider and never stored on our servers. Payment is captured when the order is placed, not when it ships. If a payment method is not visible at checkout, refresh the page or try a different browser.",
  },
  {
    id: "kb-payment-failed",
    title: "A payment was declined",
    category: "Payments",
    tags: ["declined", "failed", "payment", "card", "charged"],
    body:
      "A declined payment means the bank or wallet rejected the transaction; no money leaves your account for a declined attempt. Check the card number, expiry and billing address, then try again. Some banks block the first online payment to a new merchant, so call the number on the back of the card if attempts keep failing. If your statement shows a pending charge for a failed order, it is an authorisation hold and disappears within three working days.",
  },
  {
    id: "kb-promo-codes",
    title: "Using a promo code",
    category: "Promotions",
    tags: ["promo", "code", "discount", "coupon", "voucher"],
    body:
      "Enter a promo code in the discount field at checkout and press Apply. Codes are case sensitive and only one code can be used per order. Promo codes cannot be combined with store credit, gift cards or final-sale items. If a code is rejected, check its expiry date and the minimum spend in the promotion terms. A code that worked before but fails now may have reached its usage limit.",
  },
  {
    id: "kb-gift-cards",
    title: "Gift cards and store credit",
    category: "Promotions",
    tags: ["gift card", "store credit", "balance", "expiry"],
    body:
      "Gift cards are delivered by email within one hour of purchase. They do not expire and can be used over multiple orders until the balance reaches zero. Gift cards cannot be exchanged for cash and are not refundable. Store credit from a return is added to the same balance and shows at checkout. A gift card cannot be combined with a promo code on the same order.",
  },
  {
    id: "kb-cancel-order",
    title: "Cancelling an order",
    category: "Orders",
    tags: ["cancel", "cancellation", "before shipping", "processing"],
    body:
      "An order can be cancelled free of charge while it is still processing, usually within two hours of placement. Open Account, then Orders, choose the order and select Cancel order. Once the warehouse marks an order as shipped it cannot be cancelled; use the return process after delivery instead. If the cancel button is missing, support can attempt a cancellation but cannot guarantee it after packing has started.",
  },
  {
    id: "kb-change-address",
    title: "Changing a delivery address",
    category: "Orders",
    tags: ["address", "change", "delivery", "wrong address"],
    body:
      "A delivery address can be changed only while an order is processing. Contact support with the order number and the corrected address. We cannot change an address after the parcel is shipped because the carrier owns the delivery. If the parcel is sent to the wrong address because the original address was incomplete, the order is returned to us and the shipping fee is not refunded.",
  },
  {
    id: "kb-account-password",
    title: "Resetting your password",
    category: "Account",
    tags: ["password", "reset", "login", "account", "security"],
    body:
      "Use the Forgot password link on the sign-in page and enter the email address on your account. The reset link expires after 24 hours and can only be used once. If the email does not arrive, check the spam folder and confirm you are using the address on the account. For security, support cannot set a password for you; we can only resend the reset link.",
  },
  {
    id: "kb-contact-support",
    title: "Contacting a human",
    category: "Support",
    tags: ["contact", "human", "agent", "handoff", "support hours"],
    body:
      "Relay answers common questions immediately and can hand the conversation to a person when it is unsure or when you ask for one. The support team is online 9 am to 6 pm Nepal time, Sunday to Friday. A hand-off creates a ticket with your transcript so you do not have to repeat yourself. Outside those hours, tickets are queued and answered the next working morning.",
  },
];

export const ARTICLE_BY_ID = new Map(HELP_CENTRE.map((article) => [article.id, article]));

export const CORPUS_STATS = {
  articles: HELP_CENTRE.length,
  categories: [...new Set(HELP_CENTRE.map((article) => article.category))].length,
};

export function articleById(id) {
  return ARTICLE_BY_ID.get(id) || null;
}
